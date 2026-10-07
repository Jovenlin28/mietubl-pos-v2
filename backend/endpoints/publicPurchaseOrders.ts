import express from "express";
import crypto from "crypto";
import mysqlClient from "../db/mysqlClient";
import { getCurrentRegion, Region } from "../db/regions";

type PublicPoProduct = {
  id?: number | string;
  sku?: string;
  name?: string;
  price?: number | string;
  qty?: number | string;
  quantity?: number | string;
  discount?: number | string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeNullableText(v: any): string | null {
  const s = normalizeText(v);
  return s ? s : null;
}

function makeCategoryPrefix(category?: string | null): string {
  const fallback = "PO";
  const raw = normalizeText(category || "");
  if (!raw) return fallback;
  const words = raw.split(/\s+/).filter(Boolean);
  const initials = words.map((w) => w[0]).join("").toUpperCase();
  if (initials.length >= 2) return initials.slice(0, 2);
  const firstTwo = raw.replace(/\s+/g, "").slice(0, 2).toUpperCase();
  return firstTwo || fallback;
}

function calcItemTotal(price: number, discount: number, qty: number): number {
  return (price - discount) * qty;
}

const ensureTablesPromises = new Map<Region, Promise<void>>();

async function ensurePublicPurchaseOrderTables(db: any): Promise<void> {
  const region = getCurrentRegion();
  let ensureTablesPromise = ensureTablesPromises.get(region);
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await db.run(
        `CREATE TABLE IF NOT EXISTS public_purchase_orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ticket_code VARCHAR(64) NOT NULL UNIQUE,
          status VARCHAR(32) NOT NULL DEFAULT 'submitted',
          sale_date DATE NULL,
          sales_channel VARCHAR(100) NULL,
          delivery_option VARCHAR(100) NULL,
          category VARCHAR(255) NULL,
          payment_option VARCHAR(100) NULL,
          customer_full_name VARCHAR(255) NOT NULL,
          customer_store_name VARCHAR(255) NOT NULL,
          customer_phone VARCHAR(64) NOT NULL,
          customer_email VARCHAR(255) NULL,
          company VARCHAR(255) NULL,
          address TEXT NOT NULL,
          notes TEXT NULL,
          sales_id INT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ppo_status (status),
          INDEX idx_ppo_created_at (created_at),
          INDEX idx_ppo_sales_id (sales_id),
          CONSTRAINT fk_ppo_sales FOREIGN KEY (sales_id) REFERENCES sales(id) ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );

      await db.run(
        `CREATE TABLE IF NOT EXISTS public_purchase_order_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          public_purchase_order_id INT NOT NULL,
          product_id INT NULL,
          sku VARCHAR(100) NULL,
          name VARCHAR(255) NULL,
          price DECIMAL(15,2) NOT NULL DEFAULT 0,
          qty INT NOT NULL,
          discount DECIMAL(15,2) NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ppoi_ppo_id (public_purchase_order_id),
          INDEX idx_ppoi_product_id (product_id),
          CONSTRAINT fk_ppoi_ppo FOREIGN KEY (public_purchase_order_id)
            REFERENCES public_purchase_orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_ppoi_product FOREIGN KEY (product_id)
            REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
    })().catch((err) => {
      ensureTablesPromises.delete(region);
      throw err;
    });
    ensureTablesPromises.set(region, ensureTablesPromise);
  }

  await ensureTablesPromise;
}

async function generateUniqueTicketCode(db: any): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  for (let i = 0; i < 12; i++) {
    const suffix = crypto.randomBytes(4).toString("base64").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6);
    const ticket = `PPO-${ymd}-${suffix}`;
    const exists = await db.get(`SELECT id FROM public_purchase_orders WHERE ticket_code = ? LIMIT 1`, [ticket]);
    if (!exists) return ticket;
  }

  return `PPO-${ymd}-${Date.now().toString(36).toUpperCase()}`;
}

export default function registerPublicPurchaseOrders(app: express.Express, db: any) {
  // Public product lookup endpoint (category + stock aware) for customer form builders.
  const publicProductsHandler = async (req: express.Request, res: express.Response) => {
    try {
      const category = normalizeText(req.query.category as string);
      const search = normalizeText(req.query.search as string);

      const whereParts: string[] = ["COALESCE(p.qty, 0) > 0"];
      const params: any[] = [];

      if (category && category.toLowerCase() !== "all") {
        whereParts.push("LOWER(TRIM(c.name)) = LOWER(TRIM(?))");
        params.push(category);
      }
      if (search) {
        const like = `%${search}%`;
        whereParts.push("(p.sku LIKE ? OR p.name LIKE ?)");
        params.push(like, like);
      }

      const whereClause = `WHERE ${whereParts.join(" AND ")}`;
      const rows = await db.all(
        `SELECT
           p.id,
           p.sku,
           p.name,
           p.price,
           p.qty,
           c.id as category_id,
           c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${whereClause}
         ORDER BY p.name ASC`,
        params
      );

      res.json({ items: rows || [] });
    } catch (err) {
      console.error("GET /api/public/products failed:", err);
      res.status(500).json({ error: "Failed to fetch public products" });
    }
  };

  app.get("/public/products", publicProductsHandler);
  app.get("/api/public/products", publicProductsHandler);

  // Public submit endpoint used by customer-facing form.
  const submitHandler = async (req: express.Request, res: express.Response) => {
    try {
      await ensurePublicPurchaseOrderTables(db);

      const saleDate = normalizeText(req.body?.saleDate);
      const salesChannel = normalizeNullableText(req.body?.salesChannel) || "Online";
      const deliveryOption = normalizeText(req.body?.deliveryOption);
      const category = normalizeText(req.body?.category);
      const paymentOption = normalizeText(req.body?.paymentOption);
      const customer = req.body?.customer || {};
      const customerName = normalizeText(customer.fullName || req.body?.customerName);
      const customerStoreName = normalizeText(customer.storeName || req.body?.storeName);
      const customerPhone = normalizeText(customer.phone || req.body?.customerPhone);
      const customerEmail = normalizeNullableText(customer.email || req.body?.customerEmail);
      const company = normalizeNullableText(customer.company || req.body?.company);
      const address = normalizeText(customer.address || req.body?.address);
      const notes = normalizeNullableText(req.body?.notes);
      const products = Array.isArray(req.body?.products) ? (req.body.products as PublicPoProduct[]) : [];

      const errors: string[] = [];
      if (!saleDate) errors.push("saleDate is required");
      if (!deliveryOption) errors.push("deliveryOption is required");
      if (!category) errors.push("category is required");
      if (!paymentOption) errors.push("paymentOption is required");
      if (!customerName) errors.push("customer.fullName is required");
      if (!customerStoreName) errors.push("customer.storeName is required");
      if (!customerPhone) errors.push("customer.phone is required");
      if (!address) errors.push("address is required");
      if (customerEmail && !EMAIL_RE.test(customerEmail)) {
        errors.push("customer.email must be a valid email");
      }
      if (!Array.isArray(products) || products.length === 0) {
        errors.push("At least one product is required");
      }

      if (errors.length > 0) {
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      const normalizedProducts = products.map((p, idx) => {
        const productId = Number(p.id ?? 0);
        const qty = Number(p.qty ?? p.quantity ?? 0);
        const incomingPrice = Number(p.price ?? 0);
        const discount = Number(p.discount ?? 0);

        return {
          index: idx,
          productId,
          qty,
          price: Number.isFinite(incomingPrice) ? incomingPrice : 0,
          discount: Number.isFinite(discount) ? discount : 0,
          sku: normalizeNullableText(p.sku),
          name: normalizeNullableText(p.name),
        };
      });

      const productInputErrors = normalizedProducts
        .filter((p) => !Number.isInteger(p.productId) || p.productId <= 0 || !Number.isFinite(p.qty) || p.qty < 1)
        .map((p) => `Invalid product at index ${p.index}: id and qty (>=1) are required`);

      if (productInputErrors.length > 0) {
        return res.status(400).json({ error: "Validation failed", details: productInputErrors });
      }

      const placeholders = normalizedProducts.map(() => "?").join(",");
      const productIds = normalizedProducts.map((p) => p.productId);
      const productRows = await db.all(
        `SELECT id, sku, name, price, qty FROM products WHERE id IN (${placeholders})`,
        productIds
      );

      const productById = new Map<number, any>();
      for (const row of productRows || []) {
        productById.set(Number(row.id), row);
      }

      const stockErrors: string[] = [];
      const toInsertItems = normalizedProducts.map((p) => {
        const dbProduct = productById.get(p.productId);
        if (!dbProduct) {
          stockErrors.push(`Product not found: ${p.productId}`);
          return null;
        }

        const available = Number(dbProduct.qty ?? 0);
        if (!Number.isFinite(available) || p.qty > available) {
          stockErrors.push(
            `Insufficient stock for product ${dbProduct.sku || dbProduct.name || dbProduct.id}: requested ${p.qty}, available ${available}`
          );
        }

        return {
          productId: p.productId,
          sku: p.sku || dbProduct.sku || null,
          name: p.name || dbProduct.name || null,
          price: Number.isFinite(p.price) && p.price > 0 ? p.price : Number(dbProduct.price ?? 0),
          qty: p.qty,
          discount: Number.isFinite(p.discount) ? p.discount : 0,
        };
      });

      if (stockErrors.length > 0) {
        return res.status(409).json({ error: "Stock validation failed", details: stockErrors });
      }

      const ticketCode = await generateUniqueTicketCode(db);
      const headerResult = await db.run(
        `INSERT INTO public_purchase_orders (
          ticket_code,
          status,
          sale_date,
          sales_channel,
          delivery_option,
          category,
          payment_option,
          customer_full_name,
          customer_store_name,
          customer_phone,
          customer_email,
          company,
          address,
          notes,
          sales_id,
          created_at,
          updated_at
        ) VALUES (?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW(), NOW())`,
        [
          ticketCode,
          saleDate || null,
          salesChannel || null,
          deliveryOption || null,
          category || null,
          paymentOption || null,
          customerName,
          customerStoreName,
          customerPhone,
          customerEmail,
          company,
          address,
          notes,
        ]
      );

      const publicPoId = (headerResult as any).insertId ?? (headerResult as any).lastID;

      for (const item of toInsertItems) {
        if (!item) continue;
        await db.run(
          `INSERT INTO public_purchase_order_items (
            public_purchase_order_id,
            product_id,
            sku,
            name,
            price,
            qty,
            discount,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            publicPoId,
            item.productId,
            item.sku,
            item.name,
            item.price,
            item.qty,
            item.discount,
          ]
        );
      }

      return res.status(201).json({
        id: publicPoId,
        ticketCode,
        ticket_code: ticketCode,
        code: ticketCode,
        referenceCode: ticketCode,
        status: "submitted",
      });
    } catch (err) {
      console.error("POST /public/purchase-orders failed:", err);
      return res.status(500).json({ error: "Failed to submit public purchase order" });
    }
  };

  app.post("/public/purchase-orders", submitHandler);
  app.post("/api/public/purchase-orders", submitHandler);

  // Public tracking endpoint by ticket code.
  const ticketLookupHandler = async (req: express.Request, res: express.Response) => {
    try {
      await ensurePublicPurchaseOrderTables(db);
      const ticketCode = normalizeText(req.params.ticketCode);
      if (!ticketCode) return res.status(400).json({ error: "ticketCode is required" });

      const row = await db.get(
        `SELECT id, ticket_code, status, sales_id, created_at, updated_at
         FROM public_purchase_orders
         WHERE ticket_code = ?
         LIMIT 1`,
        [ticketCode]
      );

      if (!row) return res.status(404).json({ error: "Ticket not found" });

      return res.json({
        id: row.id,
        ticketCode: row.ticket_code,
        ticket_code: row.ticket_code,
        status: row.status,
        salesId: row.sales_id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (err) {
      console.error("GET /public/purchase-orders/:ticketCode failed:", err);
      return res.status(500).json({ error: "Failed to fetch ticket" });
    }
  };

  app.get("/api/public/purchase-orders/:ticketCode", ticketLookupHandler);

  // Internal list for POS review page.
  app.get("/api/public-purchase-orders", async (req, res) => {
    try {
      await ensurePublicPurchaseOrderTables(db);

      const perPage = parseInt(String(req.query.perPage || "10"), 10) || 10;
      const currentPage = parseInt(String(req.query.currentPage || "1"), 10) || 1;
      const offset = (currentPage - 1) * perPage;
      const status = normalizeText(req.query.status as string);
      const search = normalizeText(req.query.search as string);

      const whereParts: string[] = [];
      const params: any[] = [];

      if (status && status.toLowerCase() !== "all") {
        whereParts.push("ppo.status = ?");
        params.push(status);
      }
      if (search) {
        const like = `%${search}%`;
        whereParts.push(`(
          ppo.ticket_code LIKE ? OR
          ppo.customer_full_name LIKE ? OR
          ppo.customer_phone LIKE ? OR
          ppo.customer_store_name LIKE ?
        )`);
        params.push(like, like, like, like);
      }

      const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

      const totalRow = await db.get(
        `SELECT COUNT(*) as count FROM public_purchase_orders ppo ${whereClause}`,
        params.length ? params : undefined
      );
      const total = Number(totalRow?.count || 0);

      const rows = await db.all(
        `SELECT
           ppo.id,
           ppo.ticket_code,
           ppo.status,
           ppo.sale_date,
           ppo.sales_channel,
           ppo.delivery_option,
           ppo.category,
           ppo.payment_option,
           ppo.customer_full_name,
           ppo.customer_store_name,
           ppo.customer_phone,
           ppo.customer_email,
           ppo.company,
           ppo.address,
           ppo.notes,
           ppo.sales_id,
           ppo.created_at,
           ppo.updated_at,
           COALESCE((SELECT SUM(ppoi.qty) FROM public_purchase_order_items ppoi WHERE ppoi.public_purchase_order_id = ppo.id), 0) as total_qty,
           COALESCE((SELECT SUM((ppoi.price - ppoi.discount) * ppoi.qty) FROM public_purchase_order_items ppoi WHERE ppoi.public_purchase_order_id = ppo.id), 0) as subtotal
         FROM public_purchase_orders ppo
         ${whereClause}
         ORDER BY ppo.created_at DESC
         LIMIT ${perPage} OFFSET ${offset}`,
        params.length ? params : undefined
      );

      const orderIds = (rows || []).map((r: any) => Number(r.id)).filter((n: number) => Number.isInteger(n) && n > 0);
      const productsMap: Record<number, any[]> = {};
      if (orderIds.length > 0) {
        const orderPlaceholders = orderIds.map(() => "?").join(",");
        const itemRows = await db.all(
          `SELECT
             ppoi.id,
             ppoi.public_purchase_order_id,
             ppoi.product_id,
             ppoi.sku,
             ppoi.name,
             ppoi.price,
             ppoi.qty,
             ppoi.discount,
             p.sku as product_sku,
             p.name as product_name
           FROM public_purchase_order_items ppoi
           LEFT JOIN products p ON ppoi.product_id = p.id
           WHERE ppoi.public_purchase_order_id IN (${orderPlaceholders})
           ORDER BY ppoi.id ASC`,
          orderIds
        );

        for (const it of itemRows || []) {
          const parentId = Number(it.public_purchase_order_id || 0);
          if (!productsMap[parentId]) productsMap[parentId] = [];

          const price = Number(it.price ?? 0);
          const qty = Number(it.qty ?? 0);
          const discount = Number(it.discount ?? 0);
          productsMap[parentId].push({
            id: it.id,
            product_id: it.product_id,
            sku: it.sku ?? it.product_sku ?? null,
            name: it.name ?? it.product_name ?? null,
            price,
            qty,
            quantity: qty,
            discount,
            tax: 0,
            total: calcItemTotal(price, discount, qty),
          });
        }
      }

      const items = (rows || []).map((r: any) => ({
        ...r,
        products: productsMap[Number(r.id)] || [],
      }));

      res.json({ items, total });
    } catch (err) {
      console.error("GET /api/public-purchase-orders failed:", err);
      res.status(500).json({ error: "Failed to fetch public purchase orders" });
    }
  });

  // Internal detail endpoint.
  app.get("/api/public-purchase-orders/:id", async (req, res) => {
    try {
      await ensurePublicPurchaseOrderTables(db);
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

      const row = await db.get(`SELECT * FROM public_purchase_orders WHERE id = ?`, [id]);
      if (!row) return res.status(404).json({ error: "Public purchase order not found" });

      const items = await db.all(
        `SELECT id, public_purchase_order_id, product_id, sku, name, price, qty, discount, created_at, updated_at
         FROM public_purchase_order_items
         WHERE public_purchase_order_id = ?
         ORDER BY id ASC`,
        [id]
      );

      res.json({ ...row, items: items || [] });
    } catch (err) {
      console.error("GET /api/public-purchase-orders/:id failed:", err);
      res.status(500).json({ error: "Failed to fetch public purchase order" });
    }
  });

  // Confirm and convert into sales (idempotent).
  const confirmHandler = async (req: express.Request, res: express.Response) => {
    let conn: any = null;

    try {
      await ensurePublicPurchaseOrderTables(db);

      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
      }

      const pool = await (mysqlClient as any).initPool();
      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [poRows]: any = await conn.execute(
        `SELECT * FROM public_purchase_orders WHERE id = ? FOR UPDATE`,
        [id]
      );
      const po = Array.isArray(poRows) && poRows.length ? poRows[0] : null;

      if (!po) {
        await conn.rollback();
        return res.status(404).json({ error: "Public purchase order not found" });
      }

      if (po.status === "converted" && po.sales_id) {
        await conn.commit();
        return res.json({
          status: "converted",
          salesId: po.sales_id,
          ticketCode: po.ticket_code,
        });
      }

      if (["cancelled"].includes(String(po.status || "").toLowerCase())) {
        await conn.rollback();
        return res.status(409).json({ error: `Cannot convert order with status '${po.status}'` });
      }

      const [itemRows]: any = await conn.execute(
        `SELECT * FROM public_purchase_order_items WHERE public_purchase_order_id = ? ORDER BY id ASC FOR UPDATE`,
        [id]
      );
      const items: any[] = Array.isArray(itemRows) ? itemRows : [];

      if (!items.length) {
        await conn.rollback();
        return res.status(400).json({ error: "Public purchase order has no items" });
      }

      const productIds = items.map((it) => Number(it.product_id || 0)).filter((n) => Number.isInteger(n) && n > 0);
      if (productIds.length !== items.length) {
        await conn.rollback();
        return res.status(400).json({ error: "One or more items have unresolved product_id" });
      }

      const placeholders = productIds.map(() => "?").join(",");
      const [productRows]: any = await conn.execute(
        `SELECT id, sku, name, qty, price FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
        productIds
      );

      const productById = new Map<number, any>();
      for (const p of productRows || []) {
        productById.set(Number(p.id), p);
      }

      const stockErrors: string[] = [];
      for (const it of items) {
        const pid = Number(it.product_id || 0);
        const p = productById.get(pid);
        if (!p) {
          stockErrors.push(`Product not found: ${pid}`);
          continue;
        }
        const reqQty = Number(it.qty || 0);
        const avail = Number(p.qty ?? 0);
        if (!Number.isFinite(reqQty) || reqQty < 1) {
          stockErrors.push(`Invalid qty for product ${pid}`);
          continue;
        }
        if (!Number.isFinite(avail) || reqQty > avail) {
          stockErrors.push(
            `Insufficient stock for product ${p.sku || p.name || p.id}: requested ${reqQty}, available ${avail}`
          );
        }
      }

      if (stockErrors.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: "Stock revalidation failed", details: stockErrors });
      }

      // Match existing customer by phone first, then email.
      const phone = normalizeText(po.customer_phone);
      const email = normalizeNullableText(po.customer_email);
      let customerId: number | null = null;

      const customerDebug = {
        publicPurchaseOrderId: id,
        ticketCode: po.ticket_code,
        phone,
        email,
        customerFullName: normalizeText(po.customer_full_name),
        customerStoreName: normalizeText(po.customer_store_name),
      };
      console.log("[PPO Confirm] Customer resolve start:", customerDebug);
      debugger;

      if (phone) {
        const [phoneRows]: any = await conn.execute(
          `SELECT id FROM customers WHERE TRIM(phoneNumber) = ? ORDER BY id ASC LIMIT 1`,
          [phone]
        );
        console.log("[PPO Confirm] Phone match query result:", phoneRows);
        if (Array.isArray(phoneRows) && phoneRows.length) {
          customerId = Number(phoneRows[0].id);
          console.log("[PPO Confirm] Customer matched by phone:", { customerId, phone });
        }
      }

      if (!customerId && email) {
        const [emailRows]: any = await conn.execute(
          `SELECT id FROM customers WHERE LOWER(TRIM(email)) = LOWER(?) ORDER BY id ASC LIMIT 1`,
          [email]
        );
        console.log("[PPO Confirm] Email match query result:", emailRows);
        if (Array.isArray(emailRows) && emailRows.length) {
          customerId = Number(emailRows[0].id);
          console.log("[PPO Confirm] Customer matched by email:", { customerId, email });
        }
      }

      if (!customerId) {
        console.log("[PPO Confirm] No customer match found. Creating new customer.", customerDebug);
        debugger;
        const [insCustomer]: any = await conn.execute(
          `INSERT INTO customers (fullName, email, phoneNumber, address, storeName, company, status, createdOn)
           VALUES (?, ?, ?, ?, ?, ?, 'Active', NOW())`,
          [
            normalizeText(po.customer_full_name),
            email,
            phone || null,
            normalizeText(po.address),
            normalizeText(po.customer_store_name) || null,
            normalizeNullableText(po.company),
          ]
        );
        console.log("[PPO Confirm] Customer insert result:", insCustomer);
        customerId = Number(insCustomer?.insertId || 0) || null;
        console.log("[PPO Confirm] Created customerId:", customerId);
        debugger;
      } else {
        console.log("[PPO Confirm] Reusing existing customerId:", customerId);
      }

      // Create sale first, then derive final PO number from inserted sale id.
      const [saleIns]: any = await conn.execute(
        `INSERT INTO sales (
          saleDate,
          paymentStatus,
          salesChannel,
          customer_id,
          receiptNo,
          purchaseOrderNumber,
          po_key,
          category,
          agent_id,
          paymentOption,
          address,
          notes,
          agentCommission,
          deliveryOption,
          createdOn
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          po.sale_date || null,
          "Unpaid",
          po.sales_channel || "Online",
          customerId,
          null,
          null,
          null,
          po.category || null,
          null,
          po.payment_option || null,
          po.address || null,
          po.notes || null,
          null,
          po.delivery_option || null,
        ]
      );

      const salesId = Number(saleIns?.insertId || 0);
      if (!salesId) {
        throw new Error("Failed to create sales row");
      }

      const prefix = makeCategoryPrefix(po.category || "PO");
      const poNumber = `${prefix}${String(salesId).padStart(7, "0")}`;

      await conn.execute(`UPDATE sales SET purchaseOrderNumber = ?, po_key = ? WHERE id = ?`, [poNumber, poNumber, salesId]);

      for (const it of items) {
        const qty = Number(it.qty || 0);
        const price = Number(it.price ?? 0);
        const discount = Number(it.discount ?? 0);
        const total = calcItemTotal(price, discount, qty);

        await conn.execute(
          `INSERT INTO sale_items (sale_id, product_id, quantity, price, discount, tax, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [salesId, Number(it.product_id || 0), qty, price, discount, 0, total]
        );
      }

      // Keep downstream flows consistent with direct sales creation.
      await conn.execute(
        `INSERT INTO payments (amount, purchaseOrderNumber, po_key, paymentChannel, description, paymentDate, dueDate, attachment, referenceNo, parentPaymentId, createdOn)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW())`,
        [0, poNumber, poNumber, "", "", null, null, "", ""]
      );

      await conn.execute(
        `INSERT INTO deliveries (purchaseOrderNumber, po_key, status, method, processedAttachment, pickedUpAttachment, deliveredAttachment, processedDate, pickedUpDate, deliveredDate, createdOn)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [poNumber, poNumber, "Pending", po.delivery_option || null, "", "", "", null, null, null]
      );

      await conn.execute(
        `UPDATE public_purchase_orders
         SET status = 'converted', sales_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [salesId, id]
      );

      await conn.commit();

      return res.json({
        status: "converted",
        salesId,
        ticketCode: po.ticket_code,
      });
    } catch (err) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (_) {
          // ignore rollback error
        }
      }
      console.error("POST /api/public-purchase-orders/:id/confirm failed:", err);
      return res.status(500).json({ error: "Failed to convert public purchase order" });
    } finally {
      if (conn) conn.release();
    }
  };

  app.post("/api/public-purchase-orders/:id/confirm", confirmHandler);

  // Optional action for POS workflow.
  app.post("/api/public-purchase-orders/:id/cancel", async (req, res) => {
    try {
      await ensurePublicPurchaseOrderTables(db);
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
      }

      const existing = await db.get(
        `SELECT id, ticket_code, status, sales_id FROM public_purchase_orders WHERE id = ?`,
        [id]
      );
      if (!existing) {
        return res.status(404).json({ error: "Public purchase order not found" });
      }
      if (String(existing.status || "").toLowerCase() === "converted" || existing.sales_id) {
        return res.status(409).json({ error: "Converted orders cannot be cancelled" });
      }

      await db.run(
        `UPDATE public_purchase_orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
        [id]
      );

      const updated = await db.get(
        `SELECT id, ticket_code, status, sales_id, updated_at FROM public_purchase_orders WHERE id = ?`,
        [id]
      );

      return res.json({
        success: 1,
        id: updated?.id,
        ticketCode: updated?.ticket_code,
        status: updated?.status,
        salesId: updated?.sales_id ?? null,
        updatedAt: updated?.updated_at,
      });
    } catch (err) {
      console.error("POST /api/public-purchase-orders/:id/cancel failed:", err);
      return res.status(500).json({ error: "Failed to cancel public purchase order" });
    }
  });
}

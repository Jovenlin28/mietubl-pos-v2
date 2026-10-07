import express from "express";

export default function registerSales(app: express.Express, db: any,) {
  // helper: generate purchase order number
  // generate purchase order number with category prefix (two letters) e.g. "FH00001"
  async function generatePurchaseOrderNumber(db: any, categoryPrefix = "PO") {
    // Compute a single candidate based on MAX(id)+1 and pad to 7 digits.
    // No existence loop/check — rely on auto-increment uniqueness. Fall back to time-based suffix on error.
    try {
      const nextSalesIdRow: any = await db.get(`SELECT COALESCE(MAX(id),0)+1 as nextId FROM sales`);
      const numeric = Number(nextSalesIdRow?.nextId ?? 1) || 1;
      return `${categoryPrefix}${String(numeric).padStart(7, "0")}`; // e.g. HM0000072
    } catch {
      return `${categoryPrefix}${String(Date.now()).slice(-7)}`;
    }
  }

  // Helper function to compute category prefix dynamically from categories table
  async function computeCategoryPrefix(db: any, category?: string): Promise<string> {
    const fallback = "PO";

    const makePrefix = (name: string) => {
      if (!name) return fallback;
      const words = String(name).trim().split(/\s+/).filter(Boolean);
      const initials = words.map(w => w[0]).join("").toUpperCase();
      if (initials.length >= 2) return initials.slice(0, 2);
      const firstTwo = name.replace(/\s+/g, "").slice(0, 2).toUpperCase();
      return firstTwo || fallback;
    };

    try {
      if (!category) return fallback;
      const row = await db.get(`SELECT name FROM categories WHERE UPPER(name) = UPPER(?) LIMIT 1`, [category]);
      if (row?.name) return makePrefix(row.name);
      return makePrefix(category);
    } catch {
      return makePrefix(category || "");
    }
  }

  app.get('/api/sales', async (req, res) => {

    try {
      const perPage = parseInt(req.query.perPage as string) || 10;
      const currentPage = parseInt(req.query.currentPage as string) || 1;
      const offset = (currentPage - 1) * perPage;
      const search = (req.query.search as string)?.trim();
      const fromDate = (req.query.fromDate as string)?.trim();
      const category = (req.query.category as string)?.trim();
      const toDate = (req.query.toDate as string)?.trim();

      let whereClause = "";
      const params: any[] = [];
      const conditions: string[] = [];

      if (search) {
        const like = `%${search}%`;
        conditions.push(`(
          c.fullName LIKE ? OR
          s.notes LIKE ? OR
          s.purchaseOrderNumber LIKE ? OR
          s.receiptNo LIKE ? OR
          s.category LIKE ? OR
          EXISTS(
            SELECT 1
            FROM sale_items si2
            JOIN products p2 ON si2.product_id = p2.id
            WHERE si2.sale_id = s.id
              AND p2.name LIKE ?
          )
        )`);
        params.push(like, like, like, like, like, like);
      }
      // filter by category if provided and not empty / 'All'
      if (category && category !== "All") {
        conditions.push("s.category = ?");
        params.push(category);
      }
      // Filter by sale date (saleDate) using date-only strings to avoid timezone shifts
      if (fromDate) { conditions.push("DATE(s.saleDate) >= ?"); params.push(fromDate); }
      if (toDate) {
        // Compare date parts only so the range is inclusive for the selected day
        conditions.push("DATE(s.saleDate) <= ?"); params.push(toDate);
      }
      if (conditions.length > 0) whereClause = `WHERE ${conditions.join(" AND ")}`;

      // allowed sort columns (alias for computed grandTotal included)
      const allowedSortCols: Record<string, string> = {
        saleDate: "s.saleDate",
        purchaseOrderNumber: "s.purchaseOrderNumber",
        createdOn: "s.createdOn",
        grandTotal: "grandTotal"
      };
      const rawSortBy = (req.query.sortBy as string) || "";
      const rawSortDir = ((req.query.sortDir as string) || "").toLowerCase() === "asc" ? "ASC" : "DESC";
      let orderClause = "ORDER BY s.createdOn DESC"; // default

      if (rawSortBy && allowedSortCols[rawSortBy]) {
        orderClause = `ORDER BY ${allowedSortCols[rawSortBy]} ${rawSortDir}`;
      }

      const totalRow = await db.get(`SELECT COUNT(*) as count FROM sales s LEFT JOIN customers c ON s.customer_id = c.id ${whereClause}`, params.length ? params : undefined);
      const total = totalRow ? totalRow.count : 0;

      const sales = await db.all(
        `SELECT 
           s.*, 
           c.id as customer_id,
           c.fullName as customer_fullName,
           c.email as customer_email,
           c.phoneNumber as customer_phoneNumber,
           c.storeName as customer_storeName,
           c.address as customer_address,
           c.country as customer_country,
           c.status as customer_status,
           a.id as agent_id,
           a.fullName as agent_fullName,
           a.phone as agent_phone,
           a.status as agent_status,
           -- compute grandTotal per sale for ordering/display as gross (price + tax) * quantity (no discounts applied)
           (SELECT COALESCE(SUM((COALESCE(si.price,0) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) FROM sale_items si WHERE si.sale_id = s.id) AS grandTotal
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         LEFT JOIN agents a ON s.agent_id = a.id
         ${whereClause}
         ${orderClause}
         LIMIT ${perPage} OFFSET ${offset}`,
        params.length ? params : undefined
      );

      // batch-fetch sale items and resolve customer-specific discount only; recompute line totals
      const saleIds = sales.map((s: any) => s.id).filter(Boolean);
      if (saleIds.length > 0) {
        const placeholders = saleIds.map(() => '?').join(',');
        // pass saleIds as single array param (not spread)
        const itemsRows = await db.all(
          `
           SELECT
             si.id,
             si.sale_id,
             si.product_id,
             si.quantity,
             si.price as unit_price,
             si.discount as line_discount,
             si.tax as tax,
             si.total as item_total,
             p.sku,
             p.name,
             p.price as product_price,
             p.unit as product_unit,
             cpd.discount_value as customer_discount
           FROM sale_items si
           LEFT JOIN products p ON si.product_id = p.id
           LEFT JOIN sales s ON si.sale_id = s.id
           LEFT JOIN customer_product_discounts cpd
                 ON cpd.customer_id = s.customer_id
                AND cpd.product_id = si.product_id
           WHERE si.sale_id IN (${placeholders})
           ORDER BY si.id ASC
           `,
          saleIds
        );

        const itemsMap: Record<number, any[]> = {};
        for (const r of itemsRows) {
          itemsMap[r.sale_id] = itemsMap[r.sale_id] || [];

          const unitPrice = Number(r.unit_price ?? r.product_price ?? 0);
          const qty = Number(r.quantity ?? 1) || 1;
          // Prefer actual stored per-line discount (si.discount) over customer_product_discounts
          // because the applied discount in sale_items is authoritative.
          const perUnitDiscount = (() => {
            const ld = r.line_discount !== null && r.line_discount !== undefined ? Number(r.line_discount) : null;
            return (ld !== null && ld !== 0) ? ld : Number(r.customer_discount ?? 0);
          })();
          const tax = Number(r.tax ?? 0);

          const itemTotalFromDb =
            r.item_total !== undefined && r.item_total !== null
              ? Number(r.item_total)
              : null;
          const computedTotal = (unitPrice - perUnitDiscount + tax) * qty;
          // only trust DB item_total when it exactly (within rounding) matches computed total;
          // otherwise prefer recomputed value so discounts are applied consistently.
          const useDbTotal =
            itemTotalFromDb !== null &&
            Math.abs(Number(itemTotalFromDb) - Number(computedTotal)) < 0.005;
          const lineTotal = useDbTotal ? Number(itemTotalFromDb) : Number(computedTotal);

          r.price = unitPrice;
          r.quantity = qty;
          r.discount = perUnitDiscount;
          r.tax = tax;
          r.total = Number.isFinite(lineTotal) ? lineTotal : 0;

          itemsMap[r.sale_id].push(r);
        }

        // fetch freebies linked to these sales via purchaseOrderNumber (if any)
        const poNumbers = sales.map((s: any) => s.purchaseOrderNumber).filter(Boolean);
        const freebiesMap: Record<string, any[]> = {};
        if (poNumbers.length > 0) {
          const poPlaceholders = poNumbers.map(() => '?').join(',');
          const freebiesRows = await db.all(
            `SELECT pf.*, p.sku as product_sku, p.name as product_name
             FROM product_freebies pf
             LEFT JOIN products p ON pf.product_id = p.id
             WHERE pf.purchaseOrderNumber IN (${poPlaceholders})
             ORDER BY pf.id DESC`,
            poNumbers
          );
          for (const f of freebiesRows || []) {
            const po = f.purchaseOrderNumber || "";
            freebiesMap[po] = freebiesMap[po] || [];
            freebiesMap[po].push({
              id: f.id,
              product_id: f.product_id,
              name: f.name ?? f.product_name ?? null,
              qty: Number(f.qty ?? 0),
              sku: f.sku ?? f.product_sku ?? null,
              price: Number(f.price ?? 0),
              purchaseOrderNumber: po,
            });
          }
        }

        for (const sale of sales) {
          const its = itemsMap[sale.id] || [];
          sale.products = its;

          // gross (pre-discount) total
          const grossSum = its.reduce(
            (sum: number, it: any) =>
              sum +
              ((Number(it.price || 0) + Number(it.tax || 0)) *
                Number(it.quantity || 1)),
            0
          );
          // net (after per-line discounts)
          const lineTotalSum = its.reduce(
            (sum: number, it: any) => sum + Number(it.total || 0),
            0
          );
          const totalDiscount = Math.max(grossSum - lineTotalSum, 0);

          sale.grandTotal = grossSum;          // pre-discount sum (2500+1400+1200 = 5100)
          sale.totalDiscount = totalDiscount;  // difference (e.g. 300)
          sale.netTotal = lineTotalSum;        // after discount (e.g. 4800)
          // attach freebies for this sale (by purchaseOrderNumber) if present
          sale.freebies = (sale.purchaseOrderNumber && freebiesMap[sale.purchaseOrderNumber]) ? freebiesMap[sale.purchaseOrderNumber] : [];
        }
      } else {
        for (const sale of sales) {
          sale.products = [];
          sale.totalDiscount = 0;
          sale.grandTotal = sale.grandTotal ?? 0;
          sale.netTotal = Number(sale.grandTotal || 0) - Number(sale.totalDiscount || 0);
          sale.freebies = [];
        }
      }

      const items = sales.map((s: any) => {
        const {
          customer_id,
          customer_fullName,
          customer_email,
          customer_phoneNumber,
          customer_storeName,
          customer_address,
          customer_country,
          customer_status,
          agent_id,
          agent_fullName,
          agent_phone,
          agent_status,
          ...rest
        } = s;

        return {
          ...rest,
          agentCommission: s.agentCommission ?? null,
          agent: agent_id
            ? {
                id: agent_id,
                fullName: agent_fullName,
                phone: agent_phone,
                status: agent_status,
              }
            : null,
          freebies: s.freebies || [],
          // include storeName and address inside customer object
          customer: customer_id
            ? {
              id: customer_id,
              fullName: customer_fullName,
              email: customer_email,
              phoneNumber: customer_phoneNumber,
              storeName: customer_storeName,
              address: customer_address,
              country: customer_country,
              status: customer_status,
            }
            : null,
          products: s.products || [],
          totalDiscount: s.totalDiscount || 0,
          grandTotal: s.grandTotal || 0,
          netTotal: s.netTotal ?? (Number(s.grandTotal || 0) - Number(s.totalDiscount || 0)),
        };
      });

      res.json({ items, total });
    } catch (err) {
      console.error("GET /api/sales failed:", err);
      // include error details in response for easier debugging (remove in production)
      res.status(500).json({ error: "Failed to fetch sales", details: err ? err.toString() : null });
    }
  });

  app.post('/api/sales', async (req, res) => {
    try {
      const {
        saleDate,
        paymentStatus,
        salesChannel,
        receiptNo,
        purchaseOrderNumber,
        category,
        customer_id,
        agentId,
        paymentOption,
        address,
        notes,
        agentCommission,
        deliveryOption,
        products = [],
        freebies = []
      } = req.body as any;

      // determine two-letter prefix based on category
      const prefix = await computeCategoryPrefix(db, category);

      // Insert sale first (leave purchaseOrderNumber NULL if not provided)
      const initialPO =
        purchaseOrderNumber !== undefined && purchaseOrderNumber !== null
          ? String(purchaseOrderNumber).trim() || null
          : null;
      const result = await db.run(
        `INSERT INTO sales (saleDate, paymentStatus, salesChannel, customer_id, receiptNo, purchaseOrderNumber, po_key, category, agent_id, paymentOption, address, notes, agentCommission, deliveryOption, createdOn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          saleDate ?? null,
          paymentStatus || "Unpaid",
          salesChannel ?? null,
          customer_id ?? null,
          receiptNo ?? null,
          initialPO, // may be null
          initialPO,
          category ?? null,
          typeof agentId !== 'undefined' && agentId !== null && agentId !== '' ? agentId : null,
          paymentOption ?? null,
          address ?? null,
          notes ?? null,
          typeof agentCommission !== "undefined" && agentCommission !== null ? agentCommission : null,
          deliveryOption ?? null
        ]
      );

      const newId = (result as any).insertId ?? (result as any).lastID;

      // If PO was not provided, construct it using the auto-increment id (atomic and unique)
      let poNumber = purchaseOrderNumber ?? null;
      if (!poNumber) {
        // use 7-digit padding to match generator
        poNumber = `${prefix}${String(newId).padStart(7, "0")}`;
        try {
          await db.run(`UPDATE sales SET purchaseOrderNumber = ?, po_key = ? WHERE id = ?`, [poNumber, poNumber, newId]);
        } catch (uerr) {
          console.error("Failed to update generated PO on sale:", uerr);
        }
      }

      // Insert sale items (products) provided in the payload
      if (Array.isArray(products) && products.length > 0) {
        for (const it of products) {
          const qty = Number(it.quantity ?? it.qty ?? 0);
          const price = Number(it.price ?? 0);
          const discount = Number(it.discount ?? 0);
          const tax = Number(it.tax ?? 0);
          const total =
            typeof it.total !== "undefined"
              ? Number(it.total)
              : (price - discount + tax) * qty;
          const productId = it.product_id ?? it.id ?? null;
          await db.run(
            `INSERT INTO sale_items (sale_id, product_id, quantity, price, discount, tax, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [newId, productId, qty || null, price ?? null, discount ?? null, tax ?? null, total ?? null]
          );
        }
      }

      // Insert freebies (if provided) into product_freebies using freebie.id as product_id
      // NOTE: moved here so poNumber is available to store with each freebie row
      if (Array.isArray(freebies) && freebies.length > 0) {
        try {
          for (const fb of freebies) {
            const productId = fb?.id ?? null;
            const nameVal = fb?.name ?? null;
            const qtyVal = typeof fb?.qty !== "undefined" ? Number(fb.qty) : 0;
            const skuVal = fb?.sku ?? null;
            // price may be provided in payload; default to 0 when missing
            const priceVal = typeof fb?.price !== "undefined" ? Number(fb.price) : 0;
            if (!productId) continue;
            try {
              await db.run(
                `INSERT INTO product_freebies (product_id, name, qty, sku, price, purchaseOrderNumber) VALUES (?, ?, ?, ?, ?, ?)`,
                [productId, nameVal, qtyVal, skuVal, priceVal, poNumber ?? null]
              );
            } catch (e) {
              console.warn("Insert freebie failed for product_id", productId, e);
            }
          }
        } catch (e) {
          console.warn("Failed to insert freebies for sale:", e);
        }
      }

      // Insert default payment and delivery records for the created sale
      try {
        // Payments: default values (parentPaymentId NULL => parent/root payment)
        await db.run(
          `INSERT INTO payments (amount, purchaseOrderNumber, po_key, paymentChannel, description, paymentDate, dueDate, attachment, referenceNo, parentPaymentId, createdOn)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW())`,
          [0, poNumber ?? null, poNumber ?? null, "", "", null, null, "", ""]

        );

        // Deliveries: default values (use processedAttachment column name from schema)
        await db.run(
          `INSERT INTO deliveries (purchaseOrderNumber, po_key, status, method, processedAttachment, pickedUpAttachment, deliveredAttachment, processedDate, pickedUpDate, deliveredDate, trackingNumber, createdOn)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [poNumber ?? null, poNumber ?? null, "Pending", deliveryOption ?? null, "", "", "", null, null, null, ""]
        );

        console.log('successfully insert one record into payments and deliveries table');
      } catch (insErr) {
        console.error("Failed to insert default payment/delivery records:", insErr);
        // non-fatal: continue to return created sale even if these inserts fail
      }

      // fetch created sale + its items to return
      const created = await db.get(`SELECT * FROM sales WHERE id = ?`, [newId]);

      // fetch agent row if present
      let createdAgent: any = null;
      try {
        if (created && created.agent_id) {
          createdAgent = await db.get(`SELECT id, fullName, phone, status, createdOn FROM agents WHERE id = ?`, [created.agent_id]);
        }
      } catch (e) {
        console.warn('Failed to fetch agent for created sale', e);
      }

      const saleItems = await db.all(
        `
         SELECT
           si.id,
           si.product_id,
           si.quantity,
           si.price as unit_price,
           si.discount as line_discount,
           si.total as item_total,
           si.tax,
           p.sku,
           p.name as product_name,
           p.price as product_price,
           cpd.discount_value as customer_discount
         FROM sale_items si
         LEFT JOIN products p ON si.product_id = p.id
         LEFT JOIN sales s ON si.sale_id = s.id
         LEFT JOIN customer_product_discounts cpd
               ON cpd.customer_id = s.customer_id
              AND cpd.product_id = si.product_id
         WHERE si.sale_id = ?
         ORDER BY si.id ASC
         `,
        [newId]
      );

      const mappedItems = (saleItems || []).map((r: any) => {
        const unitPrice = Number(r.unit_price ?? r.product_price ?? 0);
        const qty = Number(r.quantity ?? 1);
        const perUnitDiscount = (() => {
          const ld = r.line_discount !== null && r.line_discount !== undefined ? Number(r.line_discount) : null;
          return (ld !== null && ld !== 0) ? ld : Number(r.customer_discount ?? 0);
        })();
        const tax = Number(r.tax ?? 0);
        const itemTotalFromDb =
          r.item_total !== undefined && r.item_total !== null
            ? Number(r.item_total)
            : null;
        const computedTotal = (unitPrice - perUnitDiscount + tax) * qty;
        // only trust DB item_total when it exactly (within rounding) matches computed total;
        // otherwise prefer recomputed value so discounts are applied consistently.
        const useDbTotal =
          itemTotalFromDb !== null &&
          Math.abs(Number(itemTotalFromDb) - Number(computedTotal)) < 0.005;
        const total = useDbTotal
          ? itemTotalFromDb
          : (unitPrice - perUnitDiscount + tax) * qty;
        return {
          id: r.id,
          product_id: r.product_id,
          sku: r.sku,
          name: r.product_name,
          price: unitPrice,
          quantity: qty,
          discount: perUnitDiscount,
          tax: tax,
          total: total,
        };
      });

      // Totals (grandTotal = gross pre-discount, netTotal = after discount)
      const grossCreated = mappedItems.reduce(
        (sum: number, it: any) =>
          sum +
          ((Number(it.price || 0) + Number(it.tax || 0)) *
            Number(it.quantity || 1)),
        0
      );
      const netCreated = mappedItems.reduce(
        (sum: number, it: any) => sum + Number(it.total || 0),
        0
      );
      const createdTotalDiscount = Math.max(grossCreated - netCreated, 0);
      const createdGrandTotal = grossCreated;
      const createdNetTotal = netCreated;

      res.status(201).json({
        success: 1,
        item: {
          ...created,
          agentCommission: created.agentCommission ?? null,
          agent: createdAgent ? { id: createdAgent.id, fullName: createdAgent.fullName, phone: createdAgent.phone, status: createdAgent.status } : null,
          products: mappedItems,
          totalDiscount: createdTotalDiscount,
          grandTotal: createdGrandTotal,
          netTotal: createdNetTotal,
        },
      });
    } catch (err) {
      console.error("Create sale failed:", err);
      res.status(500).json({ error: "Failed to create sale" });
    }
  });

  app.get('/api/sales/:id', async (req, res) => {

    const { id } = req.params;
    try {
      const sale = await db.get(
        `SELECT s.*, c.id as customer_id, c.fullName as customer_fullName, c.email as customer_email, c.phoneNumber as customer_phoneNumber, c.country as customer_country, c.status as customer_status
          FROM sales s
          LEFT JOIN customers c ON s.customer_id = c.id
          WHERE s.id = ?`,
        [id]
      );
      if (!sale) return res.status(404).json({ error: "Sale not found" });

      const saleItems = await db.all(
        `
         SELECT
           si.id,
           si.product_id,
           si.quantity,
           si.price as unit_price,
           si.discount as line_discount,
           si.total as item_total,
           si.tax,
           p.sku,
           p.name as product_name,
           p.price as product_price,
           cpd.discount_value as customer_discount
         FROM sale_items si
         LEFT JOIN products p ON si.product_id = p.id
         LEFT JOIN sales s ON si.sale_id = s.id
         LEFT JOIN customer_product_discounts cpd
               ON cpd.customer_id = s.customer_id
              AND cpd.product_id = si.product_id
         WHERE si.sale_id = ?
         ORDER BY si.id ASC
         `,
        [id]
      );

      const mappedItems = (saleItems || []).map((r: any) => {
        const unitPrice = Number(r.unit_price ?? r.product_price ?? 0);
        const qty = Number(r.quantity ?? 1);
        const perUnitDiscount = (() => {
          const ld = r.line_discount !== null && r.line_discount !== undefined ? Number(r.line_discount) : null;
          return (ld !== null && ld !== 0) ? ld : Number(r.customer_discount ?? 0);
        })();
        const tax = Number(r.tax ?? 0);
        const itemTotalFromDb =
          r.item_total !== undefined && r.item_total !== null
            ? Number(r.item_total)
            : null;
        const computedTotal = (unitPrice - perUnitDiscount + tax) * qty;
        // only trust DB item_total when it exactly (within rounding) matches computed total;
        // otherwise prefer recomputed value so discounts are applied consistently.
        const useDbTotal =
          itemTotalFromDb !== null &&
          Math.abs(Number(itemTotalFromDb) - Number(computedTotal)) < 0.005;
        const total = useDbTotal
          ? itemTotalFromDb
          : (unitPrice - perUnitDiscount + tax) * qty;
        return {
          id: r.id,
          product_id: r.product_id,
          sku: r.sku,
          name: r.product_name,
          price: unitPrice,
          quantity: qty,
          discount: perUnitDiscount,
          tax: tax,
          total: total
        };
      });


      const grossSum = mappedItems.reduce(
        (sum: number, it: any) =>
          sum +
          ((Number(it.price || 0) + Number(it.tax || 0)) *
            Number(it.quantity || 1)),
        0
      );
      const netSum = mappedItems.reduce(
        (sum: number, it: any) => sum + Number(it.total || 0),
        0
      );
      const totalDiscount = Math.max(grossSum - netSum, 0);
      const grandTotal = grossSum;
      const netTotal = netSum;

      const customer = sale.customer_id ? { id: sale.customer_id, fullName: sale.customer_fullName, email: sale.customer_email, phoneNumber: sale.customer_phoneNumber, country: sale.customer_country, status: sale.customer_status } : null;
      // ensure category included (sale.* contains category if present)

      // fetch freebies associated to this sale via its purchaseOrderNumber (if present)
      let freebies: any[] = [];
      try {
        if (sale.purchaseOrderNumber) {
          const fbRows = await db.all(
            `SELECT pf.*, p.sku as product_sku, p.name as product_name
             FROM product_freebies pf
             LEFT JOIN products p ON pf.product_id = p.id
             WHERE pf.purchaseOrderNumber = ?
             ORDER BY pf.id DESC`,
            [sale.purchaseOrderNumber]
          );
          freebies = (fbRows || []).map((f: any) => ({
            id: f.id,
            product_id: f.product_id,
            name: f.name ?? f.product_name ?? null,
            qty: Number(f.qty ?? 0),
            sku: f.sku ?? f.product_sku ?? null,
            price: Number(f.price ?? 0),
            purchaseOrderNumber: f.purchaseOrderNumber ?? null,
          }));
        }
      } catch (e) {
        console.warn('Failed to fetch freebies for sale', e);
      }

      // fetch agent row if sale has an agent_id
      let agent: any = null;
      try {
        if (sale.agent_id) {
          agent = await db.get(`SELECT id, fullName, phone, status, createdOn FROM agents WHERE id = ?`, [sale.agent_id]);
        }
      } catch (e) {
        console.warn('Failed to fetch agent for sale', e);
      }

      const result = { ...sale, agentCommission: sale.agentCommission ?? null, agent: agent ? { id: agent.id, fullName: agent.fullName, phone: agent.phone, status: agent.status } : null, customer, products: mappedItems, freebies, totalDiscount, grandTotal, netTotal };
      delete (result as any).customer_id;
      delete (result as any).customer_fullName;
      delete (result as any).customer_email;
      delete (result as any).customer_phoneNumber;
      delete (result as any).customer_country;
      delete (result as any).customer_status;
      delete (result as any).agent_id;

      res.json(result);
    } catch (err) {
      console.error("GET /api/sales/:id error:", err);
      res.status(500).json({ error: "Failed to fetch sale" });
    }
  });

  app.put('/api/sales/:id', async (req, res) => {
    const { id } = req.params;
    try {
      // Fetch existing sale with current PO/category for decisions below
      const existing = await db.get(
        `SELECT id, purchaseOrderNumber, category FROM sales WHERE id = ?`,
        [id]
      );
      if (!existing) return res.status(404).json({ error: "Sale not found" });

      const {
        saleDate,
        paymentStatus,
        salesChannel,
        customer_id,
        receiptNo,
        purchaseOrderNumber,
        category,
        agentId,
        paymentOption,
        address,
        notes,
        agentCommission,
        deliveryOption,
        products = []
      } = req.body as any;

      // Preserve current PO unless an explicit new one is provided.
      const oldPO: string | null = existing.purchaseOrderNumber || null;
      let poToUse: string | null =
        (purchaseOrderNumber !== undefined && purchaseOrderNumber !== null && String(purchaseOrderNumber).trim() !== "")
          ? String(purchaseOrderNumber).trim()
          : oldPO;

      // Only generate a new PO if neither old nor incoming exists
      if (!poToUse) {
        const prefix = await computeCategoryPrefix(db, category || existing.category);
        poToUse = await generatePurchaseOrderNumber(db, prefix);
      }

      // Ensure paymentStatus is never written as null; default to "Unpaid" when missing
      const paymentStatusToWrite = (paymentStatus !== undefined && paymentStatus !== null) ? paymentStatus : "Unpaid";
      await db.run(
        `UPDATE sales SET saleDate = ?, paymentStatus = ?, salesChannel = ?, customer_id = ?, receiptNo = ?, purchaseOrderNumber = ?, po_key = ?, category = ?, agent_id = ?, paymentOption = ?, address = ?, notes = ?, agentCommission = ?, deliveryOption = ? WHERE id = ?`,
        [saleDate ?? null, paymentStatusToWrite, salesChannel ?? null, customer_id ?? null, receiptNo ?? null, poToUse ?? null, poToUse ?? null, category ?? null, typeof agentId !== 'undefined' && agentId !== null && agentId !== '' ? agentId : null, paymentOption ?? null, address ?? null, notes ?? null, typeof agentCommission !== "undefined" && agentCommission !== null ? agentCommission : null, deliveryOption ?? null, id]
      );



      // If PO changed, cascade the change to payments and deliveries that reference the previous PO
      if (oldPO && poToUse && oldPO !== poToUse) {
        await db.run(`UPDATE payments   SET purchaseOrderNumber = ?, po_key = ? WHERE purchaseOrderNumber = ?`, [poToUse, poToUse, oldPO]);
        await db.run(`UPDATE deliveries SET purchaseOrderNumber = ?, po_key = ? WHERE purchaseOrderNumber = ?`, [poToUse, poToUse, oldPO]);
      }

      // Ensure a parent (0-amount) payment exists for this PO
      try {
        const parentCount = await db.get(
          `SELECT COUNT(*) AS c FROM payments WHERE purchaseOrderNumber = ? AND parentPaymentId IS NULL`,
          [poToUse]
        );
        if (!parentCount || Number(parentCount.c || 0) === 0) {
          await db.run(
            `INSERT INTO payments (amount, purchaseOrderNumber, po_key, paymentChannel, description, paymentDate, dueDate, attachment, referenceNo, parentPaymentId, createdOn)
             VALUES (0, ?, ?, '', 'Auto-created parent', NULL, NULL, '', '', NULL, NOW())`,
            [poToUse, poToUse]
          );
        }
      } catch (e) {
        console.warn("Ensure parent payment failed:", e);
      }

      if (Array.isArray(products)) {
        // remove and re-insert items
        await db.run(`DELETE FROM sale_items WHERE sale_id = ?`, [id]);
        if (products.length > 0) {
          for (const it of products) {
            const qty = Number(it.quantity ?? it.qty ?? 0);
            const price = Number(it.price ?? 0);
            const discount = Number(it.discount ?? 0);
            const tax = Number(it.tax ?? 0);
            const total =
              typeof it.total !== "undefined"
                ? Number(it.total)
                : (price - discount + tax) * qty;
            const productId = it.product_id ?? it.id ?? null;
            await db.run(
              `INSERT INTO sale_items (sale_id, product_id, quantity, price, discount, tax, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [id, productId, qty || null, price ?? null, discount ?? null, tax ?? null, total ?? null]
            );
          }
        }
      }

      // after update, fetch items and recompute totals to return a consistent item payload
      const updated = await db.get(`SELECT * FROM sales WHERE id = ?`, [id]);

      // fetch agent row if present
      let updatedAgent: any = null;
      try {
        if (updated && updated.agent_id) {
          updatedAgent = await db.get(`SELECT id, fullName, phone, status, createdOn FROM agents WHERE id = ?`, [updated.agent_id]);
        }
      } catch (e) {
        console.warn('Failed to fetch agent for updated sale', e);
      }

      const updatedItemsRows = await db.all(
        `SELECT
            si.id,
            si.product_id,
            si.quantity,
            si.price as unit_price,
            si.discount as line_discount,
            si.total as item_total,
            si.tax,
            p.sku,
            p.name as product_name,
            p.price as product_price,
            cpd.discount_value as customer_discount
         FROM sale_items si
         LEFT JOIN products p ON si.product_id = p.id
         LEFT JOIN sales s ON si.sale_id = s.id
         LEFT JOIN customer_product_discounts cpd
               ON cpd.customer_id = s.customer_id
              AND cpd.product_id = si.product_id
         WHERE si.sale_id = ?
         ORDER BY si.id ASC`,
        [id]
      );

      const updatedMapped = (updatedItemsRows || []).map((r: any) => {
        const unitPrice = Number(r.unit_price ?? r.product_price ?? 0);
        const qty = Number(r.quantity ?? 1);
        const perUnitDiscount = (() => {
          const ld = r.line_discount !== null && r.line_discount !== undefined ? Number(r.line_discount) : null;
          return (ld !== null && ld !== 0) ? ld : Number(r.customer_discount ?? 0);
        })();
        const tax = Number(r.tax ?? 0);
        const itemTotalFromDb =
          r.item_total !== undefined && r.item_total !== null
            ? Number(r.item_total)
            : null;
        const computedTotal = (unitPrice - perUnitDiscount + tax) * qty;
        // only trust DB item_total when it exactly (within rounding) matches computed total;
        // otherwise prefer recomputed value so discounts are applied consistently.
        const useDbTotal =
          itemTotalFromDb !== null &&
          Math.abs(Number(itemTotalFromDb) - Number(computedTotal)) < 0.005;
        const total = useDbTotal
          ? itemTotalFromDb
          : (unitPrice - perUnitDiscount + tax) * qty;
        return {
          id: r.id,
          product_id: r.product_id,
          sku: r.sku,
          name: r.product_name,
          price: unitPrice,
          quantity: qty,
          discount: perUnitDiscount,
          tax: tax,
          total: total
        };
      });

      const updatedGross = updatedMapped.reduce(
        (sum: number, it: any) =>
          sum +
          ((Number(it.price || 0) + Number(it.tax || 0)) *
            Number(it.quantity || 1)),
        0
      );
      const updatedNet = updatedMapped.reduce(
        (sum: number, it: any) => sum + Number(it.total || 0),
        0
      );
      const updatedTotalDiscount = Math.max(updatedGross - updatedNet, 0);
      const updatedGrandTotal = updatedGross;
      const updatedNetTotal = updatedNet;

      res.json({
        success: 1,
        item: {
          ...updated,
          agentCommission: updated.agentCommission ?? null,
          agent: updatedAgent ? { id: updatedAgent.id, fullName: updatedAgent.fullName, phone: updatedAgent.phone, status: updatedAgent.status } : null,
          products: updatedMapped,
          totalDiscount: updatedTotalDiscount,
          grandTotal: updatedGrandTotal,
          netTotal: updatedNetTotal,
        },
      });
    } catch (err) {
      console.error("Update sale failed:", err);
      res.status(500).json({ error: "Failed to update sale" });
    }
  });

  app.delete('/api/sales/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const existing = await db.get(
        `SELECT id,
                COALESCE(NULLIF(TRIM(po_key), ''), NULLIF(TRIM(purchaseOrderNumber), '')) AS po_key_norm
           FROM sales
          WHERE id = ?`,
        [id]
      );
      if (!existing) return res.status(404).json({ error: "Sale not found" });

      if (existing.po_key_norm) {
        await db.run(
          `DELETE FROM payments
            WHERE COALESCE(NULLIF(TRIM(po_key), ''), NULLIF(TRIM(purchaseOrderNumber), '')) = ?`,
          [existing.po_key_norm]
        );
        await db.run(
          `DELETE FROM deliveries
            WHERE COALESCE(NULLIF(TRIM(po_key), ''), NULLIF(TRIM(purchaseOrderNumber), '')) = ?`,
          [existing.po_key_norm]
        );
      }

      await db.run(`DELETE FROM sale_items WHERE sale_id = ?`, [id]);
      await db.run(`DELETE FROM sales WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("Delete sale failed:", err);
      res.status(500).json({ error: "Failed to delete sale" });
    }
  });

  // Return distinct PO numbers for sales that are Unpaid or Partial
  app.get('/api/sales/unpaid/po-numbers', async (req, res) => {
    try {
      const rows = await db.all(
        `SELECT DISTINCT purchaseOrderNumber
         FROM sales
         WHERE paymentStatus IN (?, ?)
           AND purchaseOrderNumber IS NOT NULL
         ORDER BY purchaseOrderNumber ASC`,
        ['Unpaid', 'Partial']
      );

      const poNumbers = (rows || []).map((r: any) => r.purchaseOrderNumber);
      res.json(poNumbers);
    } catch (err) {
      console.error("GET /api/sales/unpaid/po-numbers failed:", err);
      res.status(500).json({ error: "Failed to fetch unpaid PO numbers" });
    }
  });
}
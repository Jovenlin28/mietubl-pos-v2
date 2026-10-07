import express from "express";
import mysqlClient from "../db/mysqlClient";

export default function registerDeliveries(app: express.Express, db: any) {
  function normalizeDeliveryStatus(status: any): string {
    return (status || "").toString().trim().toLowerCase();
  }

  function isPickedUpStatus(status: string): boolean {
    return ["picked up", "picked_up", "pickedup"].includes(status);
  }

  /* Helper: Fetch sale (with customer + items summary) by PO */
  async function getSaleByPO(purchaseOrderNumber?: string | null) {
    if (!purchaseOrderNumber) return null;
    const po = purchaseOrderNumber.trim();
    try {
      const sale: any = await db.get(
        `SELECT s.*,
                c.id as customer_id, c.fullName as customer_fullName,
                c.email as customer_email, c.phoneNumber as customer_phoneNumber,
                c.storeName as customer_storeName, c.address as customer_address,
                c.country as customer_country, c.status as customer_status
           FROM sales s
           LEFT JOIN customers c ON c.id = s.customer_id
          WHERE TRIM(s.purchaseOrderNumber) = ?
          LIMIT 1`,
        [po]
      );
      if (!sale) return null;

      const items = await db.all(
        `SELECT id, product_id, quantity, price, discount, tax, total
           FROM sale_items
          WHERE sale_id = ?`,
        [sale.id]
      );

      const products = (items || []).map((r: any) => {
        const unitPrice = Number(r.price || 0);
        const qty = Number(r.quantity || 1);
        const discount = Number(r.discount || 0);
        const tax = Number(r.tax || 0);
        const total =
          r.total != null
            ? Number(r.total)
            : (unitPrice - discount + tax) * qty;
        return {
          id: r.id,
          product_id: r.product_id,
          price: unitPrice,
          quantity: qty,
          discount,
          tax,
          total,
        };
      });

      const gross = products.reduce(
        (s: number, it: any) => s + (it.price + it.tax) * it.quantity,
        0
      );
      const net = products.reduce((s: number, it: any) => s + it.total, 0);
      const totalDiscount = Math.max(gross - net, 0);

      const customer = sale.customer_id
        ? {
            id: sale.customer_id,
            fullName: sale.customer_fullName,
            email: sale.customer_email,
            phoneNumber: sale.customer_phoneNumber,
            storeName: sale.customer_storeName,
            address: sale.customer_address,
            country: sale.customer_country,
            status: sale.customer_status,
          }
        : null;

      return {
        ...sale,
        customer,
        products,
        grandTotal: gross,
        totalDiscount,
        netTotal: net,
      };
    } catch (e) {
      console.error("getSaleByPO failed:", po, e);
      return null;
    }
  }

  /* Normalize date/time into MySQL DATETIME (YYYY-MM-DD HH:MM:SS) */
  function toMySQLDateTime(val: any): string | null {
    if (!val) return null;
    if (
      typeof val === "string" &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)
    )
      return val; // already fine
    // Accept truncated forms like YYYY-MM-DDTHH:mm
    if (
      typeof val === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val)
    ) {
      val = val + ":00";
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // LIST
  app.get("/api/deliveries", async (req, res) => {
    try {
      const perPage = Math.max(1, parseInt(req.query.perPage as string) || 10);
      const currentPage = Math.max(
        1,
        parseInt(req.query.currentPage as string) || 1
      );
      const offset = (currentPage - 1) * perPage;
      const search = (req.query.search as string) || "";
      const status = (req.query.status as string) || "";
      const fromDate = (req.query.fromDate as string) || "";
      const toDate = (req.query.toDate as string) || "";

      const where: string[] = [];
      const params: any[] = [];

      if (search.trim()) {
        where.push(
          "(d.purchaseOrderNumber LIKE ? OR d.method LIKE ? OR d.status LIKE ?)"
        );
        const like = `%${search.trim()}%`;
        params.push(like, like, like);
      }
      if (status.trim()) {
        where.push("d.status = ?");
        params.push(status.trim());
      }
      if (fromDate) {
        where.push("DATE(d.createdOn) >= ?");
        params.push(fromDate);
      }
      if (toDate) {
        where.push("DATE(d.createdOn) <= ?");
        params.push(toDate);
      }
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const allowedSort: Record<string, string> = {
        purchaseOrderNumber: "d.purchaseOrderNumber",
        createdOn: "d.createdOn",
        status: "d.status",
        // added delivery date columns for sorting
        dateProcessed: "d.processedDate",
        datePickedUp: "d.pickedUpDate",
        dateDelivered: "d.deliveredDate",
        // customer/store/address/method sorting (join customers via sales)
        customer: "COALESCE(c.fullName, '')",
        storeName: "COALESCE(c.storeName, '')",
        address: "COALESCE(c.address, '')",
        method: "d.method",
      };
      const rawSortBy = (req.query.sortBy as string) || "";
      const rawSortDir =
        ((req.query.sortDir as string) || "").toUpperCase() === "ASC"
          ? "ASC"
          : "DESC";

      // Special ordering for status: Pending (1), Processed (2), Picked Up (3), Delivered (4), others (5)
      let orderClause: string;
      if (rawSortBy === "status") {
        orderClause = `ORDER BY CASE
            WHEN UPPER(TRIM(d.status)) = 'PENDING' THEN 1
            WHEN UPPER(TRIM(d.status)) = 'PROCESSED' THEN 2
            WHEN UPPER(TRIM(d.status)) IN ('PICKED UP','PICKED_UP','PICKEDUP') THEN 3
            WHEN UPPER(TRIM(d.status)) = 'DELIVERED' THEN 4
            ELSE 5
          END ${rawSortDir}, d.id DESC`;
      } else {
        const sortCol = allowedSort[rawSortBy] || "d.createdOn";
        orderClause = `ORDER BY ${sortCol} ${rawSortDir}, d.id DESC`;
      }

      const totalRow = await db.get(
        `SELECT COUNT(*) as count FROM deliveries d ${whereClause}`,
        params
      );
      const total = totalRow?.count || 0;

      const rows = await db.all(
        `SELECT d.* FROM deliveries d
         LEFT JOIN sales s ON TRIM(d.purchaseOrderNumber) = TRIM(s.purchaseOrderNumber)
         LEFT JOIN customers c ON s.customer_id = c.id
         ${whereClause}
         ${orderClause}
         LIMIT ${perPage} OFFSET ${offset}`,
        params
      );

      // Enrich each with sale + customer
      const enriched = await Promise.all(
        rows.map(async (r: any) => {
          const sale = await getSaleByPO(r.purchaseOrderNumber);
          return { ...r, sale, customer: sale?.customer || null };
        })
      );

      res.json({ items: enriched, total });
    } catch (err) {
      console.error("GET /api/deliveries failed:", err);
      res.status(500).json({ error: "Failed to fetch deliveries" });
    }
  });

  // GET ONE
  app.get("/api/deliveries/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const row = await db.get(`SELECT * FROM deliveries WHERE id = ?`, [id]);
      if (!row) return res.status(404).json({ error: "Delivery not found" });
      const sale = await getSaleByPO(row.purchaseOrderNumber);
      res.json({ ...row, sale, customer: sale?.customer || null });
    } catch (err) {
      console.error("GET /api/deliveries/:id failed:", err);
      res.status(500).json({ error: "Failed to fetch delivery" });
    }
  });

  // CREATE
  app.post("/api/deliveries", async (req, res) => {
    try {
      const { purchaseOrderNumber, method, status, attachment, date, trackingNumber } =
        req.body || {};

      const st = (status || "").toString().toLowerCase();
      const normalizedDate = toMySQLDateTime(date) || toMySQLDateTime(new Date());

      // Decide which date column gets a value
      const processedDate =
        st === "processed" ? normalizedDate : null;
      const pickedUpDate =
        ["picked up", "picked_up", "pickedup"].includes(st)
          ? normalizedDate
          : null;
      const deliveredDate =
        st === "delivered" ? normalizedDate : null;

      // Decide which attachment column gets value
      const processedAttachment =
        st === "processed" ? attachment || null : null;
      const pickedUpAttachment =
        ["picked up", "picked_up", "pickedup"].includes(st)
          ? attachment || null
          : null;
      const deliveredAttachment =
        st === "delivered" ? attachment || null : null;

      const result = await db.run(
        `INSERT INTO deliveries
          (purchaseOrderNumber, method, status, trackingNumber, createdOn,
           processedAttachment, pickedUpAttachment, deliveredAttachment,
           processedDate, pickedUpDate, deliveredDate)
         VALUES ( ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ? )`,
        [
          (purchaseOrderNumber || "").trim() || null,
          method || null,
          status || null,
          (trackingNumber || "").toString().trim() || null,
          processedAttachment,
          pickedUpAttachment,
          deliveredAttachment,
          processedDate,
          pickedUpDate,
          deliveredDate,
        ]
      );

      const newId = result?.insertId || result?.lastID;
      const created = await db.get(
        `SELECT * FROM deliveries WHERE id = ?`,
        [newId]
      );
      const sale = await getSaleByPO(created.purchaseOrderNumber);
      res
        .status(201)
        .json({ success: 1, item: { ...created, sale, customer: sale?.customer || null } });
    } catch (err) {
      console.error("POST /api/deliveries failed:", err);
      res.status(500).json({ error: "Failed to create delivery" });
    }
  });

  // UPDATE
  app.put("/api/deliveries/:id", async (req, res) => {
    let conn: any = null;

    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
      }

      const pool = await (mysqlClient as any).initPool();
      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [existingRows]: any = await conn.execute(
        `SELECT * FROM deliveries WHERE id = ? FOR UPDATE`,
        [id]
      );
      const existing = Array.isArray(existingRows) && existingRows.length ? existingRows[0] : null;
      if (!existing) {
        await conn.rollback();
        return res.status(404).json({ error: "Delivery not found" });
      }

      const { purchaseOrderNumber, method, status, attachment, date } =
        req.body || {};
      const { trackingNumber } = req.body || {};
      // Fall back to existing values so partial updates (e.g. status-only) don't wipe columns
      const effectivePurchaseOrderNumber =
        typeof purchaseOrderNumber !== "undefined"
          ? purchaseOrderNumber
          : existing.purchaseOrderNumber;
      const effectiveMethod =
        typeof method !== "undefined" ? method : existing.method;
      const effectiveStatus =
        typeof status !== "undefined" ? status : existing.status;
      const effectiveTrackingNumber =
        typeof trackingNumber !== "undefined"
          ? trackingNumber
          : existing.trackingNumber;
      const po = (effectivePurchaseOrderNumber || "").toString().trim() || null;
      const st = normalizeDeliveryStatus(effectiveStatus);
      const wasAlreadyProcessed =
        normalizeDeliveryStatus(existing.status) === "processed";
      const normalizedDate = toMySQLDateTime(date) || toMySQLDateTime(new Date());

      const setParts: string[] = [
        "purchaseOrderNumber = ?",
        "method = ?",
        "status = ?",
        "trackingNumber = ?",
      ];
      const params: any[] = [
        po,
        effectiveMethod || null,
        effectiveStatus || null,
        (effectiveTrackingNumber || "").toString().trim() || null,
      ];

      // Attachments (only replace the one relevant to status if provided)
      if (typeof attachment !== "undefined") {
        if (st === "processed") {
          setParts.push(
            attachment === null
              ? "processedAttachment = NULL"
              : "processedAttachment = ?"
          );
          if (attachment !== null) params.push(attachment);
        } else if (isPickedUpStatus(st)) {
          setParts.push(
            attachment === null
              ? "pickedUpAttachment = NULL"
              : "pickedUpAttachment = ?"
          );
          if (attachment !== null) params.push(attachment);
        } else if (st === "delivered") {
          setParts.push(
            attachment === null
              ? "deliveredAttachment = NULL"
              : "deliveredAttachment = ?"
          );
          if (attachment !== null) params.push(attachment);
        }
      }

      // Date column updates
      if (st === "processed") {
        setParts.push("processedDate = ?");
        params.push(normalizedDate);
      } else if (isPickedUpStatus(st)) {
        setParts.push("pickedUpDate = ?");
        params.push(normalizedDate);
      } else if (st === "delivered") {
        setParts.push("deliveredDate = ?");
        params.push(normalizedDate);
      }

      params.push(id);
      await conn.execute(`UPDATE deliveries SET ${setParts.join(", ")} WHERE id = ?`, params);

      // Inventory adjustment if newly processed (only decrement once, not on every re-save while processed)
      if (st === "processed" && !wasAlreadyProcessed) {
        if (po) {
          const [saleRows]: any = await conn.execute(
            `SELECT id FROM sales WHERE TRIM(purchaseOrderNumber) = ? LIMIT 1 FOR UPDATE`,
            [po]
          );
          const sale = Array.isArray(saleRows) && saleRows.length ? saleRows[0] : null;

          if (!sale?.id) {
            throw new Error(`Cannot process delivery: sale not found for purchase order '${po}'`);
          }

          const [saleItemsRows]: any = await conn.execute(
            `SELECT product_id, quantity FROM sale_items WHERE sale_id = ?`,
            [sale.id]
          );

          const deductionByProduct = new Map<number, number>();
          for (const it of saleItemsRows || []) {
            const productId = Number(it.product_id || 0);
            const dec = Number(it.quantity || 0);
            if (Number.isInteger(productId) && productId > 0 && Number.isFinite(dec) && dec > 0) {
              deductionByProduct.set(productId, (deductionByProduct.get(productId) || 0) + dec);
            }
          }

          const [freebiesRows]: any = await conn.execute(
            `SELECT product_id, qty FROM product_freebies WHERE TRIM(purchaseOrderNumber) = ?`,
            [po]
          );
          for (const fb of freebiesRows || []) {
            const productId = Number(fb.product_id || 0);
            const decFb = Number(fb.qty || 0);
            if (Number.isInteger(productId) && productId > 0 && Number.isFinite(decFb) && decFb > 0) {
              deductionByProduct.set(productId, (deductionByProduct.get(productId) || 0) + decFb);
            }
          }

          for (const [productId, dec] of deductionByProduct.entries()) {
            await conn.execute(
              `UPDATE products
                  SET qty = GREATEST(0, COALESCE(qty,0) - ?)
                WHERE id = ?`,
              [dec, productId]
            );
          }
        }
      }

      const [updatedRows]: any = await conn.execute(
        `SELECT * FROM deliveries WHERE id = ?`,
        [id]
      );
      const updated = Array.isArray(updatedRows) && updatedRows.length ? updatedRows[0] : null;

      await conn.commit();

      const sale = await getSaleByPO(updated.purchaseOrderNumber);
      res.json({
        success: 1,
        item: { ...updated, sale, customer: sale?.customer || null },
      });
    } catch (err) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (_) {
          // ignore rollback errors
        }
      }
      console.error("PUT /api/deliveries/:id failed:", err);
      res.status(500).json({ error: "Failed to update delivery" });
    } finally {
      if (conn) conn.release();
    }
  });

  // DELETE
  app.delete("/api/deliveries/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.get(
        `SELECT id FROM deliveries WHERE id = ?`,
        [id]
      );
      if (!existing)
        return res.status(404).json({ error: "Delivery not found" });
      await db.run(`DELETE FROM deliveries WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("DELETE /api/deliveries/:id failed:", err);
      res.status(500).json({ error: "Failed to delete delivery" });
    }
  });
}
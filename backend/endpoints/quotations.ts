import express from "express";

export default function registerQuotations(app: express.Express, db: any,) {
  app.get("/api/quotations", async (req, res) => {
    
    try {
      const perPage = parseInt(req.query.perPage as string) || 10;
      const currentPage = parseInt(((req.query.currentPage ?? req.query.page) as string) || "") || 1;
      const offset = (currentPage - 1) * perPage;
      const search = (req.query.search as string)?.trim();
      const fromDate = (req.query.fromDate as string)?.trim();
      const toDate = (req.query.toDate as string)?.trim();
      const sortBy = (req.query.sortBy as string || "").trim();
      const sortDirRaw = (req.query.sortDir as string || "desc").toUpperCase();
      const sortDir = sortDirRaw === "ASC" ? "ASC" : "DESC";

      // If sorting by grandTotal we need a subquery join to aggregate item totals
      const joinTotals = sortBy === "grandTotal"
        ? `LEFT JOIN (
             SELECT quotation_id, SUM(total) AS grand_total
             FROM quotation_items
             GROUP BY quotation_id
           ) t ON t.quotation_id = q.id`
        : "";

      // choose order clause
      let orderClause = "ORDER BY q.id DESC";
      if (sortBy === "createdOn") {
        orderClause = `ORDER BY q.createdOn ${sortDir}`;
      } else if (sortBy === "grandTotal") {
        // use COALESCE to treat NULL as 0 so ordering is predictable
        orderClause = `ORDER BY COALESCE(t.grand_total, 0) ${sortDir}`;
      }

      const conditions: string[] = [];
      const params: any[] = [];
      if (search) {
        // search in quotation notes, customer name, or product name / sku of any item in the quotation
        conditions.push(`(
          q.notes LIKE ? OR
          c.fullName LIKE ? OR
          EXISTS(
            SELECT 1 FROM quotation_items qi2
            JOIN products p2 ON qi2.product_id = p2.id
            WHERE qi2.quotation_id = q.id
              AND (
                p2.name LIKE ? OR
                p2.sku LIKE ?
              )
          )
        )`);
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (fromDate) {
        conditions.push("q.quotationDate >= ?");
        params.push(fromDate);
      }
      if (toDate) {
        // if only date (YYYY-MM-DD) provided, include end of day
        const toParam = /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? `${toDate} 23:59:59` : toDate;
        conditions.push("q.quotationDate <= ?");
        params.push(toParam);
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const totalRow: any = await db.get(
        `SELECT COUNT(*) as count FROM quotations q LEFT JOIN customers c ON q.customer_id = c.id ${whereClause}`,
        params.length ? params : undefined
      );
      const total = totalRow ? totalRow.count : 0;

      const listSql = `
        SELECT q.id, q.customer_id, q.quotationDate, q.notes, q.termsOfPayment, q.createdOn, q.status,
               c.fullName as customer_name, c.phoneNumber as customer_phone, c.email as customer_email,
               c.storeName as customer_storeName, c.address as customer_address, c.tinNumber as customer_tinNumber, c.company as customer_company,
               ${sortBy === "grandTotal" ? "COALESCE(t.grand_total,0) as grand_total" : "0 as grand_total"}
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        ${joinTotals}
        ${whereClause}
        ${orderClause}
        LIMIT ${perPage} OFFSET ${offset}
      `;
      const rows: any[] = await db.all(listSql, params.length ? params : undefined);

      // fetch items for all returned quotations and compute totals
      const quotationIds = (rows || []).map(r => r.id).filter(Boolean);
      const itemsMap: Record<number, any[]> = {};

      if (quotationIds.length > 0) {
        const placeholders = quotationIds.map(() => "?").join(",");
        const qiSql = `
          SELECT
            qi.id,
            qi.quotation_id,
            qi.product_id,
            qi.quantity,
            qi.price as unit_price,
            qi.total as item_total,
            p.name as product_name,
            p.sku as product_sku,
            p.price as product_price,
            cpd.discount_value as customer_discount
          FROM quotation_items qi
          LEFT JOIN products p ON qi.product_id = p.id
          LEFT JOIN quotations q ON qi.quotation_id = q.id
          LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = q.customer_id AND cpd.product_id = qi.product_id
          WHERE qi.quotation_id IN (${placeholders})
          ORDER BY qi.id DESC
        `;
        const qiRows = await db.all(qiSql, quotationIds);
        for (const r of (qiRows || [])) {
          const qid = Number(r.quotation_id);
          itemsMap[qid] = itemsMap[qid] || [];
          const unitPrice = Number(r.unit_price ?? r.product_price ?? 0);
          const qty = Number(r.quantity ?? 1) || 1;
          const discountPerUnit = Number(r.customer_discount ?? 0);
          const total = Number(r.item_total ?? ((unitPrice - discountPerUnit) * qty));
          itemsMap[qid].push({
            id: r.id,
            product_id: r.product_id,
            sku: r.product_sku,
            name: r.product_name,
            price: unitPrice,
            quantity: qty,
            discount: discountPerUnit,
            total
          });
        }
      }

        const items = (rows || []).map(r => {
        const qi = itemsMap[r.id] || [];
        const totalDiscount = qi.reduce((sum: number, it: any) => sum + (Number(it.discount || 0) * Number(it.quantity || 1)), 0);
        // grandTotal should be gross (price * qty), ignoring per-item discounts
        const grandTotal = qi.reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
        const netTotal = Number(grandTotal || 0) - Number(totalDiscount || 0);
        return {
          id: r.id,
          quotationDate: r.quotationDate,
          notes: r.notes,
          termsOfPayment: r.termsOfPayment,
          createdOn: r.createdOn,
          status: r.status,
          customer: r.customer_id
            ? {
                id: r.customer_id,
                fullName: r.customer_name,
                phoneNumber: r.customer_phone,
                email: r.customer_email,
                storeName: r.customer_storeName,
                address: r.customer_address,
                tinNumber: r.customer_tinNumber,
                company: r.customer_company,
              }
            : null,
          products: qi,
          totalDiscount,
          grandTotal,
          netTotal,
        };
      });

      res.json({ items, total });
    } catch (err) {
      console.error("GET /api/quotations failed:", err);
      res.status(500).json({ error: "Failed to fetch quotations" });
    }
  });

  app.get("/api/quotations/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      const q = await db.get(
        `SELECT q.id, q.customer_id, q.quotationDate, q.notes, q.termsOfPayment, q.createdOn, q.status, c.fullName as customer_name, c.email as customer_email
         FROM quotations q
         LEFT JOIN customers c ON q.customer_id = c.id
         WHERE q.id = ?`,
        [id]
      );
      if (!q) return res.status(404).json({ error: "Quotation not found" });

      const items = await db.all(
        `
        SELECT
          qi.id,
          qi.quotation_id,
          qi.product_id,
          qi.quantity,
          qi.price as unit_price,
          qi.total as item_total,
          p.name as product_name,
          p.sku as product_sku,
          p.price as product_price,
          cpd.discount_value as customer_discount
        FROM quotation_items qi
        LEFT JOIN products p ON qi.product_id = p.id
        LEFT JOIN quotations q ON qi.quotation_id = q.id
        LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = q.customer_id AND cpd.product_id = qi.product_id
        WHERE qi.quotation_id = ?
        `,
        [id]
      );

      q.items = (items || []).map((r: any) => ({
        id: r.id,
        quotation_id: r.quotation_id,
        product_id: r.product_id,
        name: r.product_name,
        sku: r.product_sku,
        price: Number(r.unit_price ?? r.product_price ?? 0),
        quantity: Number(r.quantity ?? 1),
        discount: Number(r.customer_discount ?? 0),
        total: Number(r.item_total ?? 0),
      }));

  q.totalDiscount = (q.items || []).reduce((sum: number, it: any) => sum + (Number(it.discount || 0) * Number(it.quantity || 1)), 0);
  // grandTotal as gross (price * qty)
  q.grandTotal = (q.items || []).reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
  q.netTotal = Number(q.grandTotal || 0) - Number(q.totalDiscount || 0);

      res.json(q);
    } catch (err) {
      console.error("Fetch quotation failed:", err);
      res.status(500).json({ error: "Failed to fetch quotation" });
    }
  });

  app.post("/api/quotations", async (req, res) => {
    try {
      const { customer_id, quotationDate, notes, termsOfPayment, status, items = [] } = req.body;
      const result = await db.run(
        `INSERT INTO quotations (customer_id, quotationDate, notes, termsOfPayment, createdOn, status)
         VALUES (?, ?, ?, ?, NOW(), ?)`,
        [customer_id ?? null, quotationDate, notes ?? null, termsOfPayment ?? null, status ?? null]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      // insert items if provided (use db.run per row instead of prepare)
      if (Array.isArray(items) && items.length > 0) {
        for (const it of items) {
          const qty = Number(it.quantity ?? 0);
          const price = Number(it.price ?? 0);
          const discount = Number(it.discount ?? 0);
          const total = typeof it.total !== "undefined" ? Number(it.total) : (price - discount) * qty;
          await db.run(
            `INSERT INTO quotation_items (quotation_id, product_id, quantity, price, discount, total)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [newId, it.product_id ?? null, qty, price, discount, total]
          );
        }
      }
      const created = await db.get(`SELECT * FROM quotations WHERE id = ?`, [newId]);
      const createdItems = await db.all(
        `SELECT qi.id, qi.quotation_id, qi.product_id, qi.quantity, qi.price as unit_price, qi.total as item_total,
                p.name as product_name, p.sku as product_sku
         FROM quotation_items qi
         LEFT JOIN products p ON qi.product_id = p.id
         WHERE qi.quotation_id = ?`,
        [newId]
      );
      created.items = (createdItems || []).map((r: any) => ({
        id: r.id,
        quotation_id: r.quotation_id,
        product_id: r.product_id,
        name: r.product_name,
        sku: r.product_sku,
        price: Number(r.unit_price ?? 0),
        quantity: Number(r.quantity ?? 1),
        discount: 0,
        total: Number(r.item_total ?? 0),
      }));
      const createdTotalDiscount = (created.items || []).reduce((sum: number, it: any) => sum + (Number(it.discount || 0) * Number(it.quantity || 1)), 0);
      const createdGrandTotal = (created.items || []).reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
      const createdNetTotal = Number(createdGrandTotal || 0) - Number(createdTotalDiscount || 0);
      res.status(201).json({ success: 1, item: { ...created, totalDiscount: createdTotalDiscount, grandTotal: createdGrandTotal, netTotal: createdNetTotal } });
    } catch (err) {
      console.error("Create quotation failed:", err);
      res.status(500).json({ error: "Failed to create quotation" });
    }
  });

  app.put("/api/quotations/:id", async (req, res) => {
    
    const { id } = req.params;
    const { customer_id, quotationDate, notes, termsOfPayment, status, items } = req.body as any;
    try {
      const existing = await db.get(`SELECT id FROM quotations WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Quotation not found" });

      await db.run(
        `UPDATE quotations SET customer_id = ?, quotationDate = ?, notes = ?, termsOfPayment = ?, status = ? WHERE id = ?`,
        [customer_id ?? null, quotationDate ?? null, notes ?? null, termsOfPayment ?? null, status ?? null, id]
      );

      if (Array.isArray(items)) {
        await db.run(`DELETE FROM quotation_items WHERE quotation_id = ?`, [id]);
        if (items.length > 0) {
          for (const it of items) {
            const qty = Number(it.quantity ?? 0);
            const price = Number(it.price ?? 0);
            const discount = Number(it.discount ?? 0);
            const total = typeof it.total !== "undefined" ? Number(it.total) : (price - discount) * qty;
            await db.run(
              `INSERT INTO quotation_items (quotation_id, product_id, quantity, price, discount, total)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [id, it.product_id ?? null, qty, price, discount, total]
            );
          }
        }
      }

      const updated = await db.get(`SELECT * FROM quotations WHERE id = ?`, [id]);
      // fetch updated items and compute totals
      const updatedItems = await db.all(
        `SELECT qi.id, qi.quotation_id, qi.product_id, qi.quantity, qi.price as unit_price, qi.total as item_total, p.name as product_name, p.sku as product_sku
         FROM quotation_items qi
         LEFT JOIN products p ON qi.product_id = p.id
         WHERE qi.quotation_id = ?`,
        [id]
      );
      const mappedUpdated = (updatedItems || []).map((r: any) => ({
        id: r.id,
        quotation_id: r.quotation_id,
        product_id: r.product_id,
        name: r.product_name,
        sku: r.product_sku,
        price: Number(r.unit_price ?? 0),
        quantity: Number(r.quantity ?? 1),
        discount: 0,
        total: Number(r.item_total ?? 0),
      }));
      const updatedTotalDiscount = (mappedUpdated || []).reduce((sum: number, it: any) => sum + (Number(it.discount || 0) * Number(it.quantity || 1)), 0);
      const updatedGrandTotal = (mappedUpdated || []).reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
      const updatedNetTotal = Number(updatedGrandTotal || 0) - Number(updatedTotalDiscount || 0);
      res.json({ success: 1, item: { ...updated, items: mappedUpdated, totalDiscount: updatedTotalDiscount, grandTotal: updatedGrandTotal, netTotal: updatedNetTotal } });
    } catch (err) {
      console.error("Update quotation failed:", err);
      res.status(500).json({ error: "Failed to update quotation" });
    }
  });

  app.delete("/api/quotations/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      const existing = await db.get(`SELECT id FROM quotations WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Quotation not found" });
      await db.run(`DELETE FROM quotation_items WHERE quotation_id = ?`, [id]);
      await db.run(`DELETE FROM quotations WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("Delete quotation failed:", err);
      res.status(500).json({ error: "Failed to delete quotation" });
    }
  });
}
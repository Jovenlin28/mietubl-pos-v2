import express from "express";

export default function registerStockInLog(app: express.Express, db: any,) {
  app.get("/api/stock-in-log", async (req, res) => {
    
    try {
      const perPage = parseInt(req.query.perPage as string) || 10;
      // accept either currentPage or page query param
      const currentPage = parseInt(((req.query.currentPage ?? req.query.page) as string) || "") || 1;
      const offset = (currentPage - 1) * perPage;
      const search = (req.query.search as string)?.trim();

      let whereClause = "";
      const params: any[] = [];
      if (search) {
        whereClause = "WHERE p.name LIKE ?";
        params.push(`%${search}%`);
      }

      const totalRow = await db.get(
        `SELECT COUNT(*) as count FROM stock_in_log sil LEFT JOIN products p ON sil.product_id = p.id ${whereClause}`,
        params.length ? params : undefined
      );
      const total = totalRow ? totalRow.count : 0;

      // interpolate numeric LIMIT/OFFSET to avoid placeholder binding issues
      const listSql = `
        SELECT sil.id, sil.stock_in_date, sil.product_id, sil.stocks_added, sil.status, sil.notes, sil.createdBy, p.name as product_name
        FROM stock_in_log sil
        LEFT JOIN products p ON sil.product_id = p.id
        ${whereClause}
        ORDER BY sil.stock_in_date DESC
        LIMIT ${perPage} OFFSET ${offset}
      `;
      const logs = await db.all(listSql, params.length ? params : undefined);

      res.json({ items: logs, total });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch stock-in-log" });
    }
  });

  app.post("/api/stock-in-log", async (req, res) => {
    try {
      const { stock_in_date, product_id, stocks_added, status, notes, createdBy } = req.body;

      // basic validation
      if (!product_id) return res.status(400).json({ error: "product_id is required" });
      if (typeof stocks_added === "undefined" || stocks_added === null) return res.status(400).json({ error: "stocks_added is required" });

      // use server-side timestamp so it works across DB drivers (SQLite/MySQL)
      const createdOn = new Date().toISOString().slice(0, 19).replace("T", " ");

      const result = await db.run(
        `INSERT INTO stock_in_log (stock_in_date, product_id, stocks_added, status, notes, createdBy, createdOn)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [stock_in_date ?? null, product_id, stocks_added, status ?? null, notes ?? null, createdBy ?? null, createdOn]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM stock_in_log WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      console.error("Create stock-in-log failed:", err);
      res.status(500).json({ error: "Failed to create stock log" });
    }
  });

  app.get("/api/stock-in-log/product/:productId", async (req, res) => {
    
    const { productId } = req.params;
    try {
      const logs = await db.all(`SELECT id, stock_in_date, product_id, stocks_added, status, notes, createdBy, createdOn FROM stock_in_log WHERE product_id = ? ORDER BY stock_in_date DESC`, [productId]);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch stock-in-log for product" });
    }
  });

  app.put("/api/stock-in-log/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const stockInLog = await db.get(`SELECT product_id, stocks_added, status FROM stock_in_log WHERE id = ?`, [id]);
      if (!stockInLog) return res.status(404).json({ error: "Stock-in-log entry not found" });
      await db.run(`UPDATE stock_in_log SET status = ? WHERE id = ?`, [status, id]);
      if (stockInLog.status !== "Completed" && status === "Completed") {
        await db.run(`UPDATE products SET qty = qty + ? WHERE id = ?`, [stockInLog.stocks_added, stockInLog.product_id]);
      }
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to update stock-in-log status" });
    }
  });

  app.delete("/api/stock-in-log/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const stockInLog = await db.get(`SELECT id, product_id, stocks_added, status FROM stock_in_log WHERE id = ?`, [id]);
      if (!stockInLog) return res.status(404).json({ error: "Stock-in-log entry not found" });
      
      // If status is 'Completed', decrement product quantity since it was previously added
      if (stockInLog.status === "Completed") {
        await db.run(`UPDATE products SET qty = qty - ? WHERE id = ?`, [stockInLog.stocks_added, stockInLog.product_id]);
      }
      
      await db.run(`DELETE FROM stock_in_log WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete stock-in-log" });
    }
  });

  app.put("/api/stock-in-log/:id", async (req, res) => {
    const { id } = req.params;
    const { stock_in_date, stocks_added, notes } = req.body;
    try {
      const stockInLog = await db.get(`SELECT id, product_id, stocks_added, status FROM stock_in_log WHERE id = ?`, [id]);
      if (!stockInLog) return res.status(404).json({ error: "Stock-in-log entry not found" });
      
      // Basic validation
      if (typeof stocks_added !== "undefined" && (stocks_added === null || stocks_added === undefined)) {
        return res.status(400).json({ error: "stocks_added cannot be null or undefined" });
      }
      
      // If existing status is 'Completed' and stocks_added is being updated
      if (stockInLog.status === "Completed" && typeof stocks_added !== "undefined") {
        const delta = stocks_added - stockInLog.stocks_added;
        if (delta !== 0) {
          await db.run(`UPDATE products SET qty = qty + ? WHERE id = ?`, [delta, stockInLog.product_id]);
        }
      }
      
      // Build dynamic update query with only provided fields
      const updateFields = [];
      const updateParams = [];
      
      if (typeof stock_in_date !== "undefined") {
        updateFields.push("stock_in_date = ?");
        updateParams.push(stock_in_date);
      }
      
      if (typeof stocks_added !== "undefined") {
        updateFields.push("stocks_added = ?");
        updateParams.push(stocks_added);
      }
      
      if (typeof notes !== "undefined") {
        updateFields.push("notes = ?");
        updateParams.push(notes);
      }
      
      if (updateFields.length > 0) {
        updateParams.push(id);
        await db.run(`UPDATE stock_in_log SET ${updateFields.join(", ")} WHERE id = ?`, updateParams);
      }
      
      const updated = await db.get(`SELECT * FROM stock_in_log WHERE id = ?`, [id]);
      res.json({ success: 1, item: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update stock-in-log" });
    }
  });
}
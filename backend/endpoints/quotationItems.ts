import express from "express";

export default function registerQuotationItems(app: express.Express, db: any,) {
  app.get("/api/quotation-items", async (req, res) => {
    
    try {
      const quotationId = req.query.quotationId as string | undefined;
      if (quotationId) {
        const items = await db.all(`SELECT qi.id, qi.quotation_id, qi.product_id, qi.quantity, qi.price, qi.discount, qi.total, p.name as product_name FROM quotation_items qi LEFT JOIN products p ON qi.product_id = p.id WHERE qi.quotation_id = ? ORDER BY qi.id DESC`, [quotationId]);
        return res.json({ items });
      }
      const items = await db.all(`SELECT qi.id, qi.quotation_id, qi.product_id, qi.quantity, qi.price, qi.discount, qi.total, p.name as product_name FROM quotation_items qi LEFT JOIN products p ON qi.product_id = p.id ORDER BY qi.id DESC`);
      res.json({ items });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch quotation items" });
    }
  });

  app.get("/api/quotation-items/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      const item = await db.get(`SELECT qi.id, qi.quotation_id, qi.product_id, qi.quantity, qi.price, qi.discount, qi.total, p.name as product_name FROM quotation_items qi LEFT JOIN products p ON qi.product_id = p.id WHERE qi.id = ?`, [id]);
      if (!item) return res.status(404).json({ error: "Quotation item not found" });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch quotation item" });
    }
  });

  app.post("/api/quotation-items", async (req, res) => {
    try {
      const { quotation_id, product_id, quantity, price, discount, total } = req.body;
      const result = await db.run(
        `INSERT INTO quotation_items (quotation_id, product_id, quantity, price, discount, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [quotation_id, product_id, quantity, price, discount, total]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM quotation_items WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      res.status(500).json({ error: "Failed to create quotation item" });
    }
  });

  app.put("/api/quotation-items/:id", async (req, res) => {
    
    const { id } = req.params;
    const { product_id, quantity, price, discount, total } = req.body;
    try {
      const existing = await db.get(`SELECT id FROM quotation_items WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Quotation item not found" });
      const qty = Number(quantity ?? 0);
      const pr = Number(price ?? 0);
      const disc = Number(discount ?? 0);
      const tot = typeof total !== "undefined" ? Number(total) : (pr - disc) * qty;
      await db.run(
        `UPDATE quotation_items SET product_id = ?, quantity = ?, price = ?, discount = ?, total = ? WHERE id = ?`,
        [product_id ?? null, qty, pr, disc, tot, id]
      );
      const updated = await db.get(`SELECT * FROM quotation_items WHERE id = ?`, [id]);
      res.json({ success: 1, item: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update quotation item" });
    }
  });

  app.delete("/api/quotation-items/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      const existing = await db.get(`SELECT id FROM quotation_items WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Quotation item not found" });
      await db.run(`DELETE FROM quotation_items WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete quotation item" });
    }
  });
}
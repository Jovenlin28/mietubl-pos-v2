import express from "express";

export default function registerSaleItems(app: express.Express, db: any,) {
  app.get("/api/sale-items", async (req, res) => {
    
    try {
      const items = await db.all(`SELECT si.*, p.name as product_name, p.sku as product_sku FROM sale_items si LEFT JOIN products p ON si.product_id = p.id ORDER BY si.id DESC`);
      res.json({ items });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch sale items" });
    }
  });

  app.get("/api/sale-items/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const item = await db.get(`SELECT si.*, p.name as product_name FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.id = ?`, [id]);
      if (!item) return res.status(404).json({ error: "Sale item not found" });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch sale item" });
    }
  });

  app.post("/api/sale-items", async (req, res) => {
    try {
      const { sale_id, product_id, quantity, price, discount, tax, total } = req.body;
      const result = await db.run(
        `INSERT INTO sale_items (sale_id, product_id, quantity, price, discount, tax, total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sale_id, product_id, quantity, price, discount ?? null, tax ?? null, total ?? null]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM sale_items WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      res.status(500).json({ error: "Failed to create sale item" });
    }
  });

  app.put("/api/sale-items/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      const existing = await db.get(`SELECT id FROM sale_items WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Sale item not found" });

      const product_id = req.body.product_id ?? null;
      const quantity = Number(req.body.quantity ?? 0);
      const price = Number(req.body.price ?? 0);
      const discount = Number(req.body.discount ?? 0);
      const tax = Number(req.body.tax ?? 0);
      const total = typeof req.body.total !== "undefined" ? Number(req.body.total) : (price - discount + tax) * quantity;

      await db.run(
        `UPDATE sale_items SET product_id = ?, quantity = ?, price = ?, discount = ?, tax = ?, total = ? WHERE id = ?`,
        [product_id, quantity, price, discount, tax, total, id]
      );

      const updated = await db.get(`SELECT * FROM sale_items WHERE id = ?`, [id]);
      res.json({ success: 1, item: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update sale item" });
    }
  });

  app.delete("/api/sale-items/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      const existing = await db.get(`SELECT id FROM sale_items WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Sale item not found" });
      await db.run(`DELETE FROM sale_items WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete sale item" });
    }
  });
}
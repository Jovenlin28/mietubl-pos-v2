import express from "express";

export default function registerCategories(app: express.Express, db: any,) {
  app.get("/api/categories", async (req, res) => {
    
    try {
      const rows = await db.all(`SELECT id, name, categorySlug, createdOn, status FROM categories`);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Create category
  app.post("/api/categories", async (req, res) => {
    
    try {
      const { name, categorySlug, status } = req.body;
      if (!name || !String(name).trim()) return res.status(400).json({ error: "Name is required" });

      const slug = (categorySlug && String(categorySlug).trim()) ||
        String(name).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "");

      // use NOW() for createdOn
      const result = await db.run(
        `INSERT INTO categories (name, categorySlug, createdOn, status) VALUES (?, ?, NOW(), ?)`,
        [name.trim(), slug, status || "Active"]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT id, name, categorySlug, createdOn, status FROM categories WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Update category
  app.put("/api/categories/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      const { name, categorySlug, status } = req.body;

      const existing = await db.get(`SELECT id, name, categorySlug, createdOn, status FROM categories WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Category not found" });

      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Name is required" });
      }

      const slug = (categorySlug && String(categorySlug).trim()) ||
        String(name).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "");

      await db.run(
        `UPDATE categories SET name = ?, categorySlug = ?, status = ? WHERE id = ?`,
        [name.trim(), slug, status ?? existing.status, id]
      );

      const updated = await db.get(`SELECT id, name, categorySlug, createdOn, status FROM categories WHERE id = ?`, [id]);
      res.json({ success: 1, item: updated });
    } catch (err) {
      console.error("Update category failed:", err);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await db.run(`DELETE FROM categories WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });
}
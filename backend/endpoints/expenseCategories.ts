import express from "express";

export default function registerExpenseCategories(app: express.Express, db: any,) {
  // New: return all categories (no pagination) for dropdowns etc.
  app.get("/api/expense-categories/all", async (_req, res) => {
    
    try {
      const items = await db.all(`SELECT id, name, description FROM expense_categories ORDER BY name ASC`);
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  app.get("/api/expense-categories", async (req, res) => {
    
    try {
      const perPage = parseInt(req.query.perPage as string) || 10;
      const currentPage = parseInt(req.query.currentPage as string) || 1;
      const offset = (currentPage - 1) * perPage;
      const search = (req.query.search as string)?.trim();

      let whereClause = "";
      const params: any[] = [];
      if (search) {
        whereClause = "WHERE name LIKE ? OR description LIKE ?";
        params.push(`%${search}%`, `%${search}%`);
      }

      const totalRow = await db.get(`SELECT COUNT(*) as count FROM expense_categories ${whereClause}`, params.length ? params : undefined);
      const total = totalRow ? totalRow.count : 0;

      // interpolate numeric LIMIT/OFFSET to avoid placeholder/driver issues
      const listSql = `SELECT id, name, description FROM expense_categories ${whereClause} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`;
      const items = await db.all(listSql, params.length ? params : undefined);
      res.json({ items, total });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  app.get("/api/expense-categories/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      const item = await db.get(`SELECT id, name, description FROM expense_categories WHERE id = ?`, [id]);
      if (!item) return res.status(404).json({ error: "Expense category not found" });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch expense category" });
    }
  });

  app.post("/api/expense-categories", async (req, res) => {
    try {
      const { name, description } = req.body;
      const result = await db.run(
        `INSERT INTO expense_categories (name, description) VALUES (?, ?)`,
        [name, description]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM expense_categories WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      res.status(500).json({ error: "Failed to create expense category" });
    }
  });

  app.put("/api/expense-categories/:id", async (req, res) => {
    
    const { id } = req.params;
    const { name, description } = req.body;
    try {
      const existing = await db.get(`SELECT id FROM expense_categories WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Expense category not found" });
      await db.run(`UPDATE expense_categories SET name = ?, description = ? WHERE id = ?`, [name, description, id]);
      const updated = await db.get(`SELECT id, name, description FROM expense_categories WHERE id = ?`, [id]);
      res.json({ success: 1, item: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update expense category" });
    }
  });

  app.delete("/api/expense-categories/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      const existing = await db.get(`SELECT id FROM expense_categories WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Expense category not found" });
      await db.run(`DELETE FROM expense_categories WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete expense category" });
    }
  });
}

function CONCAT(description: any, arg1: null): any {
  throw new Error("Function not implemented.");
}

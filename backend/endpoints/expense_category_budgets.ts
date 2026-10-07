import express from "express";

export default function registerExpenseBudgets(app: express.Express, db: any) {
  // get current budget for category (existing)
  app.get("/api/expense-categories/:id/budgets/current", async (req, res) => {
    const { id } = req.params;
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    const dStr = date.toISOString().slice(0,10);
    try {
      const budget = await db.get(
        `SELECT * FROM expense_category_budgets WHERE category_id = ? AND period_start <= ? AND period_end >= ? LIMIT 1`,
        [id, dStr, dStr]
      );
      if (!budget) return res.json({ budget: null, spent: 0, remaining: 0 });

      const spentRow = await db.get(
        `SELECT COALESCE(SUM(totalCost),0) as spent FROM expenses WHERE purchaseDate BETWEEN ? AND ? AND (category_id = ? OR expenseCategory = (SELECT name FROM expense_categories WHERE id = ?))`,
        [budget.period_start, budget.period_end, id, id]
      );
      const spent = Number(spentRow?.spent || 0);
      const remaining = Number(budget.amount) - spent;
      res.json({ budget, spent, remaining });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to get budget" });
    }
  });

  // summary for all categories (existing)
  app.get("/api/expense-categories/budgets/summary", async (req, res) => {
    const date = req.query.date ? new Date(String(req.query.date)).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);
    try {
      // safer aggregate join: left join budgets and expenses, aggregate spent per category+budget
      const rows = await db.all(
        `SELECT
           c.id,
           c.name,
           b.id AS budget_id,
           b.amount AS budgetAmount,
           b.period_start,
           b.period_end,
           b.notes,
           COALESCE(SUM(CASE WHEN e.purchaseDate BETWEEN b.period_start AND b.period_end AND (e.category_id = c.id OR e.expenseCategory = c.name) THEN e.totalCost ELSE 0 END), 0) AS spent
         FROM expense_categories c
         LEFT JOIN expense_category_budgets b
           ON b.category_id = c.id AND b.period_start <= ? AND b.period_end >= ?
         LEFT JOIN expenses e
           ON (e.purchaseDate BETWEEN b.period_start AND b.period_end) AND (e.category_id = c.id OR e.expenseCategory = c.name)
         GROUP BY c.id, c.name, b.id, b.amount, b.period_start, b.period_end, b.notes
        `,
        [date, date]
      );

      const out = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        budgetId: r.budget_id || null,
        budget: Number(r.budgetAmount || 0),
        period_start: r.period_start,
        period_end: r.period_end,
        notes: r.notes,
        spent: Number(r.spent || 0),
        remaining: Number((r.budgetAmount || 0) - (r.spent || 0)),
      }));
      return res.json(out);
    } catch (err) {
      console.error("GET /api/expense-categories/budgets/summary error:", err);
      return res.status(500).json({ error: "Failed to fetch budgets summary", details: (err as any)?.message });
    }
  });

  // list all budgets
  app.get("/api/expense-category-budgets", async (req, res) => {
    try {
      const rows = await db.all(`SELECT b.*, c.name as categoryName FROM expense_category_budgets b JOIN expense_categories c ON c.id = b.category_id ORDER BY b.period_start DESC`);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to list budgets" });
    }
  });

  // create budget
  app.post("/api/expense-category-budgets", async (req, res) => {
    try {
      const { category_id, amount, period_start, period_end, notes } = req.body;
      if (!category_id || !amount || !period_start || !period_end) return res.status(400).json({ error: "Missing required fields" });
      const result = await db.run(
        `INSERT INTO expense_category_budgets (category_id, amount, period_start, period_end, notes, createdOn) VALUES (?, ?, ?, ?, ?, NOW())`,
        [category_id, amount, period_start, period_end, notes || null]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM expense_category_budgets WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      console.error("Failed to create budget:", err);
      res.status(500).json({ error: "Failed to create budget" });
    }
  });

  // update budget
  app.put("/api/expense-category-budgets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { category_id, amount, period_start, period_end, notes } = req.body;
      await db.run(
        `UPDATE expense_category_budgets SET category_id = ?, amount = ?, period_start = ?, period_end = ?, notes = ? WHERE id = ?`,
        [category_id, amount, period_start, period_end, notes || null, id]
      );
      const updated = await db.get(`SELECT * FROM expense_category_budgets WHERE id = ?`, [id]);
      res.json({ success: 1, item: updated });
    } catch (err) {
      console.error("Failed to update budget:", err);
      res.status(500).json({ error: "Failed to update budget" });
    }
  });

  // delete budget
  app.delete("/api/expense-category-budgets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.run(`DELETE FROM expense_category_budgets WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("Failed to delete budget:", err);
      res.status(500).json({ error: "Failed to delete budget" });
    }
  });
}
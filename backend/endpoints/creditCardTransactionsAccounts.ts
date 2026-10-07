import express from "express";

export default function registerCreditCardTransactionsAccounts(app: express.Express, db: any) {
  // List with pagination and search (search on store id or status)
  app.get("/api/credit-card-transactions-accounts", async (req, res) => {
    try {
      const perPage = parseInt(req.query.perPage as string) || 10;
      const currentPage = parseInt(((req.query.currentPage ?? req.query.page) as string) || "") || 1;
      const offset = (currentPage - 1) * perPage;
      const search = (req.query.search as string)?.trim();

      let whereClause = "";
      const params: any[] = [];
      if (search) {
        // allow numeric search for store id or text search for status
        if (/^\d+$/.test(search)) {
          whereClause = "WHERE store = ?";
          params.push(Number(search));
        } else {
          whereClause = "WHERE status LIKE ?";
          params.push(`%${search}%`);
        }
      }

      const totalRow = await db.get(
        `SELECT COUNT(*) as count FROM credit_card_transactions_accounts ${whereClause}`,
        params.length ? params : undefined
      );
      const total = totalRow ? totalRow.count : 0;

      const listSql = `
        SELECT id, store, status, createdOn
        FROM credit_card_transactions_accounts
        ${whereClause}
        ORDER BY id DESC
        LIMIT ${perPage} OFFSET ${offset}
      `;
      const items = await db.all(listSql, params.length ? params : undefined);
      res.json({ items, total });
    } catch (err) {
      console.error("Failed to fetch credit card transaction accounts:", err);
      res.status(500).json({ error: "Failed to fetch credit card transaction accounts" });
    }
  });

  // Create
  app.post("/api/credit-card-transactions-accounts", async (req, res) => {
    try {
      const { store, status } = req.body;
      const createdOn = new Date().toISOString().slice(0, 19).replace("T", " ");
      const result = await db.run(
        `INSERT INTO credit_card_transactions_accounts (store, status, createdOn) VALUES (?, ?, ?)`,
        [store ?? null, status ?? null, createdOn]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM credit_card_transactions_accounts WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      console.error("Create credit card transaction account failed:", err);
      res.status(500).json({ error: "Failed to create credit card transaction account" });
    }
  });

  // Get by id
  app.get("/api/credit-card-transactions-accounts/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const row = await db.get(`SELECT id, store, status, createdOn FROM credit_card_transactions_accounts WHERE id = ?`, [id]);
      if (!row) return res.status(404).json({ error: "Account not found" });
      res.json(row);
    } catch (err) {
      console.error("Fetch credit card transaction account failed:", err);
      res.status(500).json({ error: "Failed to fetch credit card transaction account" });
    }
  });

  // Update
  app.put("/api/credit-card-transactions-accounts/:id", async (req, res) => {
    const { id } = req.params;
    const { store, status } = req.body;
    try {
      const account = await db.get(`SELECT id FROM credit_card_transactions_accounts WHERE id = ?`, [id]);
      if (!account) return res.status(404).json({ error: "Account not found" });
      await db.run(
        `UPDATE credit_card_transactions_accounts SET store = ?, status = ? WHERE id = ?`,
        [store ?? null, status ?? null, id]
      );
      res.json({ success: 1 });
    } catch (err) {
      console.error("Update credit card transaction account failed:", err);
      res.status(500).json({ error: "Failed to update credit card transaction account" });
    }
  });

  // Delete
  app.delete("/api/credit-card-transactions-accounts/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await db.run(`DELETE FROM credit_card_transactions_accounts WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("Delete credit card transaction account failed:", err);
      res.status(500).json({ error: "Failed to delete credit card transaction account" });
    }
  });
}
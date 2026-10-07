import express from "express";

export default function registerRoyaltyFeesAccounts(app: express.Express, db: any) {
  // List with pagination and search (mall, store, partner)
  app.get("/api/royalty-fees-accounts", async (req, res) => {
    try {
      const perPage = parseInt(req.query.perPage as string) || 10;
      const currentPage = parseInt(((req.query.currentPage ?? req.query.page) as string) || "") || 1;
      const offset = (currentPage - 1) * perPage;
      const search = (req.query.search as string)?.trim();

      let whereClause = "";
      const params: any[] = [];
      if (search) {
        whereClause = "WHERE mall LIKE ? OR store LIKE ? OR partner LIKE ?";
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      const totalRow = await db.get(
        `SELECT COUNT(*) as count FROM royalty_fees_accounts ${whereClause}`,
        params.length ? params : undefined
      );
      const total = totalRow ? totalRow.count : 0;

      const listSql = `
        SELECT id, mall, store, partner, status, createdOn
        FROM royalty_fees_accounts
        ${whereClause}
        ORDER BY id DESC
        LIMIT ${perPage} OFFSET ${offset}
      `;
      const items = await db.all(listSql, params.length ? params : undefined);
      res.json({ items, total });
    } catch (err) {
      console.error("Failed to fetch royalty fee accounts:", err);
      res.status(500).json({ error: "Failed to fetch royalty fee accounts" });
    }
  });

  // Create
  app.post("/api/royalty-fees-accounts", async (req, res) => {
    try {
      const { mall, store, partner, status } = req.body;
      const createdOn = new Date().toISOString().slice(0, 19).replace("T", " ");
      const result = await db.run(
        `INSERT INTO royalty_fees_accounts (mall, store, partner, status, createdOn) VALUES (?, ?, ?, ?, ?)`,
        [mall ?? null, store ?? null, partner ?? null, status ?? null, createdOn]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM royalty_fees_accounts WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      console.error("Create royalty fee account failed:", err);
      res.status(500).json({ error: "Failed to create royalty fee account" });
    }
  });

  // Get by id
  app.get("/api/royalty-fees-accounts/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const row = await db.get(`SELECT id, mall, store, partner, status, createdOn FROM royalty_fees_accounts WHERE id = ?`, [id]);
      if (!row) return res.status(404).json({ error: "Account not found" });
      res.json(row);
    } catch (err) {
      console.error("Fetch royalty fee account failed:", err);
      res.status(500).json({ error: "Failed to fetch royalty fee account" });
    }
  });

  // Update
  app.put("/api/royalty-fees-accounts/:id", async (req, res) => {
    const { id } = req.params;
    const { mall, store, partner, status } = req.body;
    try {
      const account = await db.get(`SELECT id FROM royalty_fees_accounts WHERE id = ?`, [id]);
      if (!account) return res.status(404).json({ error: "Account not found" });

      await db.run(
        `UPDATE royalty_fees_accounts SET mall = ?, store = ?, partner = ?, status = ? WHERE id = ?`,
        [mall ?? null, store ?? null, partner ?? null, status ?? null, id]
      );
      res.json({ success: 1 });
    } catch (err) {
      console.error("Update royalty fee account failed:", err);
      res.status(500).json({ error: "Failed to update royalty fee account" });
    }
  });

  // Delete
  app.delete("/api/royalty-fees-accounts/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await db.run(`DELETE FROM royalty_fees_accounts WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("Delete royalty fee account failed:", err);
      res.status(500).json({ error: "Failed to delete royalty fee account" });
    }
  });
}
import express from "express";

export default function registerAccounts(app: express.Express, db: any) {
  // List accounts with pagination, search, sorting
  app.get("/api/accounts", async (req, res) => {
    try {
      const perPage = Math.max(1, Number(req.query.perPage) || 10);
      const currentPage = Math.max(1, Number(req.query.currentPage) || 1);
      const search = (req.query.search as string || "").trim();
      const rawSortBy = (req.query.sortBy as string) || "createdOn";
      const rawSortDir = ((req.query.sortDir as string) || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

      const allowedSortCols: Record<string, string> = {
        name: "name",
        status: "status",
        createdOn: "createdOn",
      };
      const sortCol = allowedSortCols[rawSortBy] || "createdOn";
      const orderClause = `ORDER BY ${sortCol} ${rawSortDir}`;

      const whereParts: string[] = [];
      const params: any[] = [];
      if (search) {
        whereParts.push("(name LIKE ? OR status LIKE ?)");
        const like = `%${search}%`;
        params.push(like, like);
      }
      const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

      const totalRow = await db.get(
        `SELECT COUNT(*) as count FROM accounts ${whereClause}`,
        params
      );
      const total = totalRow?.count || 0;

      const offset = (currentPage - 1) * perPage;
      const sql = `SELECT * FROM accounts ${whereClause} ${orderClause} LIMIT ${Number(
        perPage
      )} OFFSET ${Number(offset)}`;
      const items = await db.all(sql, params);

      res.json({ items, total });
    } catch (err) {
      console.error("GET /api/accounts failed:", err);
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  // Get single account
  app.get("/api/accounts/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const row = await db.get(`SELECT * FROM accounts WHERE id = ?`, [id]);
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (err) {
      console.error("GET /api/accounts/:id failed:", err);
      res.status(500).json({ error: "Failed to fetch account" });
    }
  });

  // Create account
  app.post("/api/accounts", async (req, res) => {
    try {
      const name = (req.body.name || "").trim();
      const status = (req.body.status || "").trim();
      if (!name) return res.status(400).json({ error: "Name is required" });
      const createdOn = new Date().toISOString().slice(0, 19).replace("T", " ");
      const result = await db.run(
        `INSERT INTO accounts (name, status, createdOn) VALUES (?,?,?)`,
        [name, status || null, createdOn]
      );
      const insertedId = result?.insertId || result?.lastID;
      const row = await db.get(`SELECT * FROM accounts WHERE id = ?`, [insertedId]);
      res.json({ success: 1, item: row });
    } catch (err) {
      console.error("POST /api/accounts failed:", err);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  // Update account
  app.put("/api/accounts/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.get(`SELECT * FROM accounts WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Not found" });

      const name = (req.body.name ?? existing.name).trim?.() ?? existing.name;
      const status =
        (req.body.status === undefined
          ? existing.status
          : (req.body.status || "").trim()) || null;

      if (!name) return res.status(400).json({ error: "Name is required" });

      await db.run(`UPDATE accounts SET name = ?, status = ? WHERE id = ?`, [
        name,
        status,
        id,
      ]);
      const row = await db.get(`SELECT * FROM accounts WHERE id = ?`, [id]);
      res.json({ success: 1, item: row });
    } catch (err) {
      console.error("PUT /api/accounts/:id failed:", err);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  // Delete account
  app.delete("/api/accounts/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.get(`SELECT * FROM accounts WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Not found" });
      await db.run(`DELETE FROM accounts WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("DELETE /api/accounts/:id failed:", err);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });
}
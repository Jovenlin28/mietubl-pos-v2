import express from "express";

export default function registerAgents(app: express.Express, db: any) {
  // API: Get agents (with pagination and search)
  app.get("/api/agents", async (req, res) => {
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;
    const search = (req.query.search as string)?.trim();

    let where = "";
    const params: any[] = [];
    if (search) {
      where = "WHERE fullName LIKE ? OR phone LIKE ?";
      params.push(`%${search}%`, `%${search}%`);
    }

    try {
      const totalRow = await db.get(`SELECT COUNT(*) as count FROM agents ${where}`, params.length ? params : undefined);
      const total = totalRow ? totalRow.count : 0;

      const listSql = `SELECT id, fullName, phone, status, createdOn FROM agents ${where} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`;
      const items = await db.all(listSql, params.length ? params : undefined);

      res.json({ items, total });
    } catch (err) {
      console.error("GET /api/agents failed:", err);
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  // API: Get agent by ID
  app.get("/api/agents/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const agent = await db.get(
        `SELECT id, fullName, phone, status, createdOn FROM agents WHERE id = ?`,
        [id]
      );
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      res.json(agent);
    } catch (err) {
      console.error("GET /api/agents/:id failed:", err);
      res.status(500).json({ error: "Failed to fetch agent" });
    }
  });

  // API: Create agent
  app.post("/api/agents", async (req, res) => {
    try {
      const { fullName, phone, status } = req.body;
      const fullNameTrim = (fullName ?? "").toString().trim();
      if (!fullNameTrim) {
        return res.status(400).json({ error: "Full name is required." });
      }

      const result = await db.run(
        `INSERT INTO agents (fullName, phone, status, createdOn) VALUES (?, ?, ?, NOW())`,
        [fullNameTrim, phone ?? null, status ?? "Active"]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT id, fullName, phone, status, createdOn FROM agents WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      console.error("Create agent failed:", err);
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  // API: Update agent
  app.put("/api/agents/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const { fullName, phone, status } = req.body;
      const fullNameTrim = (fullName ?? "").toString().trim();
      if (!fullNameTrim) {
        return res.status(400).json({ error: "Full name is required." });
      }

      await db.run(
        `UPDATE agents SET fullName = ?, phone = ?, status = ? WHERE id = ?`,
        [fullNameTrim, phone ?? null, status ?? "Active", id]
      );

      const updated = await db.get(`SELECT id, fullName, phone, status, createdOn FROM agents WHERE id = ?`, [id]);
      res.json({ success: 1, item: updated });
    } catch (err) {
      console.error("Update agent failed:", err);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  // API: Delete agent
  app.delete("/api/agents/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const existing = await db.get(`SELECT id FROM agents WHERE id = ?`, [id]);
      if (!existing) {
        return res.status(404).json({ error: "Agent not found" });
      }
      await db.run(`DELETE FROM agents WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("Delete agent failed:", err);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });
}

import express from "express";

export default function registerSystemLogs(app: express.Express, db: any) {
  // GET /api/system-logs
  app.get("/api/system-logs", async (req, res) => {
    try {
      const perPage = Number(req.query.perPage ?? 10) || 10;
      const currentPage = Math.max(1, Number(req.query.currentPage ?? 1) || 1);
      const search = (req.query.search as string || "").trim();

      const whereParts: string[] = [];
      const params: any[] = [];

      if (search) {
        whereParts.push("(module LIKE ? OR action LIKE ? OR description LIKE ?)");
        const like = `%${search}%`;
        params.push(like, like, like);
      }

      const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

      // Sorting: allow only specific columns to prevent SQL injection
      const allowedSortCols: Record<string, string> = {
        createdOn: "createdOn",
        module: "module",
        action: "action",
        createdBy: "createdBy",
      };
      const rawSortBy = (req.query.sortBy as string) || "";
      const rawSortDir = ((req.query.sortDir as string) || "").toLowerCase() === "asc" ? "ASC" : "DESC";
      let orderClause = "ORDER BY createdOn DESC";
      if (rawSortBy && allowedSortCols[rawSortBy]) {
        orderClause = `ORDER BY ${allowedSortCols[rawSortBy]} ${rawSortDir}`;
      }

      // total
      // always pass an array (even empty) to avoid driver argument issues
      const totalRow: any = await db.get(
        `SELECT COUNT(*) as count FROM system_logs ${whereClause}`,
        params
      );
      const total = totalRow ? totalRow.count : 0;

      // items (ordered by createdOn DESC by default)
      const offset = Math.max(0, (currentPage - 1) * perPage);
      // interpolate numeric LIMIT/OFFSET (safe because these are numbers from parsed input)
      const sql = `SELECT * FROM system_logs ${whereClause} ${orderClause} LIMIT ${Number(
        perPage
      )} OFFSET ${Number(offset)}`;
      const items: any[] = await db.all(sql, params);

      res.json({ items, total });
    } catch (err) {
      console.error("GET /api/system-logs failed:", err);
      res.status(500).json({ error: "Failed to fetch system logs" });
    }
  });

  // POST /api/system-logs
  app.post("/api/system-logs", async (req, res) => {
    try {
      const mod = (req.body.module ?? "").toString();
      const action = (req.body.action ?? "").toString();
      const description = (req.body.description ?? "").toString();
      const createdBy = (req.body.createdBy ?? "").toString();
      const createdOn = new Date().toISOString().slice(0, 19).replace("T", " ");

      const sql = `INSERT INTO system_logs (module, action, description, createdOn, createdBy) VALUES (?, ?, ?, ?, ?)`;
      const result: any = await db.run(sql, [mod, action, description, createdOn, createdBy]);

      const insertedId = result?.insertId ?? result?.lastID;
      const inserted = insertedId ? await db.get(`SELECT * FROM system_logs WHERE id = ?`, [insertedId]) : null;

      res.json({ success: 1, item: inserted });
    } catch (err) {
      console.error("POST /api/system-logs failed:", err);
      res.status(500).json({ error: "Failed to create system log" });
    }
  });
}
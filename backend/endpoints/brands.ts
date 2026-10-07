import express from "express";

export default function registerBrands(app: express.Express, db: any,) {
  app.get("/api/brands", async (req, res) => {
    
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;
    try {
      const totalRow: any = await db.get(`SELECT COUNT(*) as count FROM brands`);
      const total = totalRow ? (totalRow.count ?? totalRow.COUNT ?? 0) : 0;

      // interpolate numeric LIMIT/OFFSET
      const listSql = `SELECT id, name, status, createdOn FROM brands ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`;
      const brands = await db.all(listSql);

      res.json({ items: brands, total });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch brands" });
    }
  });

  app.post("/api/brands", async (req, res) => {
    const { name, status } = req.body;
    try {
      // use NOW() for createdOn
      await db.run(`INSERT INTO brands (name, status, createdOn) VALUES (?, ?, NOW())`, [name, status]);
      res.status(201).json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to create brand" });
    }
  });

  app.put("/api/brands/:id", async (req, res) => {
    const { name, status } = req.body;
    const { id } = req.params;
    try {
      await db.run(`UPDATE brands SET name = ?, status = ? WHERE id = ?`, [name, status, id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to update brand" });
    }
  });

  app.delete("/api/brands/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await db.run(`DELETE FROM brands WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete brand" });
    }
  });
}
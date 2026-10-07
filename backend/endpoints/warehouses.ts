import express from "express";

export default function registerWarehouses(app: express.Express, db: any,) {
  app.get("/api/warehouses", async (req, res) => {
    
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;
    const search = (req.query.search as string)?.trim();

    let whereClause = "";
    const params: any[] = [];
    if (search) {
      whereClause = "WHERE name LIKE ? OR contactPerson LIKE ? OR address LIKE ?";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    try {
      const totalRow = await db.get(
        `SELECT COUNT(*) as count FROM warehouses ${whereClause}`,
        params.length ? params : undefined
      );
      const total = totalRow ? totalRow.count : 0;

      // interpolate numeric LIMIT/OFFSET to avoid placeholder/driver issues
      const listSql = `SELECT * FROM warehouses ${whereClause} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`;
      const warehouses = await db.all(listSql, params.length ? params : undefined);

      res.json({ items: warehouses, total });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch warehouses" });
    }
  });

  // Create warehouse
  app.post("/api/warehouses", async (req, res) => {
    try {
      const { name, contactPerson, contactEmail, contactPhone, address, status } = req.body;
      const result = await db.run(
        `INSERT INTO warehouses (name, contactPerson, contactEmail, contactPhone, address, status, createdOn)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [name, contactPerson ?? null, contactEmail ?? null, contactPhone ?? null, address ?? null, status ?? "Active"]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM warehouses WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      res.status(500).json({ error: "Failed to create warehouse" });
    }
  });

  app.put("/api/warehouses/:id", async (req, res) => {
    
    const { id } = req.params;
    const { name, contactPerson, contactEmail, contactPhone, address, status } = req.body;
    try {
      await db.run(
        `UPDATE warehouses SET name = ?, contactPerson = ?, contactEmail = ?, contactPhone = ?, address = ?, status = ? WHERE id = ?`,
        [name ?? null, contactPerson ?? null, contactEmail ?? null, contactPhone ?? null, address ?? null, status ?? null, id]
      );
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to update warehouse" });
    }
  });

  app.delete("/api/warehouses/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      await db.run(`DELETE FROM warehouses WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete warehouse" });
    }
  });
}
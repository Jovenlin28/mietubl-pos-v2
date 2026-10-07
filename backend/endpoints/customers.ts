import express from "express";

export default function registerCustomers(app: express.Express, db: any,) {
  app.get("/api/customers", async (req, res) => {
    
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;
    const search = (req.query.search as string)?.trim();

    // sorting (server-side). allowed: fullName, storeName, createdOn, mostTransactions
    const rawSortBy = (req.query.sortBy as string) || "";
    const rawSortDir = ((req.query.sortDir as string) || "").toLowerCase() === "asc" ? "ASC" : "DESC";
    const allowedSortCols: Record<string, string> = {
      fullName: "fullName",
      storeName: "storeName",
      createdOn: "createdOn",
      mostTransactions: "(SELECT COUNT(*) FROM sales s WHERE s.customer_id = customers.id)",
    };
    const sortCol = allowedSortCols[rawSortBy] ?? "createdOn";
    const sortDir = rawSortBy === "mostTransactions"
      ? "DESC"
      : (rawSortDir === "ASC" ? "ASC" : "DESC");
    const orderClause = `${sortCol} ${sortDir}`;

    let where = "";
    const params: any[] = [];
    if (search) {
      where = "WHERE fullName LIKE ? OR email LIKE ? OR phoneNumber LIKE ?";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    try {
      const totalRow = await db.get(`SELECT COUNT(*) as count FROM customers ${where}`, params.length ? params : undefined);
      const total = totalRow ? totalRow.count : 0;

      const listSql = `SELECT * FROM customers ${where} ORDER BY ${orderClause} LIMIT ${perPage} OFFSET ${offset}`;
      const items = await db.all(listSql, params.length ? params : undefined);

      res.json({ items, total });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const customer = await db.get(`SELECT * FROM customers WHERE id = ?`, [id]);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      res.json(customer);
    } catch (err) {
      console.error("GET /api/customers/:id failed:", err);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    
    try {
      const { fullName, email, phoneNumber, country, address, storeName, company, tinNumber, status } = req.body;
      const addressValue = address && typeof address === "string" && address.trim() ? address.trim() : null;
      const result = await db.run(
        `INSERT INTO customers (fullName, email, phoneNumber, country, address, storeName, company, tinNumber, status, createdOn)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [fullName, email, phoneNumber, country, addressValue, storeName, company, tinNumber, status || "Active"]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM customers WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.put('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    const { fullName, email, phoneNumber, country, address, storeName, company, tinNumber, status } = req.body as any;
    try {
      const existing = await db.get(`SELECT id FROM customers WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Customer not found" });

      const addressValue = address && typeof address === "string" && address.trim() ? address.trim() : null;

      await db.run(
        `UPDATE customers
         SET fullName = ?, email = ?, phoneNumber = ?, country = ?, address = ?, storeName = ?, company = ?, tinNumber = ?, status = ?
         WHERE id = ?`,
        [
          fullName ?? null,
          email ?? null,
          phoneNumber ?? null,
          country ?? null,
          addressValue,
          storeName ?? null,
          company ?? null,
          tinNumber ?? null,
          status ?? null,
          id
        ]
      );

      const updated = await db.get(`SELECT * FROM customers WHERE id = ?`, [id]);
      res.json({ success: 1, item: updated });
    } catch (err) {
      console.error("PUT /api/customers failed:", err);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const existing = await db.get(`SELECT id FROM customers WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Customer not found" });
      await db.run(`DELETE FROM customers WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("DELETE /api/customers failed:", err);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });
}
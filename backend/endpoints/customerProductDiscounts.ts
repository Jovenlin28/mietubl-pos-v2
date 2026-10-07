import express from "express";

export default function registerCustomerProductDiscounts(app: express.Express, db: any,) {
  app.post("/api/customer-product-discounts", async (req, res) => {
    try {
      const { customer_id, product_id, discount_value } = req.body;

      // basic validation
      if (!customer_id || !product_id || typeof discount_value === "undefined") {
        return res.status(400).json({ error: "customer_id, product_id and discount_value are required" });
      }
      if (isNaN(Number(discount_value))) {
        return res.status(400).json({ error: "discount_value must be a number" });
      }

      // ensure referenced customer and product exist (avoid FK/constraint errors)
      const customer = await db.get(`SELECT id FROM customers WHERE id = ?`, [customer_id]);
      if (!customer) return res.status(400).json({ error: "Customer not found" });

      const product = await db.get(`SELECT id FROM products WHERE id = ?`, [product_id]);
      if (!product) return res.status(400).json({ error: "Product not found" });

      // store created_on as SQL datetime (YYYY-MM-DD HH:mm:ss) to match MySQL DATETIME
      const now = new Date();
      const createdOn = now.toISOString().slice(0, 19).replace("T", " "); // "YYYY-MM-DD HH:MM:SS"
      const result = await db.run(
        `INSERT INTO customer_product_discounts (customer_id, product_id, discount_value, created_on) VALUES (?, ?, ?, ?)`,
        [customer_id, product_id, Number(discount_value), createdOn]
      );

      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM customer_product_discounts WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err: any) {
      console.error("Create customer-product-discount failed:", err);
      let detailedError = err?.code === 'ER_DUP_ENTRY' ? "A discount for this customer and product already exists." : "Failed to create discount"; 
      res.status(500).json({ error: detailedError });
    }
  });

  app.get('/api/customer-product-discounts/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const discount = await db.get(
        `SELECT d.id, d.customer_id, c.fullName as customer_name, d.product_id, p.name as product_name, d.discount_value, d.created_on
         FROM customer_product_discounts d
         LEFT JOIN customers c ON d.customer_id = c.id
         LEFT JOIN products p ON d.product_id = p.id
         WHERE d.id = ?`,
        [id]
      );
      if (!discount) return res.status(404).json({ error: "Discount not found" });
      res.json(discount);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch discount" });
    }
  });

  app.put('/api/customer-product-discounts/:id', async (req, res) => {
    
    const { id } = req.params;
    const { customer_id, product_id, discount_value } = req.body;
    try {
      await db.run(`UPDATE customer_product_discounts SET customer_id = ?, product_id = ?, discount_value = ? WHERE id = ?`, [customer_id, product_id, discount_value, id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to update discount" });
    }
  });

  app.delete('/api/customer-product-discounts/:id', async (req, res) => {
    
    const { id } = req.params;
    try {
      await db.run(`DELETE FROM customer_product_discounts WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete discount" });
    }
  });

  app.get('/api/customer-product-discounts', async (req, res) => {
    
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;
    const search = (req.query.search as string)?.trim();

    // sorting (whitelist)
    const rawSortBy = (req.query.sortBy as string || "").trim();
    const rawSortDir = (req.query.sortDir as string || "desc").toLowerCase();
    const allowed: Record<string, string> = {
      customer: "c.fullName",
      discountValue: "d.discount_value",
      createdOn: "d.created_on",
      id: "d.id"
    };
    const sortCol = allowed[rawSortBy] || "d.created_on";
    const sortDir = rawSortDir === "asc" ? "ASC" : "DESC";

    let whereClause = "";
    let params: any[] = [];
    if (search) {
      whereClause = `WHERE c.fullName LIKE ? OR p.name LIKE ?`;
      params = [`%${search}%`, `%${search}%`];
    }

    try {
      const totalRow = await db.get(
        `SELECT COUNT(*) as count FROM customer_product_discounts d LEFT JOIN customers c ON d.customer_id = c.id LEFT JOIN products p ON d.product_id = p.id ${whereClause}`,
        params
      );
      const total = totalRow ? totalRow.count : 0;

      // interpolate numeric LIMIT/OFFSET and pass params as single array
      const listSql = `
        SELECT d.id, d.customer_id, c.fullName as customer_name, d.product_id, p.name as product_name, d.discount_value, d.created_on
        FROM customer_product_discounts d
        LEFT JOIN customers c ON d.customer_id = c.id
        LEFT JOIN products p ON d.product_id = p.id
        ${whereClause}
        ORDER BY ${sortCol} ${sortDir}
        LIMIT ${perPage} OFFSET ${offset}
      `;
      const items = await db.all(listSql, params.length ? params : undefined);
      res.json({ items, total });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch discounts" });
    }
  });

  // endpoint for specific customer -> product-discounts
  app.get("/api/customers/:id/product-discounts", async (req, res) => {
    
    try {
      const customerId = req.params.id;
      const customer = await db.get(`SELECT id, fullName FROM customers WHERE id = ?`, [customerId]);
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      const perPage = parseInt(req.query.perPage as string) || 10;
      const currentPage = parseInt(req.query.currentPage as string) || 1;
      const offset = (currentPage - 1) * perPage;
      const search = (req.query.search as string)?.trim();

      let whereClause = "WHERE d.customer_id = ?";
      const params: any[] = [customerId];
      if (search) {
        whereClause += " AND (p.name LIKE ? OR p.sku LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }

      const totalRow = await db.get(`SELECT COUNT(*) as count FROM customer_product_discounts d LEFT JOIN products p ON d.product_id = p.id ${whereClause}`, params);
      const total = totalRow ? totalRow.count : 0;

      const listSql = `
        SELECT d.id, d.customer_id, d.product_id, p.name as product_name, p.sku as product_sku, d.discount_value, d.created_on
        FROM customer_product_discounts d
        LEFT JOIN products p ON d.product_id = p.id
        ${whereClause}
        ORDER BY d.id DESC
        LIMIT ${perPage} OFFSET ${offset}
      `;
      const items = await db.all(listSql, params.length ? params : undefined);

      res.json({ customer: { id: customer.id, fullName: customer.fullName }, items, total });
    } catch (err) {
      console.error("Fetch customer product-discounts failed:", err);
      res.status(500).json({ error: "Failed to fetch customer product discounts" });
    }
  });
}
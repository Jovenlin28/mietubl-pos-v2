import express from "express";

export default function registerExpenses(app: express.Express, db: any,) {

  const toMySQLDateTime = (v: any) => {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    const pad = (n: number) => (n < 10 ? "0" + n : String(n));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  app.get("/api/expenses", async (req, res) => {
    
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;
    const search = (req.query.search as string)?.trim();
    const categoryFilter = (req.query.category as string)?.trim();

    // sorting params (whitelist to avoid SQL injection)
    const rawSortBy = (req.query.sortBy as string) || "";
    const rawSortDir = (req.query.sortDir as string || "desc").toLowerCase();
    const allowedCols: Record<string, string> = {
      id: "id",
      purchaseDate: "purchaseDate",
      expenseCategory: "expenseCategory",
      totalCost: "totalCost",
      status: "status",
      receiptNo: "receiptNo",
      createdOn: "createdOn",
      vendorName: "vendorName",
      sourceOfFund: "sourceOfFund",
    };
    const sortCol = allowedCols[rawSortBy] || "id";
    const sortDir = rawSortDir === "asc" ? "ASC" : "DESC";
 
    let where = "";
    const params: any[] = [];
    if (search) {
      where = "WHERE (itemDescription LIKE ? OR vendorName LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (categoryFilter) {
      // append category condition safely
      if (where) {
        where += " AND expenseCategory = ?";
      } else {
        where = "WHERE expenseCategory = ?";
      }
      params.push(categoryFilter);
    }
 
    try {
      const totalRow = await db.get(`SELECT COUNT(*) as count FROM expenses ${where}`, params.length ? params : undefined);
      const total = totalRow ? totalRow.count : 0;
 
      // apply ORDER BY using whitelisted column and direction
      const listSql = `SELECT * FROM expenses ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ${perPage} OFFSET ${offset}`;
      const items = await db.all(listSql, params.length ? params : undefined);
 
      res.json({ items, total });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      const expense = await db.get(`SELECT * FROM expenses WHERE id = ?`, [id]);
      if (!expense) return res.status(404).json({ error: "Expense not found" });
      res.json(expense);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch expense" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const {
        purchaseDate,
        expenseCategory,
        itemDescription,
        totalCost,
        status,
        receiptNo,
        vendorName,
        sourceOfFund,
        tinNo,
        businessAddress,
        attachment
      } = req.body;

      const pd = toMySQLDateTime(purchaseDate);

      const result = await db.run(
        `INSERT INTO expenses (purchaseDate, expenseCategory, itemDescription, totalCost, status, receiptNo, vendorName, sourceOfFund, tinNo, businessAddress, attachment, createdOn)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [pd, expenseCategory, itemDescription, totalCost, status, receiptNo, vendorName, sourceOfFund ?? null, tinNo, businessAddress, attachment ?? null]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM expenses WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      console.error("POST /api/expenses error:", err);
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.put("/api/expenses/:id", async (req, res) => {

    const { id } = req.params;
    const { purchaseDate, expenseCategory, itemDescription, totalCost, status, receiptNo, vendorName, sourceOfFund, tinNo, businessAddress, attachment } = req.body;
    try {
      const pd = toMySQLDateTime(purchaseDate);
      await db.run(
        `UPDATE expenses
           SET purchaseDate = ?, expenseCategory = ?, itemDescription = ?, totalCost = ?, status = ?, receiptNo = ?, vendorName = ?, sourceOfFund = ?, tinNo = ?, businessAddress = ?, attachment = ?
         WHERE id = ?`,
        [pd, expenseCategory, itemDescription, totalCost, status, receiptNo || "", vendorName || "", sourceOfFund || "", tinNo || "", businessAddress || "", attachment || null, id]
      );
      res.json({ success: 1 });
    } catch (err) {
      console.error("PUT /api/expenses/:id error:", err);
      res.status(500).json({ error: "Failed to update expense", details: (err as any)?.message });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      await db.run(`DELETE FROM expenses WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });
}
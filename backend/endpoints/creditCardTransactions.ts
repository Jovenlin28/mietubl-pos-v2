import express from "express";

export default function registerCreditCardTransactions(app: express.Express, db: any) {
  // List with pagination, search, sorting
  app.get("/api/credit-card-transactions", async (req, res) => {
    try {
      const perPage = Math.max(1, Number(req.query.perPage) || 10);
      const currentPage = Math.max(1, Number(req.query.currentPage) || 1);
      const search = (req.query.search as string || "").trim();
      const rawSortBy = (req.query.sortBy as string) || "transactionDate";
      const rawSortDir =
        ((req.query.sortDir as string) || "DESC").toUpperCase() === "ASC"
          ? "ASC"
          : "DESC";

      const allowedSortCols: Record<string, string> = {
        transactionDate: "cct.transactionDate",
        transactionAmount: "cct.transactionAmount",
        createdOn: "cct.createdOn",
        receiptNo: "cct.receiptNo",
        store: "a.store",
      };
      const sortCol = allowedSortCols[rawSortBy] || "cct.transactionDate";
      const orderClause = `ORDER BY ${sortCol} ${rawSortDir}`;

      const whereParts: string[] = [];
      const params: any[] = [];
      if (search) {
        whereParts.push("(cct.receiptNo LIKE ?)");
        const like = `%${search}%`;
        params.push(like);
      }
      const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

      const totalRow = await db.get(
        `SELECT COUNT(*) as count
         FROM credit_card_transactions cct
         ${whereClause}`,
        params
      );
      const total = totalRow?.count || 0;

      const offset = (currentPage - 1) * perPage;
      const sql = `
        SELECT
          cct.*,
          a.id AS account_id,
          a.store AS account_store,
          a.status AS account_status,
          a.createdOn AS account_createdOn
        FROM credit_card_transactions cct
        LEFT JOIN credit_card_transactions_accounts a
          ON a.id = cct.account_id
        ${whereClause}
        ${orderClause}
        LIMIT ${Number(perPage)} OFFSET ${Number(offset)}
      `;
      const rows = await db.all(sql, params);

      const items = (rows || []).map((r: any) => {
        const account = r.account_id != null
          ? {
              id: r.account_id,
              store: r.account_store ?? null,
              status: r.account_status ?? null,
              createdOn: r.account_createdOn ?? null,
            }
          : null;

        const { account_id, account_store, account_status, account_createdOn, ...rest } = r;
        return { ...rest, account };
      });

      res.json({ items, total });
    } catch (err) {
      console.error("GET /api/credit-card-transactions failed:", err);
      res.status(500).json({ error: "Failed to fetch credit card transactions" });
    }
  });

  // Get single
  app.get("/api/credit-card-transactions/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const row = await db.get(
        `SELECT
           cct.*,
           a.id AS account_id,
           a.store AS account_store,
           a.status AS account_status,
           a.createdOn AS account_createdOn
         FROM credit_card_transactions cct
         LEFT JOIN credit_card_transactions_accounts a
           ON a.id = cct.account_id
         WHERE cct.id = ?`,
        [id]
      );
      if (!row) return res.status(404).json({ error: "Not found" });

      const account = row.account_id != null
        ? {
            id: row.account_id,
            store: row.account_store ?? null,
            status: row.account_status ?? null,
            createdOn: row.account_createdOn ?? null,
          }
        : null;

      const { account_id, account_store, account_status, account_createdOn, ...rest } = row;
      res.json({ ...rest, account });
    } catch (err) {
      console.error("GET /api/credit-card-transactions/:id failed:", err);
      res.status(500).json({ error: "Failed to fetch credit card transaction" });
    }
  });

  // Create
  app.post("/api/credit-card-transactions", async (req, res) => {
    try {
      const transactionAmount = Number(req.body.transactionAmount);
      const transactionDate = (req.body.transactionDate || "").trim();
      const receiptNo = (req.body.receiptNo || "").trim() || null;
      const attachment = (req.body.attachment || "").trim() || null;

      // accept account_id (nullable number)
      const accountId = req.body.account_id ?? null;

      if (!transactionDate)
        return res.status(400).json({ error: "transactionDate is required" });
      if (Number.isNaN(transactionAmount))
        return res.status(400).json({ error: "transactionAmount must be a number" });

      const createdOn = new Date().toISOString().slice(0, 19).replace("T", " ");
      const result = await db.run(
        `INSERT INTO credit_card_transactions
          (transactionAmount, transactionDate, receiptNo, attachment, account_id, createdOn)
         VALUES (?,?,?,?,?,?)`,
        [
          transactionAmount,
          transactionDate,
          receiptNo,
          attachment,
          accountId,
          createdOn,
        ]
      );

      const insertedId = result?.insertId || result?.lastID;
      const row = await db.get(
        `SELECT
           cct.*,
           a.id AS account_id,
           a.store AS account_store,
           a.status AS account_status,
           a.createdOn AS account_createdOn
         FROM credit_card_transactions cct
         LEFT JOIN credit_card_transactions_accounts a
           ON a.id = cct.account_id
         WHERE cct.id = ?`,
        [insertedId]
      );

      const account = row.account_id != null
        ? {
            id: row.account_id,
            store: row.account_store ?? null,
            status: row.account_status ?? null,
            createdOn: row.account_createdOn ?? null,
          }
        : null;
      const { account_id, account_store, account_status, account_createdOn, ...rest } = row;
      res.json({ success: 1, item: { ...rest, account } });
    } catch (err) {
      console.error("POST /api/credit-card-transactions failed:", err);
      res.status(500).json({ error: "Failed to create credit card transaction" });
    }
  });

  // Update
  app.put("/api/credit-card-transactions/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.get(
        `SELECT * FROM credit_card_transactions WHERE id = ?`,
        [id]
      );
      if (!existing) return res.status(404).json({ error: "Not found" });

      const transactionAmount =
        req.body.transactionAmount === undefined
          ? existing.transactionAmount
          : Number(req.body.transactionAmount);

      const transactionDate =
        req.body.transactionDate === undefined
          ? existing.transactionDate
          : (req.body.transactionDate || "").trim();

      const receiptNo =
        req.body.receiptNo === undefined
          ? existing.receiptNo
          : (req.body.receiptNo || "").trim() || null;

      const attachment =
        req.body.attachment === undefined
          ? existing.attachment
          : (req.body.attachment || "").trim() || null;

      // accept and persist account_id if provided
      const accountId = req.body.account_id === undefined ? existing.account_id : req.body.account_id;

      if (!transactionDate)
        return res.status(400).json({ error: "transactionDate is required" });
      if (Number.isNaN(transactionAmount))
        return res.status(400).json({ error: "transactionAmount must be a number" });

      await db.run(
        `UPDATE credit_card_transactions
         SET transactionAmount = ?, transactionDate = ?, receiptNo = ?, attachment = ?, account_id = ?
         WHERE id = ?`,
        [
          transactionAmount,
          transactionDate,
          receiptNo,
          attachment,
          accountId,
          id,
        ]
      );
      const row = await db.get(
        `SELECT
           cct.*,
           a.id AS account_id,
           a.store AS account_store,
           a.status AS account_status,
           a.createdOn AS account_createdOn
         FROM credit_card_transactions cct
         LEFT JOIN credit_card_transactions_accounts a
           ON a.id = cct.account_id
         WHERE cct.id = ?`,
        [id]
      );

      const account = row.account_id != null
        ? {
            id: row.account_id,
            store: row.account_store ?? null,
            status: row.account_status ?? null,
            createdOn: row.account_createdOn ?? null,
          }
        : null;
      const { account_id, account_store, account_status, account_createdOn, ...rest } = row;
      res.json({ success: 1, item: { ...rest, account } });
    } catch (err) {
      console.error("PUT /api/credit-card-transactions/:id failed:", err);
      res.status(500).json({ error: "Failed to update credit card transaction" });
    }
  });

  // Delete
  app.delete("/api/credit-card-transactions/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.get(
        `SELECT id FROM credit_card_transactions WHERE id = ?`,
        [id]
      );
      if (!existing) return res.status(404).json({ error: "Not found" });
      await db.run(
        `DELETE FROM credit_card_transactions WHERE id = ?`,
        [id]
      );
      res.json({ success: 1 });
    } catch (err) {
      console.error("DELETE /api/credit-card-transactions/:id failed:", err);
      res.status(500).json({ error: "Failed to delete credit card transaction" });
    }
  });
}
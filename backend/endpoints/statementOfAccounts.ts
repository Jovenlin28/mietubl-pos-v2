import express from "express";

export default function registerStatementOfAccounts(app: express.Express, db: any) {
  // LIST with pagination / filtering / sorting
  app.get("/api/statement-of-accounts", async (req, res) => {
    try {
      const perPage = Math.max(1, Number(req.query.perPage) || 10);
      const currentPage = Math.max(1, Number(req.query.currentPage) || 1);
      const search = (req.query.search as string || "").trim();
      const accountId = req.query.accountId ? Number(req.query.accountId) : null;

      const rawSortBy = (req.query.sortBy as string) || "createdOn";
      const rawSortDir = ((req.query.sortDir as string) || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

      const allowedSortCols: Record<string, string> = {
        account: "a.name",
        createdOn: "soa.createdOn",
        periodStart: "soa.periodStart",
        periodEnd: "soa.periodEnd",
        amountToPay: "soa.amountToPay",
        amountPaid: "soa.amountPaid",
        referenceNo: "soa.referenceNo",
        // computed balance (amountToPay - amountPaid)
        balance: "(COALESCE(soa.amountToPay,0) - COALESCE(soa.amountPaid,0))",
        // computed status (Paid / Partial / Unpaid)
        status: `CASE
                  WHEN COALESCE(soa.amountToPay,0) > 0 AND COALESCE(soa.amountPaid,0) >= COALESCE(soa.amountToPay,0) THEN 'Paid'
                  WHEN COALESCE(soa.amountPaid,0) > 0 THEN 'Partial'
                  ELSE 'Unpaid'
                END`,
      };
      const sortCol = allowedSortCols[rawSortBy] || "soa.createdOn";
      const orderClause = `ORDER BY ${sortCol} ${rawSortDir}`;

      const whereParts: string[] = [];
      const params: any[] = [];

      if (search) {
        whereParts.push("(soa.referenceNo LIKE ? OR soa.description LIKE ?)");
        const like = `%${search}%`;
        params.push(like, like);
      }
      if (accountId) {
        whereParts.push("soa.account_id = ?");
        params.push(accountId);
      }

      const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

      // count
      const totalRow = await db.get(
        `SELECT COUNT(*) as count
         FROM statement_of_accounts soa
         LEFT JOIN accounts a ON soa.account_id = a.id
         ${whereClause}`,
        params
      );
      const total = totalRow?.count || 0;

      const offset = (currentPage - 1) * perPage;
      const sql = `
        SELECT
          soa.*,
          a.id AS account_id,
          a.name AS account_name
        FROM statement_of_accounts soa
        LEFT JOIN accounts a ON soa.account_id = a.id
        ${whereClause}
        ${orderClause}
        LIMIT ${Number(perPage)} OFFSET ${Number(offset)}
      `;
      const rows = await db.all(sql, params);

      const items = (rows || []).map((r: any) => {
        const account = r.account_id
          ? {
              id: r.account_id,
              name: r.account_name || null,
            }
          : null;

        // keep original row fields, attach account object and computed remainingBalance
        const out = {
          ...r,
          account,
          remainingBalance: Number(r.amountToPay || 0) - Number(r.amountPaid || 0),
        };

        // remove duplicated raw account_* keys if present
        delete (out as any).account_id;
        delete (out as any).account_name;

        return out;
      });

      res.json({ items, total });
    } catch (err) {
      console.error("GET /api/statement-of-accounts failed:", err);
      res.status(500).json({ error: "Failed to fetch statements" });
    }
  });

  // GET single
  app.get("/api/statement-of-accounts/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const row = await db.get(
        `SELECT
           soa.*,
           a.id AS account_id,
           a.name AS account_name
         FROM statement_of_accounts soa
         LEFT JOIN accounts a ON soa.account_id = a.id
         WHERE soa.id = ?`,
        [id]
      );
      if (!row) return res.status(404).json({ error: "Not found" });

      const account = row.account_id
        ? {
            id: row.account_id,
            name: row.account_name || null,
          }
        : null;

      row.account = account;
      row.remainingBalance = Number(row.amountToPay || 0) - Number(row.amountPaid || 0);

      // remove raw account_* keys to avoid duplication
      delete row.account_id;
      delete row.account_name;

      res.json(row);
    } catch (err) {
      console.error("GET /api/statement-of-accounts/:id failed:", err);
      res.status(500).json({ error: "Failed to fetch statement" });
    }
  });

  // CREATE
  app.post("/api/statement-of-accounts", async (req, res) => {
    try {
      const {
        account_id,
        referenceNo,
        description,
        amountToPay,
        amountPaid,
        attachment,
        periodStart,
        periodEnd,
      } = req.body;

      if (!account_id) return res.status(400).json({ error: "account_id is required" });
      if (amountToPay === undefined || amountToPay === null)
        return res.status(400).json({ error: "amountToPay is required" });

      const createdOn = new Date().toISOString().slice(0, 19).replace("T", " ");

      const result = await db.run(
        `INSERT INTO statement_of_accounts
         (account_id, referenceNo, description, amountToPay, amountPaid, attachment, periodStart, periodEnd, createdOn)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          account_id,
          referenceNo || null,
          description || null,
          Number(amountToPay) || 0,
          Number(amountPaid) || 0,
          attachment || null,
          periodStart || null,
          periodEnd || null,
          createdOn,
        ]
      );

      const insertedId = result?.insertId || result?.lastID;
      const created = await db.get(
        `SELECT
           soa.*,
           a.id AS account_id,
           a.name AS account_name
         FROM statement_of_accounts soa
         LEFT JOIN accounts a ON soa.account_id = a.id
         WHERE soa.id = ?`,
        [insertedId]
      );

      const account = created.account_id
        ? {
            id: created.account_id,
            name: created.account_name || null,
          }
        : null;

      created.account = account;
      created.remainingBalance = Number(created.amountToPay || 0) - Number(created.amountPaid || 0);

      delete created.account_id;
      delete created.account_name;

      res.json({ success: 1, item: created });
    } catch (err) {
      console.error("POST /api/statement-of-accounts failed:", err);
      res.status(500).json({ error: "Failed to create statement" });
    }
  });

  // UPDATE
  app.put("/api/statement-of-accounts/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.get(`SELECT * FROM statement_of_accounts WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Not found" });

      const payload = {
        account_id:
          req.body.account_id === undefined ? existing.account_id : req.body.account_id,
        referenceNo:
          req.body.referenceNo === undefined ? existing.referenceNo : req.body.referenceNo,
        description:
          req.body.description === undefined ? existing.description : req.body.description,
        amountToPay:
          req.body.amountToPay === undefined
            ? existing.amountToPay
            : Number(req.body.amountToPay) || 0,
        amountPaid:
          req.body.amountPaid === undefined
            ? existing.amountPaid
            : Number(req.body.amountPaid) || 0,
        attachment:
          req.body.attachment === undefined ? existing.attachment : req.body.attachment,
        periodStart:
          req.body.periodStart === undefined ? existing.periodStart : req.body.periodStart,
        periodEnd:
          req.body.periodEnd === undefined ? existing.periodEnd : req.body.periodEnd,
      };

      await db.run(
        `UPDATE statement_of_accounts
         SET account_id = ?, referenceNo = ?, description = ?, amountToPay = ?, amountPaid = ?, attachment = ?, periodStart = ?, periodEnd = ?
         WHERE id = ?`,
        [
          payload.account_id,
          payload.referenceNo || null,
          payload.description || null,
          payload.amountToPay,
          payload.amountPaid,
          payload.attachment || null,
          payload.periodStart || null,
          payload.periodEnd || null,
          id,
        ]
      );

      const row = await db.get(
        `SELECT
           soa.*,
           a.id AS account_id,
           a.name AS account_name
         FROM statement_of_accounts soa
         LEFT JOIN accounts a ON soa.account_id = a.id
         WHERE soa.id = ?`,
        [id]
      );

      const account = row.account_id
        ? {
            id: row.account_id,
            name: row.account_name || null,
          }
        : null;

      row.account = account;
      row.remainingBalance = Number(row.amountToPay || 0) - Number(row.amountPaid || 0);

      delete row.account_id;
      delete row.account_name;

      res.json({ success: 1, item: row });
    } catch (err) {
      console.error("PUT /api/statement-of-accounts/:id failed:", err);
      res.status(500).json({ error: "Failed to update statement" });
    }
  });

  // DELETE
  app.delete("/api/statement-of-accounts/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.get(`SELECT * FROM statement_of_accounts WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Not found" });
      await db.run(`DELETE FROM statement_of_accounts WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("DELETE /api/statement-of-accounts/:id failed:", err);
      res.status(500).json({ error: "Failed to delete statement" });
    }
  });
}
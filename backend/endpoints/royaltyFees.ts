import express from "express";

export default function registerRoyaltyFees(app: express.Express, db: any) {
  // List royalty fees with pagination, search, date filters
  app.get("/api/royalty-fees", async (req, res) => {
    try {
      const perPage = Math.max(1, Number(req.query.perPage) || 10);
      const currentPage = Math.max(1, Number(req.query.currentPage) || 1);
      const search = (req.query.search as string || "").trim();
      const fromDate = (req.query.fromDate as string || "").trim();
      const toDate = (req.query.toDate as string || "").trim();
      const rawSortBy = (req.query.sortBy as string) || "createdOn";
      const rawSortDir = ((req.query.sortDir as string) || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

      // added computed balance and status to allow sorting by them
      const allowedSortCols: Record<string,string> = {
        mall: "a.mall",
        store: "a.store",
        partner: "a.partner",
        amountToPay: "rf.amountToPay",
        amountPaid: "rf.amountPaid",
        balance: "(COALESCE(rf.amountToPay,0) - COALESCE(rf.amountPaid,0))",
        status: `CASE
                   WHEN COALESCE(rf.amountToPay,0) > 0 AND COALESCE(rf.amountPaid,0) >= COALESCE(rf.amountToPay,0) THEN 'Paid'
                   WHEN COALESCE(rf.amountPaid,0) > 0 THEN 'Partial'
                   ELSE 'Unpaid'
                 END`,
        dueDate: "rf.dueDate",
        datePaid: "rf.datePaid",
        createdOn: "rf.createdOn",
      };
      const sortCol = allowedSortCols[rawSortBy] || "rf.createdOn";
      const orderClause = `ORDER BY ${sortCol} ${rawSortDir}, rf.id DESC`;

      const whereParts: string[] = [];
      const params: any[] = [];

      if (search) {
        whereParts.push("(a.mall LIKE ? OR a.store LIKE ? OR a.partner LIKE ? OR rf.amountToPay LIKE ?)");
        const like = `%${search}%`;
        params.push(like, like, like, like);
      }
      if (fromDate) {
        whereParts.push("rf.dueDate >= ?");
        params.push(fromDate);
      }
      if (toDate) {
        whereParts.push("rf.dueDate <= ?");
        params.push(toDate);
      }
      const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

      const totalRow = await db.get(
        `SELECT COUNT(*) as count
         FROM royalty_fees rf
         LEFT JOIN royalty_fees_accounts a ON a.id = rf.account_id
         ${whereClause}`,
        params
      );
      const total = totalRow?.count || 0;

      const offset = (currentPage - 1) * perPage;
      // interpolate numeric LIMIT/OFFSET to avoid driver issues with bound parameters for LIMIT
      const sql = `
        SELECT
          rf.*,
          a.id AS account_id,
          a.mall AS account_mall,
          a.store AS account_store,
          a.partner AS account_partner,
          a.status AS account_status,
          a.createdOn AS account_createdOn
        FROM royalty_fees rf
        LEFT JOIN royalty_fees_accounts a ON a.id = rf.account_id
        ${whereClause}
        ${orderClause}
        LIMIT ${Number(perPage)} OFFSET ${Number(offset)}
      `;
      const itemsRaw = await db.all(sql, params);

      const items = (itemsRaw || []).map((r: any) => {
        const account = r.account_id != null ? {
          id: r.account_id,
          mall: r.account_mall ?? null,
          store: r.account_store ?? null,
          partner: r.account_partner ?? null,
          status: r.account_status ?? null,
          createdOn: r.account_createdOn ?? null,
        } : null;

        // remove account_* helper fields
        const rest = { ...r };
        delete rest.account_id;
        delete rest.account_mall;
        delete rest.account_store;
        delete rest.account_partner;
        delete rest.account_status;
        delete rest.account_createdOn;

        return { ...rest, account };
      });

      res.json({ items, total });
    } catch (err) {
      console.error("GET /api/royalty-fees failed:", err);
      res.status(500).json({ error: "Failed to fetch royalty fees" });
    }
  });

  // Get single royalty fee
  app.get("/api/royalty-fees/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const row = await db.get(
        `SELECT
           rf.*,
           a.id AS account_id,
           a.mall AS account_mall,
           a.store AS account_store,
           a.partner AS account_partner,
           a.status AS account_status,
           a.createdOn AS account_createdOn
         FROM royalty_fees rf
         LEFT JOIN royalty_fees_accounts a ON a.id = rf.account_id
         WHERE rf.id = ?`, [id]);
      if (!row) return res.status(404).json({ error: "Not found" });

      const account = row.account_id != null ? {
        id: row.account_id,
        mall: row.account_mall ?? null,
        store: row.account_store ?? null,
        partner: row.account_partner ?? null,
        status: row.account_status ?? null,
        createdOn: row.account_createdOn ?? null,
      } : null;

      const rest = { ...row };
      delete rest.account_id;
      delete rest.account_mall;
      delete rest.account_store;
      delete rest.account_partner;
      delete rest.account_status;
      delete rest.account_createdOn;

      res.json({ ...rest, account });
    } catch (err) {
      console.error("GET /api/royalty-fees/:id failed:", err);
      res.status(500).json({ error: "Failed to fetch royalty fee" });
    }
  });

  // Create royalty fee (require account_id only)
  app.post("/api/royalty-fees", async (req, res) => {
    try {
      const {
        account_id,
        amountToPay,
        dueDate = null,
        amountPaid = 0,
        datePaid = null,
        attachment = null
      } = req.body || {};

      // require account_id
      const accountId = account_id ?? null;
      if (accountId == null) return res.status(400).json({ error: "account_id is required" });

      // verify account exists
      const accountRow = await db.get(`SELECT id FROM royalty_fees_accounts WHERE id = ?`, [accountId]);
      if (!accountRow) return res.status(400).json({ error: "account_id not found" });

      if (amountToPay === undefined || amountToPay === null || isNaN(Number(amountToPay))) {
        return res.status(400).json({ error: "amountToPay is required" });
      }

      const createdOn = new Date().toISOString().slice(0,19).replace("T"," ");
      const result = await db.run(
        `INSERT INTO royalty_fees (account_id, amountToPay, dueDate, amountPaid, datePaid, attachment, createdOn)
         VALUES (?,?,?,?,?,?,?)`,
        [
          accountId,
          Number(amountToPay),
          dueDate || null,
          Number(amountPaid || 0),
          datePaid || null,
          attachment || null,
          createdOn
        ]
      );

      const insertedId = result?.insertId || result?.lastID;
      const row = await db.get(
        `SELECT
           rf.*,
           a.id AS account_id,
           a.mall AS account_mall,
           a.store AS account_store,
           a.partner AS account_partner,
           a.status AS account_status,
           a.createdOn AS account_createdOn
         FROM royalty_fees rf
         LEFT JOIN royalty_fees_accounts a ON a.id = rf.account_id
         WHERE rf.id = ?`, [insertedId]);

      const account = row.account_id != null ? {
        id: row.account_id,
        mall: row.account_mall ?? null,
        store: row.account_store ?? null,
        partner: row.account_partner ?? null,
        status: row.account_status ?? null,
        createdOn: row.account_createdOn ?? null,
      } : null;

      const rest = { ...row };
      delete rest.account_id;
      delete rest.account_mall;
      delete rest.account_store;
      delete rest.account_partner;
      delete rest.account_status;
      delete rest.account_createdOn;

      res.json({ success: 1, item: { ...rest, account } });
    } catch (err) {
      console.error("POST /api/royalty-fees failed:", err);
      res.status(500).json({ error: "Failed to create royalty fee" });
    }
  });

  // Update royalty fee (persist account_id only)
  app.put("/api/royalty-fees/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.get(`SELECT * FROM royalty_fees WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Not found" });

      const {
        account_id = existing.account_id,
        amountToPay = existing.amountToPay,
        dueDate = existing.dueDate,
        amountPaid = existing.amountPaid,
        datePaid = existing.datePaid,
        attachment = existing.attachment
      } = req.body || {};

      const accountId = account_id ?? null;
      if (accountId == null) return res.status(400).json({ error: "account_id is required" });

      // verify account exists
      const accountRow = await db.get(`SELECT id FROM royalty_fees_accounts WHERE id = ?`, [accountId]);
      if (!accountRow) return res.status(400).json({ error: "account_id not found" });

      if (amountToPay === undefined || amountToPay === null || isNaN(Number(amountToPay))) {
        return res.status(400).json({ error: "amountToPay is required" });
      }

      await db.run(
        `UPDATE royalty_fees
           SET account_id = ?, amountToPay = ?, dueDate = ?, amountPaid = ?, datePaid = ?, attachment = ?
         WHERE id = ?`,
        [
          accountId,
          Number(amountToPay),
          dueDate || null,
          Number(amountPaid || 0),
          datePaid || null,
          attachment || null,
          id
        ]
      );

      const row = await db.get(
        `SELECT
           rf.*,
           a.id AS account_id,
           a.mall AS account_mall,
           a.store AS account_store,
           a.partner AS account_partner,
           a.status AS account_status,
           a.createdOn AS account_createdOn
         FROM royalty_fees rf
         LEFT JOIN royalty_fees_accounts a ON a.id = rf.account_id
         WHERE rf.id = ?`, [id]);

      const account = row.account_id != null ? {
        id: row.account_id,
        mall: row.account_mall ?? null,
        store: row.account_store ?? null,
        partner: row.account_partner ?? null,
        status: row.account_status ?? null,
        createdOn: row.account_createdOn ?? null,
      } : null;

      const rest = { ...row };
      delete rest.account_id;
      delete rest.account_mall;
      delete rest.account_store;
      delete rest.account_partner;
      delete rest.account_status;
      delete rest.account_createdOn;

      res.json({ success: 1, item: { ...rest, account } });
    } catch (err) {
      console.error("PUT /api/royalty-fees/:id failed:", err);
      res.status(500).json({ error: "Failed to update royalty fee" });
    }
  });

  // Delete royalty fee
  app.delete("/api/royalty-fees/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.get(`SELECT * FROM royalty_fees WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Not found" });
      await db.run(`DELETE FROM royalty_fees WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("DELETE /api/royalty-fees/:id failed:", err);
      res.status(500).json({ error: "Failed to delete royalty fee" });
    }
  });
}
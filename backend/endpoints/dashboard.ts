import express from "express";

export default function registerDashboard(app: express.Express, db: any) {
  app.get("/api/dashboard/summary", async (req, res) => {
    try {
      // optional month filter: accept YYYY-MM, numeric month (1-12) with year,
      // or omit month (or use 'all') with year to include all months in that year.
      const month = typeof req.query.month === "string" && req.query.month.trim() !== "" ? req.query.month.trim() : null;
      const yearParam = typeof req.query.year === "string" && req.query.year.trim() !== "" ? Number(req.query.year.trim()) : null;

      // parse month/year into year/month numbers (fall back to current month)
      const now = new Date();
      let filterYear: number = now.getFullYear();
      let filterMonth: number | null = now.getMonth() + 1;
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const parts = month.split("-");
        filterYear = Number(parts[0]);
        filterMonth = Number(parts[1]);
      } else if (month && /^\d{1,2}$/.test(month) && typeof yearParam === 'number' && Number.isFinite(yearParam)) {
        filterYear = yearParam;
        filterMonth = Number(month);
      } else if (typeof yearParam === 'number' && Number.isFinite(yearParam) && (!month || /^all$/i.test(month))) {
        filterYear = yearParam;
        filterMonth = null;
      } else {
        filterYear = now.getFullYear();
        filterMonth = now.getMonth() + 1;
      }

      const salesDateFilter = filterMonth === null
        ? `YEAR(s.saleDate) = ?`
        : `YEAR(s.saleDate) = ? AND MONTH(s.saleDate) = ?`;
      const salesDateParams: any[] = filterMonth === null ? [filterYear] : [filterYear, filterMonth];
      const expensePurchaseDateFilter = filterMonth === null
        ? `YEAR(purchaseDate) = ?`
        : `YEAR(purchaseDate) = ? AND MONTH(purchaseDate) = ?`;
      const expenseCreatedOnFilter = filterMonth === null
        ? `YEAR(createdOn) = ?`
        : `YEAR(createdOn) = ? AND MONTH(createdOn) = ?`;

      // optional category filter (pass category.name string — matches sales.category)
      const category = typeof req.query.category === "string" && req.query.category.trim() !== "" ? req.query.category.trim() : null;

      // compute how many sales match the selected month and optional category (useful for verification)
      let matchedSalesCount = 0;
      try {
        const matchedClauses: string[] = [];
        const matchedParams: any[] = [];
        matchedClauses.push(salesDateFilter);
        matchedParams.push(...salesDateParams);
        if (category) {
          matchedClauses.push("UPPER(TRIM(s.category)) = UPPER(TRIM(?))");
          matchedParams.push(category);
        }
        const matchedWhere = `WHERE ${matchedClauses.join(' AND ')}`;
        const rowMatched: any = await db.get(`SELECT COALESCE(COUNT(*),0) AS cnt FROM sales s ${matchedWhere}`, matchedParams);
        matchedSalesCount = Number(rowMatched?.cnt || 0);
      } catch (e) {
        console.error("dashboard: matched sales verification failed", e);
      }

      // helper clauses and params for sale/expense date filtering
      const saleDateClause = `WHERE ${salesDateFilter}`;
      const saleDateParams: any[] = [...salesDateParams];
      const expenseDateClause = `WHERE ${expensePurchaseDateFilter}`;
      const expenseDateParams: any[] = [...salesDateParams];

      // all-time expenses
      // when dateFrom/dateTo present, limit expenses by purchaseDate
      const rowExpenses: any = await db.get(
        `SELECT COALESCE(SUM(totalCost),0) AS allTimeExpenses FROM expenses ${expenseDateClause}`,
        expenseDateParams
      );

      // compute total sold price (total potential/upcoming sales even if unpaid)
      // sum of all sale_items.total across filtered sales (join to sales to apply date filter)
      const rowTotalSold: any = await db.get(
        `SELECT COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS totalSoldPrice
           FROM sale_items si
           JOIN sales s ON si.sale_id = s.id
      LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
          ${saleDateClause} ${category ? (saleDateClause ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ' WHERE UPPER(TRIM(s.category)) = UPPER(TRIM(?))') : ''}`,
        [...saleDateParams, ...(category ? [category] : [])]
      );

      const rowTotalCosting: any = await db.get(
          `SELECT COALESCE(SUM(((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) - COALESCE(p.costingPrice,0)) * COALESCE(si.quantity,1)),0) AS totalCostingPrice
           FROM sale_items si
           JOIN sales s ON si.sale_id = s.id
           LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
          WHERE ${salesDateFilter} ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}`,
        [...saleDateParams, ...(category ? [category] : [])]
      );

      // compute total payments accomplies (avoid ONLY_FULL_GROUP_BY errors)
      // restrict the sales pos set by date range when provided
      const normalizedSalePo = `COALESCE(NULLIF(TRIM(s.po_key), ''), NULLIF(TRIM(s.purchaseOrderNumber), ''))`;
      const posWhere = `WHERE ${normalizedSalePo} IS NOT NULL AND ${salesDateFilter} ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}`;
      // Build params so that each '?' placeholder in the query has a matching entry in the params array
      let posParams: any[] = [...salesDateParams];
      if (category) {
        posParams.push(category, category); // category appears in posWhere and again in the `su` subquery
      }
      const rowPaymentsAccomplies: any = await db.get(
        `SELECT COALESCE(SUM(
            CASE
              WHEN COALESCE(p.paid,0) > COALESCE(su.due,0) THEN COALESCE(su.due,0)
              ELSE COALESCE(p.paid,0)
            END
          ),0) AS totalPaymentsAccomplies
         FROM (
             SELECT DISTINCT ${normalizedSalePo} AS po
             FROM sales s
            ${posWhere}
         ) pos
         LEFT JOIN (
           SELECT COALESCE(NULLIF(TRIM(po_key), ''), NULLIF(TRIM(purchaseOrderNumber), '')) AS po, COALESCE(SUM(amount),0) AS paid
             FROM payments
            WHERE COALESCE(NULLIF(TRIM(po_key), ''), NULLIF(TRIM(purchaseOrderNumber), '')) IS NOT NULL
            GROUP BY COALESCE(NULLIF(TRIM(po_key), ''), NULLIF(TRIM(purchaseOrderNumber), ''))
         ) p ON p.po = pos.po
         LEFT JOIN (
           SELECT ${normalizedSalePo} AS po, COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS due
             FROM sales s
             JOIN sale_items si ON si.sale_id = s.id
        LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
            WHERE ${normalizedSalePo} IS NOT NULL ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
            GROUP BY ${normalizedSalePo}
         ) su ON su.po = pos.po`,
        posParams
      );

      // product quantities (aggregate quantities per product across all sale_items)
      // filter by selected month and optional category
      const pqWhereJoin = `JOIN sales s ON si.sale_id = s.id WHERE ${salesDateFilter} ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}`;
      const pqParams: any[] = category ? [...salesDateParams, category] : [...salesDateParams];
      const productQuantities: any[] = await db.all(
        `SELECT
            si.product_id AS productId,
            COALESCE(p.name,'') AS name,
            COALESCE(p.sku,'') AS sku,
            COALESCE(p.unit,'') AS unit,
            COALESCE(SUM(si.quantity),0) AS totalQuantity
          FROM sale_items si
          LEFT JOIN products p ON si.product_id = p.id
         ${pqWhereJoin}
         GROUP BY si.product_id
         ORDER BY totalQuantity DESC
         LIMIT 10`,
        pqParams
      );

      // sales today (sum of sale_items.total for sales with today's saleDate)
      // when filtering by date range, compute sales for the range; otherwise compute salesToday
      const rowSalesToday: any = await db.get(
        `SELECT COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS salesToday
           FROM sale_items si
           JOIN sales s ON si.sale_id = s.id
      LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
          WHERE ${salesDateFilter} ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}`,
        [...salesDateParams, ...(category ? [category] : [])]
      );

      // items sold today (sum of sale_items.quantity joined to sales for today's saleDate)
      const rowItemsToday: any = await db.get(
        `SELECT COALESCE(SUM(si.quantity),0) AS itemsSoldToday
           FROM sale_items si
           JOIN sales s ON si.sale_id = s.id
          WHERE ${salesDateFilter} ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}`,
        [...salesDateParams, ...(category ? [category] : [])]
      );

      // expenses today
      const rowExpensesToday: any = await db.get(
        `SELECT COALESCE(SUM(totalCost),0) AS expensesToday FROM expenses WHERE ${expenseCreatedOnFilter}`,
        [...salesDateParams]
      );

      // Build time-based aggregates and distributions server-side
      // For daily chart labels, year-only mode returns month labels.
      let dailyLabels: string[] = [];
      if (filterMonth === null) {
        dailyLabels = Array.from({ length: 12 }, (_, i) => String(i + 1));
      } else {
        const dayCount = new Date(filterYear, filterMonth, 0).getDate();
        dailyLabels = Array.from({ length: dayCount }, (_, i) => String(i + 1));
      }

      // daily sales for the selected month
      let dailySales: number[] = Array(dailyLabels.length).fill(0);
      const dailySalesRows: any[] = await db.all(
        filterMonth === null
          ? `SELECT MONTH(s.saleDate) AS day, COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS total
               FROM sales s
               JOIN sale_items si ON si.sale_id = s.id
          LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
              WHERE YEAR(s.saleDate) = ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
              GROUP BY MONTH(s.saleDate)`
          : `SELECT DAY(s.saleDate) AS day, COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS total
               FROM sales s
               JOIN sale_items si ON si.sale_id = s.id
          LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
              WHERE YEAR(s.saleDate) = ? AND MONTH(s.saleDate) = ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
              GROUP BY DAY(s.saleDate)`,
        [...salesDateParams, ...(category ? [category] : [])]
      );
      dailySalesRows.forEach((r) => {
        const d = Number(r.day);
        if (d >= 1 && d <= dailyLabels.length) dailySales[d - 1] = Number(r.total);
      });

      // daily expenses for selected month
      let dailyExpenses: number[] = Array(dailyLabels.length).fill(0);
      const dailyExpenseRows: any[] = await db.all(
        filterMonth === null
          ? `SELECT MONTH(purchaseDate) AS day, COALESCE(SUM(totalCost),0) AS total
               FROM expenses
              WHERE YEAR(purchaseDate) = ?
              GROUP BY MONTH(purchaseDate)`
          : `SELECT DAY(purchaseDate) AS day, COALESCE(SUM(totalCost),0) AS total
               FROM expenses
              WHERE YEAR(purchaseDate) = ? AND MONTH(purchaseDate) = ?
              GROUP BY DAY(purchaseDate)`,
        [...salesDateParams]
      );
      dailyExpenseRows.forEach((r) => {
        const d = Number(r.day);
        if (d >= 1 && d <= dailyLabels.length) dailyExpenses[d - 1] = Number(r.total);
      });

      // monthly sales for the year of the selected month
      const monthlySalesRows: any[] = await db.all(
        `SELECT MONTH(s.saleDate) AS m, COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS total
           FROM sales s
           JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
          WHERE YEAR(s.saleDate) = ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
          GROUP BY MONTH(s.saleDate)`,
        [...[filterYear], ...(category ? [category] : [])]
      );
      const monthlySales = Array(12).fill(0);
      monthlySalesRows.forEach((r) => {
        const m = Number(r.m);
        if (m >= 1 && m <= 12) monthlySales[m - 1] = Number(r.total);
      });

      // monthly expenses for the year of the selected month
      const monthlyExpenseRows: any[] = await db.all(
        `SELECT MONTH(purchaseDate) AS m, COALESCE(SUM(totalCost),0) AS total
           FROM expenses
          WHERE YEAR(purchaseDate) = ?
          GROUP BY MONTH(purchaseDate)`,
        [filterYear]
      );
      const monthlyExpenses = Array(12).fill(0);
      monthlyExpenseRows.forEach((r) => {
        const m = Number(r.m);
        if (m >= 1 && m <= 12) monthlyExpenses[m - 1] = Number(r.total);
      });

      // top sales channels for the selected month
      const topChannels: any[] = await db.all(
        `SELECT UPPER(COALESCE(s.salesChannel,'UNKNOWN')) AS name,
                COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS total
           FROM sales s
           JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
          WHERE ${salesDateFilter} ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
          GROUP BY UPPER(COALESCE(s.salesChannel,'UNKNOWN'))
          ORDER BY total DESC
          LIMIT 10`,
        [...salesDateParams, ...(category ? [category] : [])]
      );

      // expense distribution for the selected month
      const expenseDist: any[] = await db.all(
        `SELECT COALESCE(expenseCategory,'Miscellaneous') AS name,
                COALESCE(SUM(totalCost),0) AS total
           FROM expenses
          WHERE ${expensePurchaseDateFilter}
          GROUP BY COALESCE(expenseCategory,'Miscellaneous')
          ORDER BY total DESC
          LIMIT 10`,
        [...salesDateParams]
      );

      // orders in the selected month (count of sales records in month)
      const rowOrdersToday: any = category
        ? await db.get(`SELECT COALESCE(COUNT(*),0) AS ordersToday FROM sales WHERE ${filterMonth === null ? 'YEAR(saleDate) = ?' : 'YEAR(saleDate) = ? AND MONTH(saleDate) = ?'} AND UPPER(TRIM(category)) = UPPER(TRIM(?))`, [...salesDateParams, category])
        : await db.get(`SELECT COALESCE(COUNT(*),0) AS ordersToday FROM sales WHERE ${filterMonth === null ? 'YEAR(saleDate) = ?' : 'YEAR(saleDate) = ? AND MONTH(saleDate) = ?'}`, [...salesDateParams]);
      const ordersToday = Number(rowOrdersToday?.ordersToday || 0);

      // total purchase orders (count of sales records that have a PO number)
      const rowTotalPOs: any = category
        ? await db.get(`SELECT COALESCE(COUNT(*),0) AS totalPurchaseOrders FROM sales WHERE TRIM(purchaseOrderNumber) <> '' AND UPPER(TRIM(category)) = UPPER(TRIM(?))`, [category])
        : await db.get(`SELECT COALESCE(COUNT(*),0) AS totalPurchaseOrders FROM sales WHERE TRIM(purchaseOrderNumber) <> ''`);
      const totalPurchaseOrders = Number(rowTotalPOs?.totalPurchaseOrders || 0);

      // total agent commissions for selected month/category
      const rowAgentCom: any = category
        ? await db.get(
            `SELECT COALESCE(SUM(agentCommission),0) AS totalAgentCommissions FROM sales WHERE ${filterMonth === null ? 'YEAR(saleDate) = ?' : 'YEAR(saleDate) = ? AND MONTH(saleDate) = ?'} AND UPPER(TRIM(category)) = UPPER(TRIM(?))`,
            [...salesDateParams, category]
          )
        : await db.get(
            `SELECT COALESCE(SUM(agentCommission),0) AS totalAgentCommissions FROM sales WHERE ${filterMonth === null ? 'YEAR(saleDate) = ?' : 'YEAR(saleDate) = ? AND MONTH(saleDate) = ?'}`,
            [...salesDateParams]
          );
      const totalAgentCommissions = Number(rowAgentCom?.totalAgentCommissions || 0);

      // total paid / unpaid orders based on sales.paymentStatus (sales table authoritative)
      const rowPaid: any = category
        ? await db.get(`SELECT COALESCE(COUNT(*),0) AS totalPaidOrders FROM sales WHERE TRIM(purchaseOrderNumber) <> '' AND ${filterMonth === null ? 'YEAR(saleDate) = ?' : 'YEAR(saleDate) = ? AND MONTH(saleDate) = ?'} AND UPPER(TRIM(paymentStatus)) = 'PAID' AND UPPER(TRIM(category)) = UPPER(TRIM(?))`, [...salesDateParams, category])
        : await db.get(`SELECT COALESCE(COUNT(*),0) AS totalPaidOrders FROM sales WHERE TRIM(purchaseOrderNumber) <> '' AND ${filterMonth === null ? 'YEAR(saleDate) = ?' : 'YEAR(saleDate) = ? AND MONTH(saleDate) = ?'} AND UPPER(TRIM(paymentStatus)) = 'PAID'`, salesDateParams);
      const totalPaidOrders = Number(rowPaid?.totalPaidOrders || 0);

      // total partially paid orders (paymentStatus = 'Partial')
      const rowPartial: any = category
        ? await db.get(`SELECT COALESCE(COUNT(*),0) AS totalPaidOrdersPartially FROM sales WHERE TRIM(purchaseOrderNumber) <> '' AND ${filterMonth === null ? 'YEAR(saleDate) = ?' : 'YEAR(saleDate) = ? AND MONTH(saleDate) = ?'} AND UPPER(TRIM(paymentStatus)) = 'PARTIAL' AND UPPER(TRIM(category)) = UPPER(TRIM(?))`, [...salesDateParams, category])
        : await db.get(`SELECT COALESCE(COUNT(*),0) AS totalPaidOrdersPartially FROM sales WHERE TRIM(purchaseOrderNumber) <> '' AND ${filterMonth === null ? 'YEAR(saleDate) = ?' : 'YEAR(saleDate) = ? AND MONTH(saleDate) = ?'} AND UPPER(TRIM(paymentStatus)) = 'PARTIAL'`, salesDateParams);
      const totalPaidOrdersPartially = Number(rowPartial?.totalPaidOrdersPartially || 0);

      const rowUnpaid: any = category
        ? await db.get(`SELECT COALESCE(COUNT(*),0) AS totalUnpaidOrders FROM sales WHERE TRIM(purchaseOrderNumber) <> '' AND ${filterMonth === null ? 'YEAR(saleDate) = ?' : 'YEAR(saleDate) = ? AND MONTH(saleDate) = ?'} AND (paymentStatus IS NULL OR UPPER(TRIM(paymentStatus)) = 'UNPAID') AND UPPER(TRIM(category)) = UPPER(TRIM(?))`, [...salesDateParams, category])
        : await db.get(`SELECT COALESCE(COUNT(*),0) AS totalUnpaidOrders FROM sales WHERE TRIM(purchaseOrderNumber) <> '' AND ${filterMonth === null ? 'YEAR(saleDate) = ?' : 'YEAR(saleDate) = ? AND MONTH(saleDate) = ?'} AND (paymentStatus IS NULL OR UPPER(TRIM(paymentStatus)) = 'UNPAID')`, salesDateParams);
      const totalUnpaidOrders = Number(rowUnpaid?.totalUnpaidOrders || 0);

      const allTimeExpenses = Number(rowExpenses?.allTimeExpenses || 0);
      const totalSoldPrice = Number(rowTotalSold?.totalSoldPrice || 0);
      const totalCostingPrice = Number(rowTotalCosting?.totalCostingPrice || 0);
      const totalPaymentsAccomplies = Number(rowPaymentsAccomplies?.totalPaymentsAccomplies || 0);
      const salesToday = Number(rowSalesToday?.salesToday || 0);
      const itemsSoldToday = Number(rowItemsToday?.itemsSoldToday || 0);
      const expensesToday = Number(rowExpensesToday?.expensesToday || 0);

      // Gross profit based on realized deliveries/payments
      const allTimeGrossProfit = totalPaymentsAccomplies - allTimeExpenses;

      res.json({
         allTimeGrossProfit,
         allTimeExpenses,
         totalSoldPrice,
         totalCostingPrice,
         totalPaymentsAccomplies,
         matchedSalesCount,
         productQuantities,
         // charting and distribution payloads
         dailySales,
         dailyExpenses,
         dailyLabels,
         monthlySales,
         topChannels,
         expenseDist,
         ordersToday,
         totalPurchaseOrders,
         totalAgentCommissions,
         totalPaidOrders,
         totalPaidOrdersPartially,
         totalUnpaidOrders,
         salesToday,
         itemsSoldToday,
         expensesToday
       });
     } catch (err) {
       console.error("GET /api/dashboard/summary failed:", err);
       res.status(500).json({ error: "Failed to fetch dashboard summary" });
     }
   });

   // Agents commission report (aggregated server-side)
   app.get("/api/dashboard/agents/commissions", async (req, res) => {
     try {
       // optional date filters: expect YYYY-MM-DD
       const dateFrom =
         typeof req.query.dateFrom === "string" && req.query.dateFrom.trim() !== ""
           ? req.query.dateFrom.trim()
           : null;
       const dateTo =
         typeof req.query.dateTo === "string" && req.query.dateTo.trim() !== ""
           ? req.query.dateTo.trim()
           : null;

       // optional agent filter (pass agent id)
       const agentIdParam =
         typeof req.query.agentId === "string" && req.query.agentId.trim() !== ""
           ? Number(req.query.agentId.trim())
           : null;
       const agentId = Number.isFinite(agentIdParam) ? agentIdParam : null;

       // build date filter clauses for SQL
       const dateWhere = dateFrom && dateTo ? `AND DATE(saleDate) BETWEEN ? AND ?` : "";
       const dateParams = dateFrom && dateTo ? [dateFrom, dateTo] : [];

       // load agents map so we can translate id to full name
       const agentRows: any[] = await db.all(
         `SELECT id, fullName FROM agents`,
         []
       );
       const agentMap: Record<string, string> = {};
       agentRows.forEach((r) => {
         agentMap[String(r.id)] = r.fullName;
       });
       console.debug("agentMap loaded", agentMap); // debug: ensure map contains expected ids

       // helper to compute labels (between range or current month)
       let dailyLabels: string[] = [];
       if (dateFrom && dateTo) {
         const from = new Date(dateFrom);
         const to = new Date(dateTo);
         const dayCount = Math.max(
           1,
           Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
         );
         for (let i = 0; i < dayCount; i++) {
           const d = new Date(from);
           d.setDate(from.getDate() + i);
           dailyLabels.push(d.toISOString().slice(0, 10));
         }
       } else {
         const now = new Date();
         const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
         dailyLabels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
       }

       // build agent filter clause and params (used in commission queries)
       const agentClause = agentId ? `AND s.agent_id = ?` : "";
       const agentParamArray = agentId ? [agentId] : [];

       // fetch aggregated commission by day and by agent (agent stored in agent_id)
       // include rows even when agentCommission is null so we can identify the agent
       const dailyAgentRows: any[] = await db.all(
         `SELECT DATE(s.saleDate) AS day,
                 s.agent_id AS agent,
                 COALESCE(SUM(s.agentCommission),0) AS commission
            FROM sales s
           WHERE s.agent_id IS NOT NULL ${agentClause} ${dateWhere}
           GROUP BY DATE(s.saleDate), s.agent_id`,
         [...agentParamArray, ...dateParams]
       );
       console.debug("dailyAgentRows", dailyAgentRows); // debug

       // build a map keyed by day for totals and agent breakdown
       const dailyTotals: Record<string, { total: number; topAgentId: string | null; topAmt: number }> = {};
       dailyAgentRows.forEach((r) => {
         // normalize the key: if date range was provided use full ISO string, otherwise use day-of-month
         let dayKey: string;
         if (dateFrom && dateTo) {
           dayKey = String(r.day).slice(0, 10);
         } else {
           const dt = new Date(r.day);
           dayKey = String(dt.getDate());
         }
         const amt = Number(r.commission || 0);
         const agId = r.agent !== null ? String(r.agent) : null;
         if (!dailyTotals[dayKey]) {
           dailyTotals[dayKey] = { total: 0, topAgentId: agId, topAmt: amt };
         }
         dailyTotals[dayKey].total += amt;
         if (agId !== null && amt > (dailyTotals[dayKey].topAmt || 0)) {
           dailyTotals[dayKey].topAgentId = agId;
           dailyTotals[dayKey].topAmt = amt;
         }
       });
       console.debug("dailyTotals", JSON.stringify(dailyTotals,null,2));

       const dailyCommission = dailyLabels.map((label) => {
         const rec = dailyTotals[label] || { total: 0 };
         return rec.total;
       });
       const dailyAgentNames = dailyLabels.map((label) => {
         const rec = dailyTotals[label];
         if (rec && rec.topAgentId !== null && agentMap[rec.topAgentId]) {
           return agentMap[rec.topAgentId];
         }
         return "";
       });

       // monthly aggregation (month of year) – agent stored in agent_id column
       const monthlyAgentRows: any[] = await db.all(
         `SELECT MONTH(s.saleDate) AS m,
                 s.agent_id AS agent,
                 COALESCE(SUM(s.agentCommission),0) AS commission
            FROM sales s
           WHERE s.agent_id IS NOT NULL ${agentClause} ${dateWhere}
           GROUP BY MONTH(s.saleDate), s.agent_id`,
         [...agentParamArray, ...dateParams]
       );
       console.debug("monthlyAgentRows", monthlyAgentRows); // debug
       const monthlyTotals: Record<number, { total: number; topAgentId: string | null; topAmt: number }> = {};
       monthlyAgentRows.forEach((r) => {
         const m = Number(r.m);
         const amt = Number(r.commission || 0);
         const agId = r.agent !== null ? String(r.agent) : null;
         if (!monthlyTotals[m]) {
           monthlyTotals[m] = { total: 0, topAgentId: agId, topAmt: amt };
         }
         monthlyTotals[m].total += amt;
         if (agId !== null && amt > (monthlyTotals[m].topAmt || 0)) {
           monthlyTotals[m].topAgentId = agId;
           monthlyTotals[m].topAmt = amt;
         }
       });       const monthlyCommission = Array(12)
         .fill(0)
         .map((_, idx) => monthlyTotals[idx + 1]?.total || 0);
       const monthlyAgentNames = Array(12)
         .fill("")
         .map((_, idx) => {
           const rec = monthlyTotals[idx + 1];
           if (rec && rec.topAgentId !== null && agentMap[rec.topAgentId]) {
             return agentMap[rec.topAgentId];
           }
           return "";
         });

       // overall total commission
       const totalCommission = dailyCommission.reduce((a, b) => a + b, 0);

       // determine name for aggregated record
       const agName = agentId ? agentMap[String(agentId)] || "Unknown Agent" : "All Agents";

       res.json({
         allTimeRecord: { agentName: agName, commission: totalCommission },
         dailyLabels,
         dailyAgentNames,
         dailyCommission,
         monthlyAgentNames,
         monthlyCommission,
       });
     } catch (err) {
       console.error("GET /api/dashboard/agents/commissions failed:", err);
       res.status(500).json({ error: "Failed to fetch agent commissions" });
     }
   });

   // New: sales summary for Reports (aggregated server-side)
   app.get("/api/dashboard/sales/summary", async (req, res) => {
     try {
       // optional date filters: expect YYYY-MM-DD
       const dateFrom =
         typeof req.query.dateFrom === "string" && req.query.dateFrom.trim() !== ""
           ? req.query.dateFrom.trim()
           : null;
       const dateTo =
         typeof req.query.dateTo === "string" && req.query.dateTo.trim() !== ""
           ? req.query.dateTo.trim()
           : null;
       // optional category filter (name string)
       const category = typeof req.query.category === "string" && req.query.category.trim() !== "" ? req.query.category.trim() : null;


       // helpers for where clauses
       const saleDateWhere = dateFrom && dateTo ? `WHERE DATE(s.saleDate) BETWEEN ? AND ?` : "";
       const saleDateParams = dateFrom && dateTo ? [dateFrom, dateTo] : [];
       const expenseDateWhere = dateFrom && dateTo ? `WHERE DATE(purchaseDate) BETWEEN ? AND ?` : "";
       const expenseDateParams = dateFrom && dateTo ? [dateFrom, dateTo] : [];

       // totals
       const rowTotalSales: any = await db.get(
         `SELECT COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS totalSales
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
      LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
           ${saleDateWhere} ${category ? (saleDateWhere ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ' WHERE UPPER(TRIM(s.category)) = UPPER(TRIM(?))') : ''}`,
         [...saleDateParams, ...(category ? [category] : [])]
       );
       const totalSales = Number(rowTotalSales?.totalSales || 0);

       const rowItemsSold: any = await db.get(
         `SELECT COALESCE(SUM(si.quantity),0) AS itemsSold
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
           ${saleDateWhere} ${category ? (saleDateWhere ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ' WHERE UPPER(TRIM(s.category)) = UPPER(TRIM(?))') : ''}`,
         [...saleDateParams, ...(category ? [category] : [])]
       );
       const itemsSold = Number(rowItemsSold?.itemsSold || 0);

       const rowTotalExpenses: any = await db.get(
         `SELECT COALESCE(SUM(totalCost),0) AS totalExpenses FROM expenses ${expenseDateWhere}`,
         expenseDateParams
       );
       const totalExpenses = Number(rowTotalExpenses?.totalExpenses || 0);

       // daily labels and series (if date range provided return exact days, else current month days)
       let dailyLabels: string[] = [];
       if (dateFrom && dateTo) {
         const from = new Date(dateFrom);
         const to = new Date(dateTo);
         const dayCount = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
         for (let i = 0; i < dayCount; i++) {
           const d = new Date(from);
           d.setDate(from.getDate() + i);
           dailyLabels.push(d.toISOString().slice(0, 10));
         }
       } else {
         const now = new Date();
         const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
         dailyLabels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
       }

       // daily sales (map by date)
       let dailySales: number[] = Array(dailyLabels.length).fill(0);
       if (dateFrom && dateTo) {
         const rows: any[] = await db.all(
           `SELECT DATE(s.saleDate) AS day, COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS total
              FROM sales s
              JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
             WHERE DATE(s.saleDate) BETWEEN ? AND ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
             GROUP BY DATE(s.saleDate)`,
           [...[dateFrom, dateTo], ...(category ? [category] : [])]
         );
         const map: Record<string, number> = {};
         rows.forEach((r) => (map[String(r.day)] = Number(r.total)));
         dailyLabels.forEach((label, i) => {
           dailySales[i] = Number(map[label] || 0);
         });
       } else {
         const now = new Date();
         const rows: any[] = await db.all(
           `SELECT DAY(s.saleDate) AS day, COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS total
              FROM sales s
              JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
             WHERE YEAR(s.saleDate) = ? AND MONTH(s.saleDate) = ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
             GROUP BY DAY(s.saleDate)`,
           [...[now.getFullYear(), now.getMonth() + 1], ...(category ? [category] : [])]
         );
         const daysInMonth = dailyLabels.length;
         rows.forEach((r) => {
           const d = Number(r.day);
           if (d >= 1 && d <= daysInMonth) dailySales[d - 1] = Number(r.total);
         });
       }

      // daily items sold (per day)
      let dailyItems: number[] = Array(dailyLabels.length).fill(0);
      if (dateFrom && dateTo) {
        const rowsItems: any[] = await db.all(
          `SELECT DATE(s.saleDate) AS day, COALESCE(SUM(si.quantity),0) AS items
             FROM sales s
             JOIN sale_items si ON si.sale_id = s.id
            WHERE DATE(s.saleDate) BETWEEN ? AND ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
            GROUP BY DATE(s.saleDate)`,
          [...[dateFrom, dateTo], ...(category ? [category] : [])]
        );
        const mapItems: Record<string, number> = {};
        rowsItems.forEach((r) => (mapItems[String(r.day)] = Number(r.items)));
        dailyLabels.forEach((label, i) => {
          dailyItems[i] = Number(mapItems[label] || 0);
        });
      } else {
        const now = new Date();
        const rowsItems: any[] = await db.all(
          `SELECT DAY(s.saleDate) AS day, COALESCE(SUM(si.quantity),0) AS items
             FROM sales s
             JOIN sale_items si ON si.sale_id = s.id
            WHERE YEAR(s.saleDate) = ? AND MONTH(s.saleDate) = ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
            GROUP BY DAY(s.saleDate)`,
          [...[now.getFullYear(), now.getMonth() + 1], ...(category ? [category] : [])]
        );
        const daysInMonth = dailyLabels.length;
        rowsItems.forEach((r) => {
          const d = Number(r.day);
          if (d >= 1 && d <= daysInMonth) dailyItems[d - 1] = Number(r.items);
        });
      }

       // monthly aggregates (sales & expenses)
       const monthlySalesRows: any[] = await db.all(
         dateFrom && dateTo
           ? `SELECT MONTH(s.saleDate) AS m, COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS total
              FROM sales s
              JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
             WHERE DATE(s.saleDate) BETWEEN ? AND ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
             GROUP BY MONTH(s.saleDate)`
           : `SELECT MONTH(s.saleDate) AS m, COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS total
              FROM sales s
              JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
             WHERE YEAR(s.saleDate) = ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
             GROUP BY MONTH(s.saleDate)`,
         dateFrom && dateTo ? [...[dateFrom, dateTo], ...(category ? [category] : [])] : [...[new Date().getFullYear()], ...(category ? [category] : [])]
       );
       const monthlySales = Array(12).fill(0);
       monthlySalesRows.forEach((r) => {
         const m = Number(r.m);
         if (m >= 1 && m <= 12) monthlySales[m - 1] = Number(r.total);
       });

      // monthly items sold (per month) — apply category filter when present
      const monthlyItemsRows: any[] = dateFrom && dateTo
        ? await db.all(
            `SELECT MONTH(s.saleDate) AS m, COALESCE(SUM(si.quantity),0) AS items
               FROM sales s
               JOIN sale_items si ON si.sale_id = s.id
              WHERE DATE(s.saleDate) BETWEEN ? AND ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
              GROUP BY MONTH(s.saleDate)`,
            [...[dateFrom, dateTo], ...(category ? [category] : [])]
          )
        : await db.all(
            `SELECT MONTH(s.saleDate) AS m, COALESCE(SUM(si.quantity),0) AS items
               FROM sales s
               JOIN sale_items si ON si.sale_id = s.id
              WHERE YEAR(s.saleDate) = ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
              GROUP BY MONTH(s.saleDate)`,
            [...[new Date().getFullYear()], ...(category ? [category] : [])]
          );
      const monthlyItems = Array(12).fill(0);
      monthlyItemsRows.forEach((r) => {
        const m = Number(r.m);
        if (m >= 1 && m <= 12) monthlyItems[m - 1] = Number(r.items);
      });

       // top products (by total sales)
       const topProductsRows: any[] = await db.all(
         dateFrom && dateTo
           ? `SELECT COALESCE(p.name,'Unknown') AS name, COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS total
              FROM sale_items si
              LEFT JOIN products p ON si.product_id = p.id
              JOIN sales s ON si.sale_id = s.id
      LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
             WHERE DATE(s.saleDate) BETWEEN ? AND ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
             GROUP BY si.product_id
             ORDER BY total DESC
             LIMIT 20`
           : `SELECT COALESCE(p.name,'Unknown') AS name, COALESCE(SUM((COALESCE(si.price,0) - (CASE WHEN COALESCE(si.discount,0) <> 0 THEN COALESCE(si.discount,0) ELSE COALESCE(cpd.discount_value,0) END) + COALESCE(si.tax,0)) * COALESCE(si.quantity,1)),0) AS total
              FROM sale_items si
              LEFT JOIN products p ON si.product_id = p.id
              JOIN sales s ON si.sale_id = s.id
      LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
             WHERE YEAR(s.saleDate) = ? ${category ? ' AND UPPER(TRIM(s.category)) = UPPER(TRIM(?))' : ''}
             GROUP BY si.product_id
             ORDER BY total DESC
             LIMIT 20`,
         dateFrom && dateTo ? [...[dateFrom, dateTo], ...(category ? [category] : [])] : [...[new Date().getFullYear()], ...(category ? [category] : [])]
       );
       const topProducts = topProductsRows.map((r) => ({ name: r.name, total: Number(r.total) }));

       const grossProfit = totalSales - totalExpenses;
       const grossProfitMargin = totalSales ? Math.round((grossProfit / totalSales) * 100) : 0;

       res.json({
         allTimeRecord: {
           itemsSold,
           sales: totalSales,
           expenses: totalExpenses,
           grossProfit,
           grossProfitMargin,
         },
         dailyLabels,
         dailySales,
         dailyItems,
         monthlySales,
         monthlyItems,
         topProducts,
       });
     } catch (err) {
       console.error("GET /api/dashboard/sales/summary failed:", err);
       res.status(500).json({ error: "Failed to fetch sales summary" });
     }
   });

   // New: expense summary for Expense Report (aggregated server-side)
   app.get("/api/dashboard/expense/summary", async (req, res) => {
     try {
       const dateFrom =
         typeof req.query.dateFrom === "string" && req.query.dateFrom.trim() !== ""
           ? req.query.dateFrom.trim()
           : null;
       const dateTo =
         typeof req.query.dateTo === "string" && req.query.dateTo.trim() !== ""
           ? req.query.dateTo.trim()
           : null;

       // build daily labels (range or current month)
       let dailyLabels: string[] = [];
       if (dateFrom && dateTo) {
         const from = new Date(dateFrom);
         const to = new Date(dateTo);
         const dayCount = Math.max(
           1,
           Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
         );
         for (let i = 0; i < dayCount; i++) {
           const d = new Date(from);
           d.setDate(from.getDate() + i);
           dailyLabels.push(d.toISOString().slice(0, 10));
         }
       } else {
         const now = new Date();
         const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
         dailyLabels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
       }

       // daily expenses
       const dailyExpenses = Array(dailyLabels.length).fill(0);
       if (dateFrom && dateTo) {
         const rows: any[] = await db.all(
           `SELECT DATE(purchaseDate) AS day, COALESCE(SUM(totalCost),0) AS total
              FROM expenses
             WHERE DATE(purchaseDate) BETWEEN ? AND ?
             GROUP BY DATE(purchaseDate)`,
           [dateFrom, dateTo]
         );
         const map: Record<string, number> = {};
         rows.forEach((r) => (map[String(r.day)] = Number(r.total)));
         dailyLabels.forEach((label, i) => {
           dailyExpenses[i] = Number(map[label] || 0);
         });
       } else {
         const now = new Date();
         const rows: any[] = await db.all(
           `SELECT DAY(purchaseDate) AS day, COALESCE(SUM(totalCost),0) AS total
              FROM expenses
             WHERE YEAR(purchaseDate) = ? AND MONTH(purchaseDate) = ?
             GROUP BY DAY(purchaseDate)`,
           [now.getFullYear(), now.getMonth() + 1]
         );
         const daysInMonth = dailyLabels.length;
         rows.forEach((r) => {
           const d = Number(r.day);
           if (d >= 1 && d <= daysInMonth) dailyExpenses[d - 1] = Number(r.total);
         });
       }

       const dailyTotal = dailyExpenses.reduce((a, b) => a + b, 0);
       const dailyPeak = dailyExpenses.length ? Math.max(...dailyExpenses) : 0;

       // monthly expenses (current year or range)
       const now = new Date();
       const currentYear = now.getFullYear();
       const monthlyExpenseRows: any[] = dateFrom && dateTo
         ? await db.all(
             `SELECT MONTH(purchaseDate) AS m, COALESCE(SUM(totalCost),0) AS total
                FROM expenses
               WHERE DATE(purchaseDate) BETWEEN ? AND ?
               GROUP BY MONTH(purchaseDate)`,
             [dateFrom, dateTo]
           )
         : await db.all(
             `SELECT MONTH(purchaseDate) AS m, COALESCE(SUM(totalCost),0) AS total
                FROM expenses
               WHERE YEAR(purchaseDate) = ?
               GROUP BY MONTH(purchaseDate)`,
             [currentYear]
           );
       const monthlyExpenses = Array(12).fill(0);
       monthlyExpenseRows.forEach((r) => {
         const m = Number(r.m);
         if (m >= 1 && m <= 12) monthlyExpenses[m - 1] = Number(r.total);
       });
       const monthlyTotal = monthlyExpenses.reduce((a, b) => a + b, 0);
       const monthlyPeak = monthlyExpenses.length ? Math.max(...monthlyExpenses) : 0;

       // yearly expenses (last 5 years)
       const endYear = currentYear;
       const startYear = currentYear - 4;
       const yearlyLabels = Array.from({ length: 5 }, (_, i) => String(startYear + i));
       const yearlyRows: any[] = await db.all(
         `SELECT YEAR(purchaseDate) AS y, COALESCE(SUM(totalCost),0) AS total
            FROM expenses
           WHERE YEAR(purchaseDate) BETWEEN ? AND ?
           GROUP BY YEAR(purchaseDate)`,
         [startYear, endYear]
       );
       const yearlyExpenses = Array(5).fill(0);
       yearlyRows.forEach((r) => {
         const y = Number(r.y);
         const idx = y - startYear;
         if (idx >= 0 && idx < 5) yearlyExpenses[idx] = Number(r.total);
       });
       const yearlyTotal = yearlyExpenses.reduce((a, b) => a + b, 0);
       const yearlyPeak = yearlyExpenses.length ? Math.max(...yearlyExpenses) : 0;

       // categories breakdown — include all defined categories (zero totals) and misc/uncategorized
       let categoriesRows: any[] = [];
       if (dateFrom && dateTo) {
         categoriesRows = await db.all(
           `SELECT c.name AS category, COALESCE(SUM(e.totalCost),0) AS total
              FROM expense_categories c
              LEFT JOIN expenses e ON e.expenseCategory = c.name AND DATE(e.purchaseDate) BETWEEN ? AND ?
             GROUP BY c.name`,
           [dateFrom, dateTo]
         );
         const unc: any = await db.get(
           `SELECT COALESCE(SUM(totalCost),0) AS total FROM expenses WHERE (expenseCategory IS NULL OR expenseCategory NOT IN (SELECT name FROM expense_categories)) AND DATE(purchaseDate) BETWEEN ? AND ?`,
           [dateFrom, dateTo]
         );
         if (Number(unc?.total || 0) > 0) categoriesRows.push({ category: "Miscellaneous", total: Number(unc.total) });
       } else {
         categoriesRows = await db.all(
           `SELECT c.name AS category, COALESCE(SUM(e.totalCost),0) AS total
              FROM expense_categories c
              LEFT JOIN expenses e ON e.expenseCategory = c.name
             GROUP BY c.name`
         );
         const unc: any = await db.get(
           `SELECT COALESCE(SUM(totalCost),0) AS total FROM expenses WHERE expenseCategory IS NULL OR expenseCategory NOT IN (SELECT name FROM expense_categories)`
         );
         if (Number(unc?.total || 0) > 0) categoriesRows.push({ category: "Miscellaneous", total: Number(unc.total) });
       }
      // sort and limit (top 50)
      categoriesRows = categoriesRows
        .map((r) => ({ category: r.category, total: Number(r.total || 0) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 50);
      const categoriesTotal = categoriesRows.reduce((acc, r) => acc + Number(r.total || 0), 0);
      const categories = categoriesRows.map((r) => ({
        category: r.category,
        expenses: Number(r.total || 0),
        percent: categoriesTotal ? (Number(r.total || 0) / categoriesTotal) * 100 : 0,
      }));

       res.json({
         dailyLabels,
         dailyExpenses,
         dailyTotal,
         dailyPeak,
         monthlyExpenses,
         monthlyTotal,
         monthlyPeak,
         yearlyLabels,
         yearlyExpenses,
         yearlyTotal,
         yearlyPeak,
         categories,
         categoriesTotal,
       });
     } catch (err) {
       console.error("GET /api/dashboard/expense/summary failed:", err);
       res.status(500).json({ error: "Failed to fetch expense summary" });
     }
   });
 }
import express from "express";

export default function registerPayments(app: express.Express, db: any,) {
  function normalizePoKey(v: any): string | null {
    const s = (v ?? "").toString().trim();
    return s ? s : null;
  }

  // Helper function to update sale payment status based on ALL payments for a PO
  async function updateSalePaymentStatusForPO(purchaseOrderNumber: string) {
    try {
      if (!purchaseOrderNumber) return;

      const po = normalizePoKey(purchaseOrderNumber);
      if (!po) return;

      // Locate sale (trimmed comparision) — we update all sales that match this PO
      const saleRow: any = await db.get(
        `SELECT id
           FROM sales
          WHERE COALESCE(po_key, NULLIF(TRIM(purchaseOrderNumber), '')) = ?
          LIMIT 1`,
        [po]
      );
      if (!saleRow) return;

      // Net amount due = sum of sale_items.total (after discounts)
      const dueRow = await db.get(
        `SELECT COALESCE(SUM(total),0) as netDue FROM sale_items WHERE sale_id = ?`,
        [saleRow.id]
      );
      const netDue = Number(dueRow?.netDue || 0);

      // Sum all payments (treat NULL/empty amounts as 0)
      const paidRow = await db.get(
        `SELECT COALESCE(SUM(amount),0) as paid
           FROM payments
          WHERE COALESCE(po_key, NULLIF(TRIM(purchaseOrderNumber), '')) = ?`,
        [po]
      );
      const paid = Number(paidRow?.paid || 0);

      let newStatus = "Unpaid";
      if (netDue <= 0) newStatus = "Unpaid";
      else if (paid >= netDue && netDue > 0) newStatus = "Paid";
      else if (paid > 0 && paid < netDue) newStatus = "Partial";

      // Update all sales rows that match this PO (use TRIM to avoid whitespace mismatch)
      await db.run(
        `UPDATE sales
            SET paymentStatus = ?
          WHERE COALESCE(po_key, NULLIF(TRIM(purchaseOrderNumber), '')) = ?`,
        [newStatus, po]
      );
    } catch (err) {
      console.error("Failed to update sale payment status (aggregate):", err);
    }
  }

  // helper: fetch sale by purchaseOrderNumber (includes items)
  async function getSaleByPO(purchaseOrderNumber: string) {
    if (!purchaseOrderNumber) return null;
    try {
      const po = normalizePoKey(purchaseOrderNumber);
      if (!po) return null;
      const sale: any = await db.get(
        `SELECT s.*,
                c.id as customer_id, c.fullName as customer_fullName, c.email as customer_email,
                c.phoneNumber as customer_phoneNumber, c.storeName as customer_storeName,
                c.address as customer_address, c.country as customer_country, c.status as customer_status
           FROM sales s
           LEFT JOIN customers c ON s.customer_id = c.id
           WHERE COALESCE(s.po_key, NULLIF(TRIM(s.purchaseOrderNumber), '')) = ?
           LIMIT 1`,
        [po]
      );
      if (!sale) return null;

      const items = await db.all(
        `SELECT si.id, si.product_id, si.quantity, si.price, si.discount, si.tax, si.total,
                p.sku, p.name, p.unit
           FROM sale_items si
           LEFT JOIN products p ON si.product_id = p.id
           WHERE si.sale_id = ?`,
        [sale.id]
      );

      const products = (items || []).map((r: any) => {
        const unitPrice = Number(r.price ?? 0);
        const qty = Number(r.quantity ?? 1);
        const discount = Number(r.discount ?? 0);
        const tax = Number(r.tax ?? 0);
        const lineTotal =
          typeof r.total !== "undefined" && r.total !== null
            ? Number(r.total)
            : (unitPrice - discount + tax) * qty;
        return {
          id: r.id,
            product_id: r.product_id,
          sku: r.sku,
          name: r.name,
          price: unitPrice,
          quantity: qty,
          discount,
          tax,
          total: lineTotal,
        };
      });

      const gross = products.reduce(
        (s: number, it: any) =>
          s + ((Number(it.price || 0) + Number(it.tax || 0)) * Number(it.quantity || 1)),
        0
      );
      const net = products.reduce((s: number, it: any) => s + Number(it.total || 0), 0);
      const totalDiscount = Math.max(gross - net, 0);

      const customer = sale.customer_id
        ? {
            id: sale.customer_id,
            fullName: sale.customer_fullName,
            email: sale.customer_email,
            phoneNumber: sale.customer_phoneNumber,
            storeName: sale.customer_storeName,
            address: sale.customer_address,
            country: sale.customer_country,
            status: sale.customer_status,
          }
        : null;

      return {
        ...sale,
        customer,
        products,
        grandTotal: gross,      // pre-discount
        totalDiscount,
        netTotal: net,          // amount actually due
      };
    } catch (err) {
      console.warn("Failed to load sale for PO", purchaseOrderNumber, err);
      return null;
    }
  }

  // helper: compute running balance for payments grouped by purchaseOrderNumber
  function computeRunningBalances(payments: any[]): any[] {
    const grouped: Record<string, any[]> = {};
    for (const p of payments) {
      const po = p.purchaseOrderNumber;
      if (!po) continue;
      (grouped[po] ||= []).push(p);
    }

    Object.keys(grouped).forEach((po) => {
      const group = grouped[po];

      // Stable chronological ordering (date then id)
      group.sort((a, b) => {
        const aDate = new Date(a.paymentDate || a.createdOn).getTime();
        const bDate = new Date(b.paymentDate || b.createdOn).getTime();
        if (aDate !== bDate) return aDate - bDate;
        return Number(a.id) - Number(b.id);
      });

      // Force the auto-created zero-amount payment (if any) to be FIRST (parent)
      const zeroIdx = group.findIndex(
        (g) => Number(g.amount || 0) === 0
      );
      if (zeroIdx > 0) {
        const zeroPayment = group.splice(zeroIdx, 1)[0];
        group.unshift(zeroPayment);
      }

      // Amount due (netTotal preferred)
      const amountDue = Number(
        group[0]?.sale?.netTotal ??
          group[0]?.sale?.grandTotal ??
          0
      );

      let paidSoFar = 0;
      for (const p of group) {
        paidSoFar += Number(p.amount || 0);
        p.runningBalance = Math.max(amountDue - paidSoFar, 0);
      }
    });

    // Fill defaults for payments without sale context
    for (const p of payments) {
      if (
        !p.purchaseOrderNumber ||
        !(p.sale?.netTotal || p.sale?.grandTotal)
      ) {
        p.runningBalance = 0;
      }
    }

    return payments;
  }
  // API: Get payments (with pagination and search)
  app.get("/api/payments", async (req, res) => {
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;

    const search = (req.query.search as string || "").trim();
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const statusRaw = String(
      req.query.status ??
      req.query.paymentStatus ??
      req.query.filterStatus ??
      req.query.statusFilter ??
      req.query.payment_status ??
      ""
    ).trim();

    const allowedSortCols: Record<string, string> = {
      purchaseOrderNumber: "t.po_key",
      createdOn: "t.createdOn",
      paymentDate: "t.paymentDate",
      // new sortable columns mapped to joined/derived fields
      customer: "COALESCE(c.fullName, '')",
      // compute total from sale_items (do not assume s.grandTotal/s.netTotal DB columns)
      total: `(SELECT COALESCE(SUM(si.total),0) FROM sale_items si WHERE si.sale_id = s.id)`,
      amount: "t.amount",
      balance: `((SELECT COALESCE(SUM(si.total),0) FROM sale_items si WHERE si.sale_id = s.id) - COALESCE(t.amount,0))`,
      paymentChannel: "t.paymentChannel",
      paymentStatus: "s.paymentStatus",
      deliveryStatus: "d.status",
      dueDate: "t.dueDate"
    };
    const rawSortBy = (req.query.sortBy as string) || "createdOn";
    const rawSortDir =
      ((req.query.sortDir as string) || "").toLowerCase() === "asc" ? "ASC" : "DESC";
    const sortExpr = allowedSortCols[rawSortBy] || allowedSortCols.createdOn;
    const pPoExpr = `COALESCE(NULLIF(TRIM(p.po_key), ''), NULLIF(TRIM(p.purchaseOrderNumber), ''))`;
    const p2PoExpr = `COALESCE(NULLIF(TRIM(p2.po_key), ''), NULLIF(TRIM(p2.purchaseOrderNumber), ''))`;
    const s2PoExpr = `COALESCE(NULLIF(TRIM(s2.po_key), ''), NULLIF(TRIM(s2.purchaseOrderNumber), ''))`;
    const tPoExpr = `t.po_key_norm`;
    const sPoExpr = `COALESCE(NULLIF(TRIM(s.po_key), ''), NULLIF(TRIM(s.purchaseOrderNumber), ''))`;
    const dPoExpr = `COALESCE(NULLIF(TRIM(d.po_key), ''), NULLIF(TRIM(d.purchaseOrderNumber), ''))`;
    const dateSaleJoin = `
        LEFT JOIN sales sDate
          ON COALESCE(NULLIF(TRIM(sDate.po_key), ''), NULLIF(TRIM(sDate.purchaseOrderNumber), '')) = ${pPoExpr}
      `;

    // Base filters applied to payments rows before picking latest-per-PO
    const baseWhere: string[] = [`${pPoExpr} IS NOT NULL AND ${pPoExpr} <> ''`];
    const params: any[] = [];

    const normalizedStatus = statusRaw.toLowerCase();
    const paymentSource = normalizedStatus === "unpaid"
      ? `(
          SELECT pBase.id, pBase.parentPaymentId, pBase.referenceNo,
                 pBase.purchaseOrderNumber, pBase.amount, pBase.paymentChannel,
                 pBase.description, pBase.createdOn, pBase.paymentDate,
                 pBase.dueDate, pBase.attachment, pBase.po_key
            FROM payments pBase
          UNION ALL
          SELECT NULL AS id, NULL AS parentPaymentId, '' AS referenceNo,
                 COALESCE(NULLIF(TRIM(sBase.po_key), ''), NULLIF(TRIM(sBase.purchaseOrderNumber), '')) AS purchaseOrderNumber,
                 0 AS amount, '' AS paymentChannel, '' AS description,
                 sBase.createdOn, NULL AS paymentDate, NULL AS dueDate,
                 '' AS attachment,
                 COALESCE(NULLIF(TRIM(sBase.po_key), ''), NULLIF(TRIM(sBase.purchaseOrderNumber), '')) AS po_key
            FROM sales sBase
           WHERE COALESCE(NULLIF(TRIM(sBase.po_key), ''), NULLIF(TRIM(sBase.purchaseOrderNumber), '')) IS NOT NULL
             AND NOT EXISTS (
               SELECT 1
                 FROM payments pBaseCheck
                WHERE COALESCE(NULLIF(TRIM(pBaseCheck.po_key), ''), NULLIF(TRIM(pBaseCheck.purchaseOrderNumber), '')) =
                      COALESCE(NULLIF(TRIM(sBase.po_key), ''), NULLIF(TRIM(sBase.purchaseOrderNumber), ''))
             )
        )`
      : "payments";
    let statusCondition = "";
    if (normalizedStatus === "paid") {
      statusCondition = `COALESCE(statusAgg.paid_total, 0) >= statusAgg.due_total AND statusAgg.due_total > 0`;
    } else if (normalizedStatus === "partial") {
      statusCondition = `COALESCE(statusAgg.paid_total, 0) > 0 AND COALESCE(statusAgg.paid_total, 0) < statusAgg.due_total`;
    } else if (normalizedStatus === "unpaid") {
      statusCondition = `(COALESCE(statusAgg.due_total, 0) <= 0 OR statusAgg.due_total > COALESCE(statusAgg.paid_total, 0))`;
    }

    const statusJoins = statusCondition
      ? `
        LEFT JOIN (
          SELECT dueAgg.po, dueAgg.due_total, COALESCE(paidAgg.paid_total, 0) AS paid_total
            FROM (
              SELECT COALESCE(NULLIF(TRIM(sStatus.po_key), ''), NULLIF(TRIM(sStatus.purchaseOrderNumber), '')) AS po,
                     COALESCE(SUM(
                       (COALESCE(siStatus.price, 0) -
                        CASE
                          WHEN COALESCE(siStatus.discount, 0) <> 0 THEN COALESCE(siStatus.discount, 0)
                          ELSE COALESCE(cpdStatus.discount_value, 0)
                        END + COALESCE(siStatus.tax, 0)) * COALESCE(siStatus.quantity, 1)
                     ), 0) AS due_total
                FROM sales sStatus
                JOIN sale_items siStatus ON siStatus.sale_id = sStatus.id
                LEFT JOIN customer_product_discounts cpdStatus
                  ON cpdStatus.customer_id = sStatus.customer_id
                 AND cpdStatus.product_id = siStatus.product_id
               WHERE COALESCE(NULLIF(TRIM(sStatus.po_key), ''), NULLIF(TRIM(sStatus.purchaseOrderNumber), '')) IS NOT NULL
               GROUP BY COALESCE(NULLIF(TRIM(sStatus.po_key), ''), NULLIF(TRIM(sStatus.purchaseOrderNumber), ''))
            ) dueAgg
            LEFT JOIN (
              SELECT COALESCE(NULLIF(TRIM(pStatus.po_key), ''), NULLIF(TRIM(pStatus.purchaseOrderNumber), '')) AS po,
                     COALESCE(SUM(pStatus.amount), 0) AS paid_total
                FROM payments pStatus
               WHERE COALESCE(NULLIF(TRIM(pStatus.po_key), ''), NULLIF(TRIM(pStatus.purchaseOrderNumber), '')) IS NOT NULL
               GROUP BY COALESCE(NULLIF(TRIM(pStatus.po_key), ''), NULLIF(TRIM(pStatus.purchaseOrderNumber), ''))
            ) paidAgg ON paidAgg.po = dueAgg.po
        ) statusAgg ON statusAgg.po = ${pPoExpr}
      `
      : "";
    if (search) {
      const like = `%${search}%`;
      baseWhere.push(
        `(p.referenceNo LIKE ? OR p.purchaseOrderNumber LIKE ? OR p.description LIKE ?)`
      );
      params.push(like, like, like);
    }
    if (fromDate) {
      baseWhere.push(`DATE(COALESCE(sDate.saleDate, p.createdOn)) >= ?`);
      params.push(fromDate);
    }
    if (toDate) {
      baseWhere.push(`DATE(COALESCE(sDate.saleDate, p.createdOn)) <= ?`);
      params.push(toDate);
    }
    const whereParts = statusCondition ? [...baseWhere, statusCondition] : baseWhere;
    const baseWhereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const baseOnlyWhereClause = baseWhere.length ? `WHERE ${baseWhere.join(" AND ")}` : "";
    const statusResultCondition = normalizedStatus === "paid"
      ? `COALESCE(t.status_paid_total, 0) >= COALESCE(t.status_due_total, 0) AND COALESCE(t.status_due_total, 0) > 0`
      : normalizedStatus === "partial"
        ? `COALESCE(t.status_paid_total, 0) > 0 AND COALESCE(t.status_paid_total, 0) < COALESCE(t.status_due_total, 0)`
        : normalizedStatus === "unpaid"
          ? `(COALESCE(t.status_due_total, 0) > COALESCE(t.status_paid_total, 0) OR COALESCE(t.status_due_total, 0) <= 0)`
          : "";
    const resultWhereClause = statusResultCondition ? ` AND ${statusResultCondition}` : "";

    try {
      // Count distinct POs that match the filters
      const totalRow = await db.get(
        `SELECT COUNT(*) AS count
           FROM (
             SELECT DISTINCT ${pPoExpr} AS po
               FROM ${paymentSource} p
               ${dateSaleJoin}
               ${statusJoins}
               ${baseWhereClause}
           ) x`,
        params
      );
      const total = Number(totalRow?.count || 0);

      // Build ORDER BY expression. Use special CASE ordering for paymentStatus and deliveryStatus
      let orderExpr = `${sortExpr} ${rawSortDir}, ${tPoExpr} ASC`;
      if (rawSortBy === "paymentStatus") {
        orderExpr = `CASE
            WHEN UPPER(TRIM(s.paymentStatus)) = 'UNPAID' THEN 1
            WHEN UPPER(TRIM(s.paymentStatus)) = 'PARTIAL' THEN 2
            WHEN UPPER(TRIM(s.paymentStatus)) = 'PAID' THEN 3
            ELSE 4
          END ${rawSortDir}, ${tPoExpr} ASC`;
      } else if (rawSortBy === "deliveryStatus") {
        orderExpr = `CASE
            WHEN UPPER(TRIM(d.status)) = 'PENDING' THEN 1
            WHEN UPPER(TRIM(d.status)) = 'PROCESSED' THEN 2
            WHEN UPPER(TRIM(d.status)) IN ('PICKED UP','PICKED_UP','PICKEDUP') THEN 3
            WHEN UPPER(TRIM(d.status)) = 'DELIVERED' THEN 4
            ELSE 5
          END ${rawSortDir}, ${tPoExpr} ASC`;
      }

      // Pick the latest payment per PO (window function) — latest by createdOn first
      const parents: any[] = await db.all(
        `
        SELECT t.*,
               s.id AS sale_id,
               c.id AS customer_id,
               c.fullName AS customer_fullName,
               c.storeName AS customer_storeName,
               d.status AS delivery_status
        FROM (
          SELECT p.*,
                 ${pPoExpr} AS po_key_norm,
               ${statusCondition ? "statusAgg.due_total AS status_due_total, statusAgg.paid_total AS status_paid_total," : ""}
                 ROW_NUMBER() OVER (
                   PARTITION BY ${pPoExpr}
                   ORDER BY p.createdOn DESC, p.id DESC
                 ) AS rn
            FROM ${paymentSource} p
            ${dateSaleJoin}
            ${statusJoins}
            ${baseOnlyWhereClause}
        ) t
        LEFT JOIN sales s ON t.po_key_norm = ${sPoExpr}
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN deliveries d ON t.po_key_norm = ${dPoExpr}
        WHERE t.rn = 1${resultWhereClause}
        ORDER BY ${orderExpr}
        LIMIT ${perPage} OFFSET ${offset}
        `,
        params
      );

      // If no parents, return early
      if (!parents || parents.length === 0) {
        return res.json({ items: [], total });
      }

      // Batch: collect all POs and parent ids
      const pos = parents
        .map((p) => normalizePoKey(p.po_key_norm ?? p.po_key ?? p.purchaseOrderNumber))
        .filter(Boolean) as string[];

      // Batch fetch sales for POs (single query)
      const salesByPO: Record<string, any> = {};
      if (pos.length > 0) {
        const placeholders = pos.map(() => "?").join(",");
        const salesRows: any[] = await db.all(
          `SELECT s.*, c.id as customer_id, c.fullName as customer_fullName, c.email as customer_email, c.phoneNumber as customer_phoneNumber, c.storeName as customer_storeName, c.address as customer_address, c.country as customer_country, c.status as customer_status
             FROM sales s
             LEFT JOIN customers c ON s.customer_id = c.id
             WHERE COALESCE(s.po_key, NULLIF(TRIM(s.purchaseOrderNumber), '')) IN (${placeholders})`,
          pos
        );
        for (const s of salesRows || []) {
          const po = normalizePoKey(s.po_key) || normalizePoKey(s.purchaseOrderNumber) || "";
          salesByPO[po] = s;
        }
      }

      // Batch fetch sale_items for all sale ids found (include customer-specific discounts)
      const saleIds = Object.values(salesByPO).map((s: any) => s.id).filter(Boolean);
      const itemsBySaleId: Record<number, any[]> = {};
      if (saleIds.length > 0) {
        const placeholders = saleIds.map(() => "?").join(",");
        const rows = await db.all(
          `SELECT si.id, si.sale_id, si.product_id, si.quantity, si.price as unit_price, si.discount as line_discount, si.tax as tax, si.total as item_total,
                  p.sku, p.name, p.unit, cpd.discount_value as customer_discount
             FROM sale_items si
             LEFT JOIN products p ON si.product_id = p.id
             LEFT JOIN sales s ON si.sale_id = s.id
             LEFT JOIN customer_product_discounts cpd ON cpd.customer_id = s.customer_id AND cpd.product_id = si.product_id
             WHERE si.sale_id IN (${placeholders})`,
          saleIds
        );
        for (const r of rows || []) {
          const sid = Number(r.sale_id);
          itemsBySaleId[sid] = itemsBySaleId[sid] || [];
          itemsBySaleId[sid].push(r);
        }
      }

      // Batch fetch children payments for all POs (exclude the parents we selected as latest) and group by PO
      const childrenByPO: Record<string, any[]> = {};
      if (pos.length > 0) {
        const placeholders = pos.map(() => "?").join(",");
        const children = await db.all(
          `SELECT *
             FROM payments
            WHERE COALESCE(po_key, NULLIF(TRIM(purchaseOrderNumber), '')) IN (${placeholders})
            ORDER BY createdOn ASC, id ASC`,
          pos
        );
        for (const c of children || []) {
          const po = normalizePoKey(c.po_key ?? c.purchaseOrderNumber);
          if (!po) continue;
          childrenByPO[po] = childrenByPO[po] || [];
          childrenByPO[po].push(c);
        }
      }

      // Batch fetch latest delivery status per PO (optional)
      const deliveryStatusByPO: Record<string, string | null> = {};
      if (pos.length > 0) {
        const placeholders = pos.map(() => "?").join(",");
        const deliveries = await db.all(
          `SELECT po_key, purchaseOrderNumber, status
             FROM deliveries
            WHERE COALESCE(po_key, NULLIF(TRIM(purchaseOrderNumber), '')) IN (${placeholders})
            ORDER BY COALESCE(processedDate, createdOn) DESC`,
          pos
        );
        // pick first encountered status per PO (because ordered desc)
        for (const d of deliveries || []) {
          const po = normalizePoKey(d.po_key ?? d.purchaseOrderNumber);
          if (!po) continue;
          if (typeof deliveryStatusByPO[po] === "undefined") deliveryStatusByPO[po] = d.status || null;
        }
      }

      // Compose items: attach sale, compute running balances for each PO group
      const items: any[] = [];
      for (const parentRow of parents) {
        // ensure po is always a trimmed string (avoid null/undefined index access)
        const po = normalizePoKey(parentRow.po_key_norm ?? parentRow.po_key ?? parentRow.purchaseOrderNumber) || "";
        const parent = { ...parentRow };
        // prefer the sale row we joined above (if present) otherwise fall back to batch-fetched sale
        let sale = null;
        if (parent.sale_id) {
          sale = salesByPO[po] || {
            id: parent.sale_id,
            purchaseOrderNumber: parent.purchaseOrderNumber,
            customer_id: parent.customer_id,
            customer_fullName: parent.customer_fullName,
            customer_storeName: parent.customer_storeName,
          };
        } else {
          sale = po ? salesByPO[po] : null;
        }

        // Build products array for this sale from itemsBySaleId
        let products = [] as any[];
        if (sale && itemsBySaleId[sale.id]) {
          products = (itemsBySaleId[sale.id] || []).map((r: any) => {
            const unitPrice = Number(r.unit_price ?? r.price ?? r.product_price ?? 0);
            const qty = Number(r.quantity ?? 1) || 1;
            const lineDiscountRaw = r.line_discount !== null && r.line_discount !== undefined ? Number(r.line_discount) : null;
            const discount = (lineDiscountRaw !== null && lineDiscountRaw !== 0) ? lineDiscountRaw : Number(r.customer_discount ?? 0);
            const tax = Number(r.tax ?? 0);

            const itemTotalFromDb = r.item_total !== undefined && r.item_total !== null ? Number(r.item_total) : null;
            const computedTotal = (unitPrice - discount + tax) * qty;
            const useDbTotal = itemTotalFromDb !== null && Math.abs(Number(itemTotalFromDb) - Number(computedTotal)) < 0.005;
            const lineTotal = useDbTotal ? Number(itemTotalFromDb) : Number(computedTotal);

            return {
              id: r.id,
              product_id: r.product_id,
              sku: r.sku,
              name: r.name,
              price: unitPrice,
              quantity: qty,
              discount,
              tax,
              total: Number.isFinite(lineTotal) ? lineTotal : 0,
            };
          });
        }

        const gross = products.reduce(
          (s: number, it: any) =>
            s + ((Number(it.price || 0) + Number(it.tax || 0)) * Number(it.quantity || 1)),
          0
        );
        const net = products.reduce((s: number, it: any) => s + Number(it.total || 0), 0);
        const totalDiscount = Math.max(gross - net, 0);

        // Attach sale/customer info
        let customer = null;
        if (sale) {
          customer = sale.customer_id
            ? {
                id: sale.customer_id,
                fullName: sale.customer_fullName,
                email: sale.customer_email,
                phoneNumber: sale.customer_phoneNumber,
                storeName: sale.customer_storeName,
                address: sale.customer_address,
                country: sale.customer_country,
                status: sale.customer_status,
              }
            : null;
        }

        parent.sale = sale ? { ...sale, customer, products, grandTotal: gross, totalDiscount, netTotal: net } : null;
        parent.customer = parent.sale?.customer || null;
        parent.deliveryStatus = po ? deliveryStatusByPO[po] ?? parent.deliveryStatus ?? null : null;

        // Compute running balances for children/payments for this PO
        const fullGroup = childrenByPO[po || ""] || [];
        // Keep stable chronological order (old->new) - already ordered by createdOn ASC in query
        // Ensure zero-amount parent (if present) to be FIRST among the list (so it remains first if it's a child)
        const zeroIdx = fullGroup.findIndex((g) => Number(g.amount || 0) === 0);
        if (zeroIdx > 0) {
          const zeroPayment = fullGroup.splice(zeroIdx, 1)[0];
          fullGroup.unshift(zeroPayment);
        }

        // Exclude the parent payment from the running-balance pass (avoid double-counting)
        const childrenOnly = fullGroup.filter((g: any) => g.id !== parent.id);

        const amountDue = Number(parent.sale?.netTotal ?? parent.sale?.grandTotal ?? 0);
        let cumulative = 0;
        for (const c of childrenOnly) {
          c.sale = parent.sale;
          c.customer = parent.sale?.customer || null;
          const amt = Number(c.amount || 0);
          const cumAfter = cumulative + amt;
          c.runningBalance = Math.max(amountDue - cumAfter, 0);
          c.paymentStatus = cumAfter >= amountDue ? "Paid" : cumAfter > 0 ? "Partial" : "Unpaid";
          cumulative = cumAfter;
        }

        // Parent running balance and status (include parent.amount once)
        const parentAmt = Number(parent.amount || 0);
        const totalPaid = cumulative + parentAmt;
        parent.runningBalance = Math.max(amountDue - totalPaid, 0);
        if (totalPaid >= amountDue && amountDue > 0) parent.paymentStatus = "Paid";
        else if (totalPaid > 0) parent.paymentStatus = "Partial";
        else parent.paymentStatus = "Unpaid";

        // Attach computed children and delivery status (children list should exclude parent itself)
        const children = (childrenOnly || []).sort((a: any, b: any) => Number(b.id) - Number(a.id));
        parent.children = children;
        parent.parentPaymentId = null;
        parent.deliveryStatus = po ? deliveryStatusByPO[po] ?? null : null;

        items.push(parent);
      }

      res.json({ items, total });
    } catch (err) {
      console.error("GET /api/payments (latest-as-parent) failed:", err);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // API: Get upcoming payment reminders (due within next 30 days)
  app.get('/api/payments/reminder', async (_req, res) => {
    try {
      const today = new Date();
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 30);

      const toYmd = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const fromYmd = toYmd(today);
      const toYmdDate = toYmd(maxDate);

      const rows = await db.all(
        `SELECT
           p.*,
           s.id AS sale_id,
           c.id AS customer_id,
           c.fullName AS customer_fullName,
           c.email AS customer_email,
           c.phoneNumber AS customer_phoneNumber,
           c.storeName AS customer_storeName,
           c.address AS customer_address,
           c.country AS customer_country,
           c.status AS customer_status
         FROM payments p
         LEFT JOIN sales s
           ON COALESCE(s.po_key, NULLIF(TRIM(s.purchaseOrderNumber), ''))
            = COALESCE(p.po_key, NULLIF(TRIM(p.purchaseOrderNumber), ''))
         LEFT JOIN customers c ON s.customer_id = c.id
         WHERE p.dueDate IS NOT NULL
           AND DATE(p.dueDate) BETWEEN ? AND ?
         ORDER BY DATE(p.dueDate) ASC, p.id DESC`,
        [fromYmd, toYmdDate]
      );

      const items = (rows || []).map((r: any) => {
        const customer = r.customer_id
          ? {
              id: r.customer_id,
              fullName: r.customer_fullName,
              email: r.customer_email,
              phoneNumber: r.customer_phoneNumber,
              storeName: r.customer_storeName,
              address: r.customer_address,
              country: r.customer_country,
              status: r.customer_status,
            }
          : null;

        return {
          ...r,
          customer,
        };
      });

      res.json(items);
    } catch (err) {
      console.error('GET /api/payments/reminder failed:', err);
      res.status(500).json({ error: 'Failed to fetch payment reminders' });
    }
  });

  // ================= POST /api/payments (still accepts parentPaymentId; latest becomes parent) =================
  app.post("/api/payments", async (req, res) => {
    try {
      const {
        referenceNo,
        purchaseOrderNumber,
        amount,
        paymentChannel,
        description,
        paymentDate,
        dueDate,
        attachment,
        parentPaymentId
      } = req.body;

      let poTrimmed = (purchaseOrderNumber || "").trim() || null;

      // Validate parentPaymentId if provided (must belong to same PO)
      if (parentPaymentId) {
        const parentRow = await db.get(
          `SELECT id, purchaseOrderNumber FROM payments WHERE id = ?`,
          [parentPaymentId]
        );
        if (!parentRow) return res.status(400).json({ error: "Invalid parentPaymentId" });
        if (!poTrimmed) poTrimmed = normalizePoKey(parentRow.purchaseOrderNumber);
        if (
          poTrimmed &&
          parentRow.purchaseOrderNumber &&
          normalizePoKey(parentRow.purchaseOrderNumber) !== poTrimmed
        ) {
          return res.status(400).json({ error: "purchaseOrderNumber mismatch with parent" });
        }
      }

      const result = await db.run(
        `INSERT INTO payments (referenceNo, purchaseOrderNumber, po_key, amount, paymentChannel, description, createdOn, paymentDate, dueDate, attachment, parentPaymentId)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
        [
          referenceNo || "",
          poTrimmed,
          poTrimmed,
          amount,
          paymentChannel || "",
          description || "",
          paymentDate || null,
          dueDate || null,          // <-- new param
          attachment || "",
          parentPaymentId || null
        ]
      );

      const newId = (result as any).insertId ?? (result as any).lastID;

      // Re-parent so the latest payment is the parent
      if (poTrimmed) {
        try { await ensureLatestIsParent(poTrimmed); } catch {}
        await updateSalePaymentStatusForPO(poTrimmed);
      }

      const created = await db.get(`SELECT * FROM payments WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      console.error("POST /api/payments failed:", err);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // ================= PUT /api/payments/:id =================
  app.put('/api/payments/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const existing = await db.get(`SELECT * FROM payments WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Payment not found" });

      const {
        referenceNo,
        purchaseOrderNumber,
        amount,
        paymentChannel,
        description,
        paymentDate,
        dueDate,               // <-- new
        attachment
      } = req.body;

      const poToUse =
        normalizePoKey(purchaseOrderNumber) ||
        normalizePoKey(existing.purchaseOrderNumber) ||
        null;

      await db.run(
        `UPDATE payments
           SET referenceNo=?, purchaseOrderNumber=?, po_key=?, amount=?, paymentChannel=?, description=?, paymentDate=?, dueDate=?, attachment=?
         WHERE id=?`,
        [
          referenceNo || "",
          poToUse,
          poToUse,
          amount,
          paymentChannel || "",
          description || "",
          paymentDate || null,
          dueDate || null,          // <-- new
          attachment || "",
          id
        ]
      );

      if (poToUse) {
        try { await ensureLatestIsParent(poToUse); } catch {}
        await updateSalePaymentStatusForPO(poToUse);
      }

      res.json({ success: 1 });
    } catch (err) {
      console.error("PUT /api/payments/:id failed:", err);
      res.status(500).json({ error: "Failed to update payment" });
    }
  });

  // API: Delete payment
  app.delete('/api/payments/:id', async (req, res) => {

    const { id } = req.params;
    try {
      const existing = await db.get(
        `SELECT id, purchaseOrderNumber FROM payments WHERE id = ?`,
        [id]
      );
      if (!existing) return res.status(404).json({ error: "Payment not found" });

      await db.run(`DELETE FROM payments WHERE id = ?`, [id]);

      if (existing.purchaseOrderNumber) {
        try { await ensureLatestIsParent(existing.purchaseOrderNumber); } catch {}
        await updateSalePaymentStatusForPO(existing.purchaseOrderNumber);
      }

      res.json({ success: 1 });
    } catch (err) {
      console.error("DELETE /api/payments failed:", err);
      res.status(500).json({ error: "Failed to delete payment" });
    }
  });

  // API: Reconcile all sales' paymentStatus from payments + sale_items totals
  app.post('/api/payments/reconcile-sales', async (_req, res) => {
    try {
      // Bulk update all sales.paymentStatus based on aggregated payments vs sale_items totals.
      // This is faster and avoids round-tripping per-PO.
      const result = await db.run(`
        UPDATE sales s
        SET paymentStatus = CASE
          WHEN (
            SELECT COALESCE(SUM(si.total),0) FROM sale_items si WHERE si.sale_id = s.id
          ) <= 0
            THEN 'Unpaid'
          WHEN (
            SELECT COALESCE(SUM(p2.amount),0)
            FROM payments p2
            WHERE COALESCE(p2.po_key, NULLIF(TRIM(p2.purchaseOrderNumber), ''))
                  = COALESCE(s.po_key, NULLIF(TRIM(s.purchaseOrderNumber), ''))
          ) >=
               (SELECT COALESCE(SUM(si.total),0) FROM sale_items si WHERE si.sale_id = s.id)
               AND (SELECT COALESCE(SUM(si.total),0) FROM sale_items si WHERE si.sale_id = s.id) > 0
            THEN 'Paid'
          WHEN (
            SELECT COALESCE(SUM(p2.amount),0)
            FROM payments p2
            WHERE COALESCE(p2.po_key, NULLIF(TRIM(p2.purchaseOrderNumber), ''))
                  = COALESCE(s.po_key, NULLIF(TRIM(s.purchaseOrderNumber), ''))
          ) > 0
            THEN 'Partial'
          ELSE 'Unpaid'
        END
        WHERE COALESCE(s.po_key, NULLIF(TRIM(s.purchaseOrderNumber), '')) IS NOT NULL
          AND COALESCE(s.po_key, NULLIF(TRIM(s.purchaseOrderNumber), '')) <> ''
      `);

      res.json({ success: 1, affectedRows: result.changes || 0 });
    } catch (err) {
      console.error('POST /api/payments/reconcile-sales failed:', err);
      res.status(500).json({ error: 'Failed to reconcile sales' });
    }
  });

  // API: Get payments by PO number
  app.get('/api/payments/po/:purchaseOrderNumber', async (req, res) => {

    const { purchaseOrderNumber } = req.params;
    try {
      const items = await db.all(
        `SELECT id, referenceNo, purchaseOrderNumber, amount, paymentChannel, description, createdOn, paymentDate, dueDate, attachment
         FROM payments
         WHERE COALESCE(po_key, NULLIF(TRIM(purchaseOrderNumber), '')) = ?
         ORDER BY COALESCE(paymentDate, createdOn) ASC`,
        [normalizePoKey(purchaseOrderNumber)]
      );

      // Attach sale object to each payment for running balance calculation
      const itemsWithSale = items.map((item: any) => {
        // We'll get the sale object once and attach it to all items
        return item;
      });

      // Get sale object for this PO (single sale)
      const sale = await getSaleByPO(purchaseOrderNumber);
      // attach customer object to sale
      try {
        const custId = sale?.customer_id;
        if (custId) {
          const crow: any = await db.get(
            `SELECT id, address, company, country, createdOn, email, fullName, phoneNumber, status, storeName, tinNumber FROM customers WHERE id = ?`,
            [custId]
          );
          sale.customer = crow || null;
        } else {
          sale.customer = null;
        }
      } catch (err) {
        sale.customer = null;
      }

      // Attach sale to each item for running balance calculation
      itemsWithSale.forEach((item: any) => {
        item.sale = sale;
      });

      // Compute running balances
      const itemsWithRunningBalance = computeRunningBalances(itemsWithSale);

      res.json({ items: itemsWithRunningBalance, sale });
    } catch (err) {
      console.error("GET /api/payments/po/:purchaseOrderNumber failed:", err);
      res.status(500).json({ error: "Failed to fetch payments for PO number" });
    }
  });

  // Ensure the latest payment (by createdOn then id) is the parent (parentPaymentId = NULL)
  async function ensureLatestIsParent(purchaseOrderNumber: string): Promise<number | null> {
    if (!purchaseOrderNumber) return null;
    const po = normalizePoKey(purchaseOrderNumber);
    if (!po) return null;

    const rows: any[] = await db.all(
      `SELECT id
         FROM payments
        WHERE COALESCE(po_key, NULLIF(TRIM(purchaseOrderNumber), '')) = ?
        ORDER BY createdOn ASC, id ASC`,
      [po]
    );
    if (!rows || rows.length === 0) return null;

    const latestId = rows[rows.length - 1].id;

    const currentParent = await db.get(
      `SELECT id FROM payments
        WHERE COALESCE(po_key, NULLIF(TRIM(purchaseOrderNumber), ''))=?
          AND parentPaymentId IS NULL
        LIMIT 1`,
      [po]
    );
    if (currentParent?.id === latestId) return latestId;

    await db.run(`UPDATE payments SET parentPaymentId = NULL WHERE id = ?`, [latestId]);
    await db.run(
      `UPDATE payments
          SET parentPaymentId = ?
        WHERE COALESCE(po_key, NULLIF(TRIM(purchaseOrderNumber), ''))=?
          AND id <> ?`,
      [latestId, po, latestId]
    );

    return latestId;
  }
}
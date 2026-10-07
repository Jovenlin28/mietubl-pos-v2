import express from "express";
import ExcelJS from "exceljs";

import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

export default function registerProducts(app: express.Express, db: any) {
  // GET /api/products
  app.get("/api/products", async (req, res) => {
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;
    const isLowStock = req.query.isLowStock === "1";
    const search = (req.query.search as string || "").trim();
    const categoryParam = (req.query.category as string || "").trim(); // can be id or name (partial)

    const whereParts: string[] = [];
    const params: any[] = [];

    if (isLowStock) {
      whereParts.push("p.qty < 5");
    }

    if (search) {
      whereParts.push("(p.sku LIKE ? OR p.name LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like);
    }

    // Category filter: if numeric treat as category_id, else match category name (partial, case-insensitive)
    if (categoryParam) {
      if (/^\d+$/.test(categoryParam)) {
        whereParts.push("p.category_id = ?");
        params.push(Number(categoryParam));
      } else {
        whereParts.push("LOWER(TRIM(c.name)) LIKE LOWER(?)");
        params.push(`%${categoryParam}%`);
      }
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    try {
      // Always join categories in count to support name-based filtering
      const totalRow = await db.get(
        `SELECT COUNT(*) as count FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause}`,
        params.length ? params : undefined
      );
      const total = totalRow ? totalRow.count : 0;

      // Sorting: allow only specific columns to prevent SQL injection
      const allowedSortCols: Record<string, string> = {
        // use LOWER(TRIM(...)) for string columns to ensure alphabetical, case-insensitive order
        sku: "LOWER(TRIM(p.sku))",
        name: "LOWER(TRIM(p.name))",
        price: "p.price",
        qty: "p.qty",
        createdOn: "p.createdOn",
      };

      const rawSortBy = (req.query.sortBy as string) || "";
      const rawSortDir = ((req.query.sortDir as string) || "").toLowerCase();
      let orderClause = "ORDER BY p.id DESC"; // default
      if (rawSortBy && allowedSortCols[rawSortBy]) {
        const col = allowedSortCols[rawSortBy];
        const dir = rawSortDir === "asc" ? "ASC" : "DESC";
        orderClause = `ORDER BY ${col} ${dir}`;
      }

      const listSql = `
        SELECT 
          p.id, p.sku, p.name, p.category_id, p.brand_id, p.price, p.costingPrice, p.unit, p.sellingType, p.qty, p.createdBy,
          p.description, p.createdOn,
          p.store_id, s.name as store_name,
          p.warehouse_id, w.name as warehouse_name,
          b.id as brand_id, b.name as brand_name,
          c.id as category_id, c.name as category_name
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN stores s ON p.store_id = s.id
        LEFT JOIN warehouses w ON p.warehouse_id = w.id
        ${whereClause}
        ${orderClause}
        LIMIT ${perPage} OFFSET ${offset}
      `;
      const products = await db.all(listSql, params.length ? params : undefined);

      // load images for listed products
      const productIds = (products || []).map((p: any) => p.id).filter(Boolean);
      const imagesMap: Record<number, string[]> = {};
      const freebiesMap: Record<number, any[]> = {};
      if (productIds.length > 0) {
        const placeholders = productIds.map(() => "?").join(",");
        const imgs = await db.all(
          `SELECT product_id, url FROM product_images WHERE product_id IN (${placeholders})`,
          productIds
        );
        imgs.forEach((r: any) => {
          imagesMap[r.product_id] = imagesMap[r.product_id] || [];
          imagesMap[r.product_id].push(r.url);
        });

        // load freebies for listed products (table may not exist on older DBs)
        try {
          const frows = await db.all(
            `SELECT id, product_id, name, qty, sku FROM product_freebies WHERE product_id IN (${placeholders})`,
            productIds
          );
          frows.forEach((r: any) => {
            freebiesMap[r.product_id] = freebiesMap[r.product_id] || [];
            freebiesMap[r.product_id].push({ id: r.id, name: r.name, qty: r.qty, sku: r.sku });
          });
        } catch (e) {
          // ignore if product_freebies missing
        }
      }

      const items = (products || []).map((p: any) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category_id: p.category_id,
        brand_id: p.brand_id,
        price: p.price,
        costingPrice: p.costingPrice,
        unit: p.unit,
        sellingType: p.sellingType,
        qty: p.qty,
        createdBy: p.createdBy,
        description: p.description,
        createdOn: p.createdOn,
        store: p.store_id ? { id: p.store_id, name: p.store_name } : null,
        warehouse: p.warehouse_id ? { id: p.warehouse_id, name: p.warehouse_name } : null,
        brand: p.brand_id ? { id: p.brand_id, name: p.brand_name } : null,
        category: p.category_id ? { id: p.category_id, name: p.category_name } : null,
        images: imagesMap[p.id] || [],
        freebies: freebiesMap[p.id] || []
      }));

      res.json({ items, total });
    } catch (err) {
      console.error("GET /api/products error:", err);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // GET /api/products/:id
  app.get("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const product = await db.get(
        `
        SELECT 
          p.id, p.sku, p.name, p.category_id, p.brand_id, p.price, p.costingPrice, p.unit, p.sellingType, p.qty, p.createdBy,
          p.description, p.createdOn,
          p.store_id, s.name as store_name,
          p.warehouse_id, w.name as warehouse_name,
          b.id as brand_id, b.name as brand_name,
          c.id as category_id, c.name as category_name
        FROM products p
        LEFT JOIN stores s ON p.store_id = s.id
        LEFT JOIN warehouses w ON p.warehouse_id = w.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
        `,
        [id]
      );
      if (!product) return res.status(404).json({ error: "Product not found" });

      const imgs = await db.all(`SELECT url FROM product_images WHERE product_id = ?`, [id]);
      product.images = imgs.map((r: any) => r.url);

      // freebies (if table exists)
      let freebiesRows: any[] = [];
      try {
        freebiesRows = await db.all(`SELECT id, name, qty, sku FROM product_freebies WHERE product_id = ?`, [id]);
      } catch (e) {
        freebiesRows = [];
      }

      const result = {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category_id: product.category_id,
        brand_id: product.brand_id,
        price: product.price,
        costingPrice: product.costingPrice,
        unit: product.unit,
        sellingType: product.sellingType,
        qty: product.qty,
        createdBy: product.createdBy,
        description: product.description,
        createdOn: product.createdOn,
        store: product.store_id ? { id: product.store_id, name: product.store_name } : null,
        warehouse: product.warehouse_id ? { id: product.warehouse_id, name: product.warehouse_name } : null,
        brand: product.brand_id ? { id: product.brand_id, name: product.brand_name } : null,
        category: product.category_id ? { id: product.category_id, name: product.category_name } : null,
        images: product.images || [],
        freebies: freebiesRows || []
      };

      res.json(result);
    } catch (err) {
      console.error("GET /api/products/:id error:", err);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  // POST /api/products
  app.post("/api/products", async (req, res) => {
    try {
      const {
        sku, name, category_id, brand_id, costingPrice, price, unit, sellingType, qty,
        createdBy, description, discountType, discountValue, store_id, warehouse_id, images = [],
        freebies = []
      } = req.body;

      const result = await db.run(
        `INSERT INTO products
          (sku, name, category_id, brand_id, costingPrice, price, unit, sellingType, qty, createdBy, description, discountType, discountValue, store_id, warehouse_id, createdOn)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          sku, name, category_id ?? null, brand_id ?? null, costingPrice ?? null, price ?? null,
          unit ?? null, sellingType ?? null, qty ?? 0, createdBy ?? null, description ?? null,
          discountType ?? null, discountValue ?? null, store_id ?? null, warehouse_id ?? null
        ]
      );

      const newId = (result as any).insertId ?? (result as any).lastID;

      if (images.length > 0) {
        for (const url of images) {
          await db.run(`INSERT INTO product_images (product_id, url) VALUES (?, ?)`, [newId, url]);
        }
      }

      // removed: insert freebies during product creation (moved to sales endpoint)

      // build response using consistent mapping (include images)
      const createdRow = await db.get(
        `SELECT p.*, s.name as store_name, w.name as warehouse_name, b.name as brand_name, c.name as category_name
         FROM products p
         LEFT JOIN stores s ON p.store_id = s.id
         LEFT JOIN warehouses w ON p.warehouse_id = w.id
         LEFT JOIN brands b ON p.brand_id = b.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`,
        [newId]
      );

      const imgs = await db.all(`SELECT url FROM product_images WHERE product_id = ?`, [newId]);
      const imagesList = (imgs || []).map((r: any) => r.url);

      const item = {
        id: createdRow.id,
        sku: createdRow.sku,
        name: createdRow.name,
        category_id: createdRow.category_id,
        brand_id: createdRow.brand_id,
        costingPrice: createdRow.costingPrice,
        price: createdRow.price,
        unit: createdRow.unit,
        sellingType: createdRow.sellingType,
        qty: createdRow.qty,
        createdBy: createdRow.createdBy,
        description: createdRow.description,
        discountType: createdRow.discountType,
        discountValue: createdRow.discountValue,
        store_id: createdRow.store_id,
        warehouse_id: createdRow.warehouse_id,
        createdOn: createdRow.createdOn,
        images: imagesList,
      };

      res.status(201).json({ success: 1, item });
    } catch (err) {
      console.error("POST /api/products error:", err);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  // PUT /api/products/:id
  app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const {
      sku, name, category_id, brand_id, costingPrice, price, unit, sellingType, qty,
      createdBy, description, store_id, warehouse_id, images,
      freebies = []
    } = req.body;
    try {
      const costing = typeof costingPrice !== "undefined" ? costingPrice : null;
      const priceVal = typeof price !== "undefined" ? price : null;
      const unitVal = typeof unit !== "undefined" ? unit : null;
      const sellingTypeVal = typeof sellingType !== "undefined" ? sellingType : null;
      const qtyVal = typeof qty !== "undefined" ? qty : 0;

      await db.run(
        `UPDATE products SET sku = ?, name = ?, category_id = ?, brand_id = ?, costingPrice = ?, price = ?, unit = ?, sellingType = ?, qty = ?, createdBy = ?, description = ?, store_id = ?, warehouse_id = ? WHERE id = ?`,
        [
          sku, name, category_id ?? null, brand_id ?? null,
          costing, priceVal, unitVal, sellingTypeVal,
          qtyVal, createdBy ?? null, description ?? null, store_id ?? null, warehouse_id ?? null, id
        ]
      );

      if (Array.isArray(images)) {
        await db.run(`DELETE FROM product_images WHERE product_id = ?`, [id]);
        if (images.length > 0) {
          for (const url of images) {
            if (!url) continue;
            await db.run(`INSERT INTO product_images (product_id, url) VALUES (?, ?)`, [id, url]);
          }
        }
      }

      // update freebies: remove existing then insert provided ones
      try {
        await db.run(`DELETE FROM product_freebies WHERE product_id = ?`, [id]);
        if (Array.isArray(freebies) && freebies.length > 0) {
          for (const fb of freebies) {
            const nameVal = fb?.name ?? null;
            const qtyVal = typeof fb?.qty !== "undefined" ? Number(fb.qty) : 0;
            const skuVal = fb?.sku ?? null;
            try {
              await db.run(`INSERT INTO product_freebies (product_id, name, qty, sku) VALUES (?, ?, ?, ?)`, [id, nameVal, qtyVal, skuVal]);
            } catch (e) {
              // ignore single insert errors
            }
          }
        }
      } catch (e) {
        // ignore if product_freebies missing
      }

      const updated = await db.get(`SELECT * FROM products WHERE id = ?`, [id]);
      const imgs = await db.all(`SELECT url FROM product_images WHERE product_id = ?`, [id]);
      updated.images = imgs.map((r: any) => r.url);

      // include freebies in updated response
      try {
        const frows = await db.all(`SELECT id, name, qty, sku FROM product_freebies WHERE product_id = ?`, [id]);
        updated.freebies = frows.map((r: any) => ({ id: r.id, name: r.name, qty: r.qty, sku: r.sku }));
      } catch (e) {
        updated.freebies = [];
      }

      res.json({ success: 1, item: updated });
    } catch (err) {
      console.error("PUT /api/products/:id error:", err);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // DELETE /api/products/:id
  app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await db.run(`DELETE FROM products WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("DELETE /api/products/:id error:", err);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // API: Get product by code
  app.get("/api/products/code/:code", async (req, res) => {
    const { code } = req.params;
    try {
      const product = await db.get(
        `
        SELECT 
          p.id, p.sku, p.name, p.category_id, p.brand_id, p.price, p.unit, p.sellingType, p.qty, p.createdBy,
          p.description, p.discountType, p.discountValue, p.createdOn,
          p.store_id, s.name as store_name,
          p.warehouse_id, w.name as warehouse_name,
          b.id as brand_id, b.name as brand_name,
          c.id as category_id, c.name as category_name
        FROM products p
        LEFT JOIN stores s ON p.store_id = s.id
        LEFT JOIN warehouses w ON p.warehouse_id = w.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.sku = ?
        `,
        [code]
      );
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const imgs = await db.all(`SELECT url FROM product_images WHERE product_id = ?`, [product.id]);
      product.images = imgs.map((r: any) => r.url || "");

      const result = {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category_id: product.category_id,
        brand_id: product.brand_id,
        price: product.price,
        unit: product.unit,
        sellingType: product.sellingType,
        qty: product.qty,
        createdBy: product.createdBy,
        description: product.description,
        discountType: product.discountType,
        discountValue: product.discountValue,
        createdOn: product.createdOn,
        store: product.store_id ? { id: product.store_id, name: product.store_name } : null,
        warehouse: product.warehouse_id ? { id: product.warehouse_id, name: product.warehouse_name } : null,
        brand: product.brand_id ? { id: product.brand_id, name: product.brand_name } : null,
        category: product.category_id ? { id: product.category_id, name: product.category_name } : null,
        images: product.images || []
      };

      res.json(result);
    } catch (err) {
      console.error("GET /api/products/code/:code error:", err);
      res.status(500).json({ error: "Failed to fetch product by code" });
    }
  });

  // GET /api/product-images
  // Optional query: ?product_id=123
  app.get("/api/product-images", async (req, res) => {
    try {
      const productId = req.query.product_id as string | undefined;

      let rows: any[] = [];
      if (productId) {
        rows = await db.all(`SELECT id, product_id, url FROM product_images WHERE product_id = ?`, [productId]);
      } else {
        rows = await db.all(`SELECT id, product_id, url FROM product_images`);
      }

      // also return a grouped map by product_id for convenience
      const byProduct: Record<string, any[]> = {};
      rows.forEach((r: any) => {
        const pid = String(r.product_id);
        byProduct[pid] = byProduct[pid] || [];
        byProduct[pid].push(r);
      });

      res.json({ images: rows, byProduct });
    } catch (err) {
      console.error("GET /api/product-images error:", err);
      res.status(500).json({ error: "Failed to fetch product images" });
    }
  });

  // GET /api/product-codes
  // Returns an array of objects { sku, name } sorted alphabetically (case-insensitive ASC)
  app.get("/api/product-codes", async (req, res) => {
    try {
      const rows: any[] = await db.all(
        `SELECT sku, name FROM products WHERE sku IS NOT NULL ORDER BY LOWER(TRIM(sku)) ASC`
      );
      const items = (rows || [])
        .filter((r: any) => r.sku) // ensure sku exists
        .map((r: any) => ({ sku: r.sku, name: r.name || "" }));
      res.json(items);
    } catch (err) {
      console.error("GET /api/product-codes error:", err);
      res.status(500).json({ error: "Failed to fetch product codes" });
    }
  });

  // GET /api/products by category name (flat result: only sku & name)
  app.get("/api/products/category/:categoryName", async (req, res) => {
    const { categoryName } = req.params;
    const perPage = parseInt(req.query.perPage as string) || 50;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;
    const exact = req.query.exact === "1";

    if (!categoryName || !categoryName.trim()) {
      return res.status(400).json({ error: "categoryName is required" });
    }

    try {
      const raw = categoryName.trim();
      const like = `%${raw}%`;

      // simple implementation: join categories and filter by category name
      const whereClause = exact
        ? `WHERE LOWER(COALESCE(c.name,'')) = LOWER(?)`
        : `WHERE LOWER(COALESCE(c.name,'')) LIKE LOWER(?)`;
      const params = [exact ? raw : like];

      const listSql = `
        SELECT p.sku, p.name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
        ORDER BY p.id DESC
        LIMIT ${perPage} OFFSET ${offset}
      `;

      const rows = await db.all(listSql, params);
      const items = (rows || []).map((r: any) => ({ sku: r.sku, name: r.name }));

      res.json({ items });
    } catch (err) {
      console.error("GET /api/products/category/:categoryName error:", err);
      res.status(500).json({ error: "Failed to fetch products by category" });
    }
  });

  // export products as XLSX (download)
  app.get("/api/export-products", async (req, res) => {
    try {
      // Accept categoryId and common aliases, and normalize query parser outputs (string | number | string[]).
      const categoryQueryValue = (req.query as any).categoryId ?? (req.query as any).category_id ?? (req.query as any).category;
      const rawCategoryId = Array.isArray(categoryQueryValue)
        ? String(categoryQueryValue[0] ?? "").trim()
        : String(categoryQueryValue ?? "").trim();

      if (rawCategoryId && !/^\d+$/.test(rawCategoryId)) {
        return res.status(400).json({ error: "categoryId must be a number" });
      }

      const categoryId = rawCategoryId ? Number(rawCategoryId) : null;
      const whereClause = categoryId !== null ? `WHERE CAST(p.category_id AS UNSIGNED) = ?` : "";
      const queryParams: any[] = categoryId !== null ? [categoryId] : [];

      const rows: any[] = await db.all(`
        SELECT 
          p.id, p.sku, p.name, p.category_id, p.brand_id, p.costingPrice, p.price, p.unit, p.sellingType, p.qty, p.createdBy, p.description, p.createdOn,
          p.store_id, s.name as store_name,
          p.warehouse_id, w.name as warehouse_name,
          b.name as brand_name,
          c.name as category_name
        FROM products p
        LEFT JOIN stores s ON p.store_id = s.id
        LEFT JOIN warehouses w ON p.warehouse_id = w.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
        ORDER BY p.id ASC
      `, queryParams);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Products");

      // headers for import/export (without Product ID)
      sheet.columns = [
        { header: "SKU", key: "sku", width: 18 },
        { header: "Name", key: "name", width: 40 },
        { header: "Category", key: "category", width: 24 },
        { header: "Brand", key: "brand", width: 20 },
        { header: "Costing Price", key: "costingPrice", width: 12 },
        { header: "Price", key: "price", width: 12 },
        { header: "Unit", key: "unit", width: 12 },
        { header: "Selling Type", key: "sellingType", width: 16 },
        { header: "Qty", key: "qty", width: 10 },
        { header: "Created By", key: "createdBy", width: 18 },
        { header: "Description", key: "description", width: 40 },
        { header: "Created On", key: "createdOn", width: 24 },
        { header: "Store", key: "store", width: 24 },
        { header: "Warehouse", key: "warehouse", width: 24 },
        { header: "Images", key: "images", width: 60 },
      ];

      // add rows; include relation names and images joined by semicolon (without Product ID)
      for (const r of rows) {
        const imgs = await db.all(`SELECT url FROM product_images WHERE product_id = ?`, [r.id]);
        const imgsStr = (imgs || []).map((i: any) => i.url).join(";");

        sheet.addRow({
          sku: r.sku || "",
          name: r.name || "",
          category: r.category_name || "",
          brand: r.brand_name || "",
          costingPrice: r.costingPrice ?? "",
          price: r.price ?? "",
          unit: r.unit || "",
          sellingType: r.sellingType || "",
          qty: Number(r.qty || 0),
          createdBy: r.createdBy || "",
          description: r.description || "",
          createdOn: r.createdOn || "",
          store: r.store_name || "",
          warehouse: r.warehouse_name || "",
          images: imgsStr,
        });
      }

      sheet.getRow(1).font = { bold: true };

      const buf = await workbook.xlsx.writeBuffer();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="products_export.xlsx"'
      );
      res.send(Buffer.from(buf));
    } catch (err) {
      console.error("GET /api/products/export error:", err);
      res.status(500).json({ error: "Failed to export products" });
    }
  });

  // import products from XLSX (upload)
  app.post("/api/import-products", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "file is required" });

      const workbook = new ExcelJS.Workbook();
      if (req.file.buffer) {
        await workbook.xlsx.load(req.file.buffer as any);
      } else if (req.file.path) {
        await workbook.xlsx.readFile(req.file.path);
      } else {
        return res.status(400).json({ error: "uploaded file unreadable" });
      }

      const sheet = workbook.worksheets[0];
      if (!sheet) return res.status(400).json({ error: "no worksheet found" });

      // preload caches and helpers: find or create by name for categories, brands, stores, warehouses
      const _cache: Record<string, Map<string, number>> = {
        categories: new Map(),
        brands: new Map(),
        stores: new Map(),
        warehouses: new Map(),
      };

      async function _preload(table: string) {
        try {
          const rows = await db.all(`SELECT id, name FROM ${table}`);
          if (rows && rows.length) {
            for (const r of rows) {
              if (!r.name) continue;
              _cache[table].set(String(r.name).trim().toLowerCase(), r.id);
            }
          }
        } catch (e) {
          // ignore missing tables or errors during preload
        }
      }

      await Promise.all([
        _preload('categories'),
        _preload('brands'),
        _preload('stores'),
        _preload('warehouses'),
      ]);

      const header = sheet.getRow(1).values as any[];
      // normalize header to map column index to key
      const colMap: Record<number, string> = {};
      for (let i = 1; i <= header.length; i++) {
        const h = header[i];
        if (!h) continue;
        const key = String(h).trim().toLowerCase();
        // map friendly names to product fields

        if (key === 'sku') colMap[i] = 'sku';
        else if (key === 'name' || key === 'product name') colMap[i] = 'name';
        else if (key === 'category') colMap[i] = 'category';
        else if (key === 'brand') colMap[i] = 'brand';
        else if (key === 'costing price') colMap[i] = 'costingPrice';
        else if (key === 'price') colMap[i] = 'price';
        else if (key === 'unit') colMap[i] = 'unit';
        else if (key === 'selling type') colMap[i] = 'sellingType';
        else if (key === 'qty' || key === 'stock' || key === 'quantity') colMap[i] = 'qty';
        else if (key === 'created by') colMap[i] = 'createdBy';
        else if (key === 'description') colMap[i] = 'description';
        else if (key === 'created on') colMap[i] = 'createdOn';
        else if (key === 'store') colMap[i] = 'store';
        else if (key === 'warehouse') colMap[i] = 'warehouse';
        else if (key === 'images') colMap[i] = 'images';
      }

      // Import: parse rows and insert products only (no insertion into relation tables)

      const parsedRows: Array<{ rowNumber: number; item: any }> = [];
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const rvals = row.values as any[];
        const item: any = {};
        for (const idxStr of Object.keys(colMap)) {
          const idx = Number(idxStr);
          const key = colMap[idx];
          item[key] = rvals[idx] !== undefined ? rvals[idx] : null;
        }
        parsedRows.push({ rowNumber, item });
      });

      // Collect unique relation names from parsed rows that are NOT already in cache
      const needCategories = new Set<string>();
      const needBrands = new Set<string>();
      const needStores = new Set<string>();
      const needWarehouses = new Set<string>();

      for (const { item } of parsedRows) {
        if (item.category) {
          const n = String(item.category).trim();
          if (n) {
            const key = n.toLowerCase();
            if (!_cache.categories.has(key)) needCategories.add(n);
          }
        }
        if (item.brand) {
          const n = String(item.brand).trim();
          if (n) {
            const key = n.toLowerCase();
            if (!_cache.brands.has(key)) needBrands.add(n);
          }
        }
        if (item.store) {
          const n = String(item.store).trim();
          if (n) {
            const key = n.toLowerCase();
            if (!_cache.stores.has(key)) needStores.add(n);
          }
        }
        if (item.warehouse) {
          const n = String(item.warehouse).trim();
          if (n) {
            const key = n.toLowerCase();
            if (!_cache.warehouses.has(key)) needWarehouses.add(n);
          }
        }
      }

      // helper: fetch existing ids for a table for the provided names (single batch SELECT)
      async function fetchExisting(table: string, names: Set<string>) {
        if (!names || names.size === 0) return [] as string[];
        const lowerNames = Array.from(names).map((s) => String(s).trim().toLowerCase());
        const placeholders = lowerNames.map(() => '?').join(',');
        try {
          const rows = await db.all(
            `SELECT id, name FROM ${table} WHERE LOWER(TRIM(name)) IN (${placeholders})`,
            lowerNames
          );
          const found = new Set<string>();
          for (const r of rows) {
            if (!r.name) continue;
            const key = String(r.name).trim().toLowerCase();
            _cache[table].set(key, r.id);
            found.add(key);
          }
          return Array.from(names).filter((n) => !found.has(n.toLowerCase()));
        } catch (e) {
          // on error, consider all names missing
          return Array.from(names);
        }
      }

      const missingCategories = await fetchExisting('categories', needCategories);
      const missingBrands = await fetchExisting('brands', needBrands);
      const missingStores = await fetchExisting('stores', needStores);
      const missingWarehouses = await fetchExisting('warehouses', needWarehouses);

      const missingRelations = {
        categories: missingCategories,
        brands: missingBrands,
        stores: missingStores,
        warehouses: missingWarehouses,
      };

      const errors: any[] = [];
      let inserted = 0;

      for (const { rowNumber, item } of parsedRows) {
        try {
          const category_id = item.category ? (_cache.categories.get(String(item.category).trim().toLowerCase()) ?? null) : null;
          const brand_id = item.brand ? (_cache.brands.get(String(item.brand).trim().toLowerCase()) ?? null) : null;
          const store_id = item.store ? (_cache.stores.get(String(item.store).trim().toLowerCase()) ?? null) : null;
          const warehouse_id = item.warehouse ? (_cache.warehouses.get(String(item.warehouse).trim().toLowerCase()) ?? null) : null;

          const sku = item.sku ? String(item.sku).trim() : null;
          const name = item.name ? String(item.name).trim() : null;
          const costingPrice = item.costingPrice != null ? String(item.costingPrice) : null;
          const price = item.price != null ? String(item.price) : null;
          const unit = item.unit ? String(item.unit) : null;
          const sellingType = item.sellingType ? String(item.sellingType) : null;
          const qty = item.qty != null ? Number(item.qty) : 0;
          const createdBy = item.createdBy ? String(item.createdBy) : null;
          const description = item.description ? String(item.description) : null;
          let createdOn = null;
          if (item.createdOn) {
            const d = new Date(item.createdOn);
            if (!isNaN(d.getTime())) {
              const pad = (n: number) => n < 10 ? '0' + n : n;
              createdOn = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            }
          }

          await db.run(
            `INSERT INTO products (sku, name, category_id, brand_id, costingPrice, price, unit, sellingType, qty, createdBy, description, createdOn, store_id, warehouse_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [sku, name, category_id, brand_id, costingPrice, price, unit, sellingType, qty, createdBy, description, createdOn, store_id, warehouse_id]
          );

          const prodResult = await db.get('SELECT LAST_INSERT_ID() as id');
          const prodId = prodResult ? prodResult.id : null;

          if (prodId && item.images) {
            const imgStr = String(item.images);
            const parts = imgStr.split(/;|,|\n/).map((s: string) => s.trim()).filter((s: string) => s);
            for (const url of parts) {
              await db.run(`INSERT INTO product_images (product_id, url) VALUES(?,?)`, [prodId, url]);
            }
          }

          inserted++;
        } catch (e) {
          errors.push({ row: rowNumber, error: String(e) });
        }
      }

      res.json({ success: 1, inserted, errors, missingRelations });
    } catch (err) {
      console.error('POST /api/import-products error:', err);
      res.status(500).json({ error: 'Failed to import products' });
    }
  });
}
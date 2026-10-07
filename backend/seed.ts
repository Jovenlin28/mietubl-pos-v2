// Updated seed.ts - include this file content replacing your existing seed.ts
import mysqlClient from "./db/mysqlClient";

export async function seedDatabase() {
  const pool = await mysqlClient.initPool();

  try {
    // brands
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS brands (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50),
        createdOn DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // categories
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        categorySlug VARCHAR(255),
        status VARCHAR(50),
        createdOn DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // stores
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS stores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        phoneNumber VARCHAR(64),
        status VARCHAR(50),
        createdOn DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // warehouses
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contactPerson VARCHAR(255),
        contactEmail VARCHAR(255),
        contactPhone VARCHAR(64),
        address TEXT NOT NULL,
        status VARCHAR(50),
        createdOn DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // products
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sku VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        category_id INT,
        brand_id INT,
        costingPrice DECIMAL(15,2),
        price DECIMAL(15,2),
        unit VARCHAR(64),
        sellingType VARCHAR(64),
        qty INT,
        createdBy VARCHAR(255),
        description TEXT,
        discountType VARCHAR(64),
        discountValue DECIMAL(15,2),
        store_id INT,
        warehouse_id INT,
        createdOn DATETIME,
        INDEX (category_id),
        INDEX (brand_id),
        INDEX (store_id),
        INDEX (warehouse_id),
        CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_products_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_products_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // product_images (cascade when product deleted)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS product_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        url TEXT NOT NULL,
        INDEX (product_id),
        CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // product_freebies (link freebies to products)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS product_freebies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        name VARCHAR(255),
        qty INT DEFAULT 0,
        sku VARCHAR(255),
        price DECIMAL(15,2) DEFAULT 0,
        purchaseOrderNumber VARCHAR(255) DEFAULT NULL,
        INDEX (product_id),
        CONSTRAINT fk_product_freebies_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Attempt to add missing columns if table pre-existed without them
    try {
      await pool.execute(`
        ALTER TABLE product_freebies
        ADD COLUMN IF NOT EXISTS purchaseOrderNumber VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS price DECIMAL(15,2) DEFAULT 0
      `);
    } catch (e) {
      // Some MySQL versions do not support IF NOT EXISTS for ALTER with multiple additions.
      // Add columns individually and quietly ignore errors if already present.
      try {
        await pool.execute(`ALTER TABLE product_freebies ADD COLUMN purchaseOrderNumber VARCHAR(255) DEFAULT NULL`);
      } catch (err) { /* ignore */ }
      try {
        await pool.execute(`ALTER TABLE product_freebies ADD COLUMN price DECIMAL(15,2) DEFAULT 0`);
      } catch (err) { /* ignore */ }
    }
    
    // stock_in_log (cascade when product deleted)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS stock_in_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stock_in_date DATE NOT NULL,
        product_id INT NOT NULL,
        stocks_added INT NOT NULL,
        status VARCHAR(100) NOT NULL,
        notes TEXT,
        createdBy VARCHAR(255),
        createdOn DATETIME,
        INDEX (product_id),
        CONSTRAINT fk_stockin_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // expense categories
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // NEW: expense_category_budgets
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS expense_category_budgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        notes TEXT,
        createdOn DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (category_id),
        CONSTRAINT fk_budget_category FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // expenses
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchaseDate DATE NOT NULL,
        expenseCategory VARCHAR(255) NOT NULL,
        itemDescription TEXT NOT NULL,
        totalCost DECIMAL(18,2) NOT NULL,
        status VARCHAR(100) NOT NULL,
        receiptNo VARCHAR(255),
        vendorName VARCHAR(255),
        tinNo VARCHAR(255),
        businessAddress TEXT,
        createdOn DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ensure category_id exists for reliable joins (safe to run multiple times)
    try {
      await pool.execute(`ALTER TABLE expenses ADD COLUMN category_id INT NULL`);
    } catch (e) {
      /* column probably exists — ignore */
    }
    try {
      await pool.execute(`ALTER TABLE expenses ADD INDEX idx_expenses_category_id (category_id)`);
    } catch (e) {
      /* index probably exists — ignore */
    }
    try {
      await pool.execute(`
        ALTER TABLE expenses
        ADD CONSTRAINT fk_expenses_category
        FOREIGN KEY (category_id) REFERENCES expense_categories(id)
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
    } catch (e) {
      /* fk probably exists — ignore */
    }
    
    // customers
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullName VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phoneNumber VARCHAR(64),
        country VARCHAR(128),
        address TEXT,
        storeName VARCHAR(255),
        company VARCHAR(255),
        tinNumber VARCHAR(255),
        status VARCHAR(50),
        createdOn DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // accounts
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50),
        createdOn DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // statement_of_accounts
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS statement_of_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        account_id INT,
        referenceNo VARCHAR(255),
        description TEXT,
        amountToPay DECIMAL(18,2) NOT NULL DEFAULT 0,
        amountPaid DECIMAL(18,2) NOT NULL DEFAULT 0,
        attachment VARCHAR(1024),
        periodStart DATE,
        periodEnd DATE,
        createdOn DATETIME,
        INDEX (account_id),
        CONSTRAINT fk_statement_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // sales
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        saleDate DATETIME,
        paymentStatus VARCHAR(100),
        salesChannel VARCHAR(100),
        receiptNo VARCHAR(255),
        purchaseOrderNumber VARCHAR(255),
        customer_id INT,
        category VARCHAR(255),
        tin VARCHAR(255),
        address TEXT,
        notes TEXT,
        termsOfPayment TEXT,
        createdOn DATETIME,
        INDEX (customer_id),
        CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // sale_items (cascade when sale or product deleted)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(15,2) NOT NULL,
        discount DECIMAL(15,2),
        tax DECIMAL(15,2),
        total DECIMAL(18,2),
        INDEX (sale_id),
        INDEX (product_id),
        CONSTRAINT fk_saleitems_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_saleitems_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // customer_product_discounts
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS customer_product_discounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        product_id INT NOT NULL,
        discount_value DECIMAL(15,2) NOT NULL,
        created_on DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_customer_product (customer_id, product_id),
        CONSTRAINT fk_cpd_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_cpd_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // roles
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        status VARCHAR(50),
        createdOn DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // role_permissions
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_id INT NOT NULL,
        module VARCHAR(255) NOT NULL,
        permission VARCHAR(255) NOT NULL,
        allowed TINYINT(1) NOT NULL DEFAULT 0,
        UNIQUE KEY uq_role_module_permission (role_id, module, permission),
        CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // payments
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        parentPaymentId INT NULL,
        referenceNo VARCHAR(255),
        purchaseOrderNumber VARCHAR(255),
        amount DECIMAL(18,2),
        paymentChannel VARCHAR(255),
        description TEXT,
        createdOn DATETIME,
        paymentDate DATE,
        dueDate DATE NULL,
        attachment VARCHAR(1024),
        INDEX (parentPaymentId),
        CONSTRAINT fk_payments_parent FOREIGN KEY (parentPaymentId)
          REFERENCES payments(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);


    // system_logs
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        description TEXT,
        createdOn DATETIME,
        createdBy VARCHAR(255)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // deliveries
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchaseOrderNumber VARCHAR(255) NOT NULL,
        method VARCHAR(255),
        status VARCHAR(100),
        createdOn DATETIME,
        processedAttachment VARCHAR(1024) NULL,
        pickedUpAttachment VARCHAR(1024) NULL,
        deliveredAttachment VARCHAR(1024) NULL,
        processedDate DATETIME NULL,
        pickedUpDate DATETIME NULL,
        deliveredDate DATETIME NULL,
        INDEX (purchaseOrderNumber)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // quotations
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS quotations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT,
        quotationDate DATETIME NOT NULL,
        notes TEXT,
        termsOfPayment TEXT,
        createdOn DATETIME,
        status VARCHAR(50),
        INDEX (customer_id),
        CONSTRAINT fk_quotations_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // quotation_items (cascade when quotation or product deleted)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(15,2) NOT NULL,
        discount DECIMAL(15,2),
        total DECIMAL(18,2),
        INDEX (quotation_id),
        INDEX (product_id),
        CONSTRAINT fk_qi_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_qi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // users
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullName VARCHAR(255) NOT NULL,
        phone VARCHAR(64),
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        status VARCHAR(50),
        avatar VARCHAR(1024),
        createdOn DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // credit_card_transactions
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS credit_card_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        store_id INT,
        transactionAmount DECIMAL(18,2) NOT NULL,
        transactionDate DATETIME NOT NULL,
        receiptNo VARCHAR(255),
        attachment VARCHAR(1024),
        createdOn DATETIME,
        INDEX (store_id),
        CONSTRAINT fk_cct_store FOREIGN KEY (store_id) REFERENCES stores(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // royalty_fees
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS royalty_fees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mall VARCHAR(255) NULL,
        store VARCHAR(255) NULL,
        partner VARCHAR(255) NULL,
        amountToPay DECIMAL(18,2) NOT NULL DEFAULT 0,
        dueDate DATE NULL,
        amountPaid DECIMAL(18,2) NOT NULL DEFAULT 0,
        datePaid DATE NULL,
        attachment VARCHAR(1024) NULL,
        createdOn DATETIME,
        INDEX (dueDate),
        INDEX (datePaid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // New table: royalty_fees_accounts
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS royalty_fees_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mall VARCHAR(255) NULL,
        store VARCHAR(255) NULL,
        partner VARCHAR(255) NULL,
        status VARCHAR(50) NULL,
        createdOn DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // New table: credit_card_transactions_accounts
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS credit_card_transactions_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        store INT NULL,
        status VARCHAR(50) NULL,
        createdOn DATETIME,
        INDEX (store),
        CONSTRAINT fk_ccta_store FOREIGN KEY (store) REFERENCES stores(id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);


    // Attempt to add missing columns if table pre-existed without them
    // (wrapped in TRY/CATCH blocks in TS, shown here as comments for clarity)
    // ALTER TABLE royalty_fees ADD COLUMN createdOn DATETIME;

    // Insert default admin user (only if not exists)
    try {
      const createdOn = new Date().toISOString().slice(0, 19).replace("T", " ");
      await pool.execute(
        `INSERT INTO users (fullName, phone, username, password, role, status, avatar, createdOn)
         SELECT ?,?,?,?,?,?,?,?
         FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = ?)
         LIMIT 1`,
        [
          "Administrator",
          "",
          "admin",
          "admin123",
          "admin",
          "active",
          "",
          createdOn,
          "admin",
        ]
      );
      console.log('Successfully created admin user')
    } catch (e) {
      console.error("Failed to insert default admin user:", e);
    }

    // Done (no seed rows)
  } catch (err) {
    console.error("seedDatabase failed:", err);
    throw err;
  } finally {
    await (mysqlClient as any).endPool?.();
  }
}
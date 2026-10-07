import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function seedDatabase() {
  const db = await open({
    filename: "./mietubl-pos.db",
    driver: sqlite3.Database,
  });

  await db.run(`DROP TABLE IF EXISTS sale_items`);
  await db.run(`DROP TABLE IF EXISTS sales`);
  await db.run(`DROP TABLE IF EXISTS brands`);
  await db.run(`DROP TABLE IF EXISTS categories`);
  await db.run(`DROP TABLE IF EXISTS stores`);
  await db.run(`DROP TABLE IF EXISTS warehouses`);
  await db.run(`DROP TABLE IF EXISTS products`);
  await db.run(`DROP TABLE IF EXISTS stock_in_log`);
  await db.run(`DROP TABLE IF EXISTS expenses`);
  await db.run(`DROP TABLE IF EXISTS expense_categories`);
  await db.run(`DROP TABLE IF EXISTS customers`);
  await db.run(`DROP TABLE IF EXISTS customer_product_discounts`);
  await db.run(`DROP TABLE IF EXISTS roles`);
  // Remove this line to prevent deleting permissions:
  // await db.run(`DROP TABLE IF EXISTS role_permissions`);
  await db.run(`DROP TABLE IF EXISTS payments`);
  // Re-create payments table with purchaseOrderNumber column
  await db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referenceNo TEXT,
      purchaseOrderNumber TEXT,
      amount REAL,
      paymentChannel TEXT,
      description TEXT,
      createdOn TEXT,
      paymentDate TEXT,
      attachment TEXT
    )
  `);
  await db.run(`DROP TABLE IF EXISTS quotations`); // New line to drop quotations table
  await db.run(`DROP TABLE IF EXISTS quotation_items`); // New line to drop quotation_items table

  await db.run(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT,
      createdOn TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      categorySlug TEXT,
      status TEXT,
      createdOn TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phoneNumber TEXT,
      status TEXT CHECK(status IN ('Active', 'Inactive')),
      createdOn TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contactPerson TEXT,
      contactEmail TEXT,
      contactPhone TEXT,
      address TEXT NOT NULL,
      status TEXT NOT NULL,
      createdOn TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER,
      brand_id INTEGER,
     costingPrice REAL,                -- NEW: costing price
      price REAL,
      unit TEXT CHECK(unit IN ('Box', 'Piece')),
      sellingType TEXT CHECK(sellingType IN ('Retail', 'Wholesale')),
      qty INTEGER,
      createdBy TEXT,
      description TEXT,
      discountType TEXT,
      discountValue REAL,
      store_id INTEGER,
      warehouse_id INTEGER,
      createdOn TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (brand_id) REFERENCES brands(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )
  `);

  // New table to hold product images
  await db.run(`
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS stock_in_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_in_date DATE NOT NULL,
      product_id INTEGER NOT NULL,
      stocks_added INTEGER NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      createdBy TEXT,            -- NEW: who performed the stock-in
      createdOn TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchaseDate TEXT NOT NULL,
      expenseCategory TEXT NOT NULL,
      itemDescription TEXT NOT NULL,
      totalCost REAL NOT NULL,
      status TEXT NOT NULL,
      receiptNo TEXT,
      vendorName TEXT,
      tinNo TEXT,
      businessAddress TEXT,
      createdOn TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      email TEXT,
      phoneNumber TEXT,
      country TEXT,
      address TEXT,           -- new
      storeName TEXT,         -- new
      company TEXT,           -- new, optional
      tinNumber TEXT,         -- new, optional
      status TEXT,
      createdOn TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      saleDate TEXT,
      paymentStatus TEXT,
      salesChannel TEXT,
      receiptNo TEXT,
      purchaseOrderNumber TEXT,   -- NEW: optional PO number
      customer_id INTEGER,
      tin TEXT,
      address TEXT,
      notes TEXT,
     termsOfPayment TEXT,        -- NEW: nullable terms of payment
      createdOn TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      discount REAL,
      tax REAL,
      total REAL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS customer_product_discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      discount_value REAL NOT NULL,
      created_on TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(customer_id, product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      status TEXT CHECK(status IN ('Active', 'Inactive')) NOT NULL,
      createdOn TEXT NOT NULL
    )
  `);

  // Remove this line to prevent deleting permissions:
  await db.run(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      module TEXT NOT NULL,
      permission TEXT NOT NULL,
      allowed INTEGER NOT NULL DEFAULT 0,
      UNIQUE(role_id, module, permission),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referenceNo TEXT,
      purchaseOrderNumber TEXT,
      amount REAL,
      paymentChannel TEXT,
      description TEXT,
      createdOn TEXT,
      paymentDate TEXT,
      attachment TEXT
    )
  `);

  // Add new tables for quotations and quotation_items
  await db.run(`
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      quotationDate TEXT NOT NULL,
      notes TEXT,
      termsOfPayment TEXT,        
      createdOn TEXT NOT NULL,
      status TEXT CHECK(status IN ('Pending', 'Sent', 'Ordered')) NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      discount REAL,
      total REAL,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  await db.run(`DELETE FROM brands`);
  await db.run(`DELETE FROM categories`);
  await db.run(`DELETE FROM stores`);
  await db.run(`DELETE FROM warehouses`);
  await db.run(`DELETE FROM products`);
  await db.run(`DELETE FROM stock_in_log`);
  await db.run(`DELETE FROM expenses`);
  await db.run(`DELETE FROM expense_categories`);
  await db.run(`DELETE FROM sales`);
  await db.run(`DELETE FROM customers`);
  await db.run(`DELETE FROM customer_product_discounts`);
  await db.run(`DELETE FROM roles`);
  await db.run(`DELETE FROM payments`);
  await db.run(`DELETE FROM quotations`); // New line to delete from quotations table
  await db.run(`DELETE FROM quotation_items`); // New line to delete from quotation_items table
  await db.run(`DELETE FROM product_images`);
  // Remove this line to prevent deleting all permission records:
  await db.run(`DELETE FROM role_permissions`);
  await db.run(`DELETE FROM sqlite_sequence WHERE name IN ('brands', 'categories', 'stores', 'warehouses', 'products', 'stock_in_log', 'expenses', 'sales', 'customers', 'customer_product_discounts', 'roles', 'payments', 'quotations', 'quotation_items', 'product_images')`);
  await db.run(`DELETE FROM sqlite_sequence WHERE name = 'expense_categories'`);

  // Seed some expense categories
  await db.run(`
    INSERT INTO expense_categories (name, description) VALUES
      ('Office Supplies', 'Items for everyday office use such as paper, pens, and stationery'),
      ('Payroll', 'Employee salaries, wages, and benefits'),
      ('Marketing', 'Advertising, promotions, and marketing campaigns')
  `);

  await db.run(`
    INSERT INTO brands (name, status, createdOn) VALUES
    ('Lenovo', 'Active', '2024-07-01T10:00:00.000Z'),
    ('Beats', 'Active', '2024-07-02T10:00:00.000Z'),
    ('Nike', 'Inactive', '2024-07-03T10:00:00.000Z')
  `);

  await db.run(`
    INSERT INTO categories (name, categorySlug, status, createdOn) VALUES
    ('Computers', 'computers', 'Active', '2024-07-01T10:00:00.000Z'),
    ('Electronics', 'electronics', 'Active', '2024-07-02T10:00:00.000Z'),
    ('Shoes', 'shoes', 'Inactive', '2024-07-03T10:00:00.000Z')
  `);

  await db.run(`
    INSERT INTO stores (name, address, phoneNumber, status, createdOn) VALUES
      ('Main Store', '123 Main St, Manila', '+639171234567', 'Active', '2024-07-01T10:00:00.000Z'),
      ('Outlet Store', '456 Beta Ave, Cebu', NULL, 'Inactive', '2024-07-02T10:00:00.000Z'),
      ('Online Store', 'Online Only', NULL, 'Active', '2024-07-03T10:00:00.000Z')
  `);

  await db.run(`
    INSERT INTO warehouses (name, contactPerson, contactEmail, contactPhone, address, status, createdOn) VALUES
      ('Warehouse Alpha', 'John Doe', 'john.alpha@email.com', '+639171234567', '123 Alpha St, Manila', 'Active', '2024-07-01T10:00:00.000Z'),
      ('Warehouse Beta', 'Jane Smith', 'jane.beta@email.com', '+639181234568', '456 Beta Ave, Cebu', 'Inactive', '2024-07-02T10:00:00.000Z'),
      ('Warehouse Gamma', 'Carlos Tan', NULL, NULL, '789 Gamma Rd, Davao', 'Active', '2024-07-03T10:00:00.000Z')
  `);

  await db.run(`
    INSERT INTO products (sku, name, category_id, brand_id, costingPrice, price, unit, sellingType, qty, createdBy, description, discountType, discountValue, store_id, warehouse_id, createdOn) VALUES
    ('PT001', 'Lenovo IdeaPad 3', 1, 1, NULL, 600, 'Piece', 'Retail', 100, 'James Kirwin', 'Laptop', 'Fixed', 50, 1, 1, '2024-07-01T10:00:00.000Z'),
    ('PT002', 'Beats Pro', 2, 2, NULL, 160, 'Box', 'Wholesale', 140, 'Francis Chiang', 'Headphones', 'Percentage', 10, 2, 2, '2024-07-02T10:00:00.000Z'),
    ('PT003', 'Nike Jordan', 3, 3, NULL, 110, 'Piece', 'Retail', 300, 'Antonio Engle', 'Shoes', NULL, NULL, 3, 3, '2024-07-03T10:00:00.000Z')
  `);

  await seedStockInLog(db);

  await db.run(`
    INSERT INTO expenses (
      purchaseDate, expenseCategory, itemDescription, totalCost, status,
      receiptNo, vendorName, tinNo, businessAddress, createdOn
    ) VALUES
      ('2025-01-01', 'Miscellaneous', 'Office Supplies', 198000, 'Fulfilled', 'R-001', 'ABC Corp', '123456789', '123 Main St', '2025-01-01T10:00:00.000Z'),
      ('2025-02-01', 'Research & Development', 'Lab Equipment', 176000, 'Fulfilled', 'R-002', 'XYZ Labs', '987654321', '456 Science Ave', '2025-02-01T10:00:00.000Z'),
      ('2025-03-01', 'Technology & Software', 'Software Licenses', 153000, 'Unfulfilled', '', '', '', '', '2025-03-01T10:00:00.000Z'),
      ('2025-04-01', 'Professional Services', 'Consulting Fee', 142250, 'Fulfilled', 'R-003', 'ConsultPro', '112233445', '789 Business Rd', '2025-04-01T10:00:00.000Z'),
      ('2025-05-01', 'Employee Payroll', 'Monthly Payroll', 131000, 'Fulfilled', '', 'Payroll Inc', '', '', '2025-05-01T10:00:00.000Z'),
      ('2025-06-01', 'Cost of Goods', 'Raw Materials', 112000, 'Unfulfilled', '', '', '', '', '2025-06-01T10:00:00.000Z'),
      ('2025-07-01', 'Marketing & Advertisement', 'Ad Campaign', 104000, 'Fulfilled', 'R-004', 'AdWorks', '', '321 Market St', '2025-07-01T10:00:00.000Z'),
      ('2025-08-01', 'Operational Expenses', 'Utilities', 84000, 'Fulfilled', '', '', '', '', '2025-08-01T10:00:00.000Z'),
      ('2025-09-01', 'General and Administration', 'Admin Supplies', 61000, 'Fulfilled', '', '', '', '', '2025-09-01T10:00:00.000Z'),
      ('2025-10-01', 'Shipment Payment', 'Courier Fee', 0, 'Unfulfilled', '', '', '', '', '2025-10-01T10:00:00.000Z')
  `);

  await db.run(`
    INSERT INTO customers (fullName, email, phoneNumber, country, address, storeName, company, tinNumber, status, createdOn) VALUES
      ('Alice Johnson', 'alice.johnson@email.com', '+639171234567', 'Philippines', '123 Main St, Manila', 'Alice Gadget Store', 'ABC Company', NULL, 'Active', '2024-07-01T10:00:00.000Z'),
      ('Bob Smith', 'bob.smith@email.com', '+639181234568', 'Philippines', '456 Beta Ave, Cebu', 'Bob Gadget Store', 'XYZ Corporation', NULL, 'Active', '2024-07-02T10:00:00.000Z'),
      ('Charlie Lee', 'charlie.lee@email.com', '+639191234569', 'Singapore', '789 Gamma Rd, Davao', 'Charlie Gadget Store', 'LMN Pte Ltd', NULL, 'Inactive', '2024-07-03T10:00:00.000Z'),
      ('Diana Cruz', 'diana.cruz@email.com', '+639201234570', 'Philippines', '321 Delta St, Manila', 'Diana Gadget Store', 'OPQ Inc', NULL, 'Active', '2024-07-04T10:00:00.000Z'),
      ('Edward Tan', 'edward.tan@email.com', '+639211234571', 'Malaysia', '654 Epsilon Ave, Cebu', 'Edward Gadget Store', 'RST Sdn Bhd', NULL, 'Inactive', '2024-07-05T10:00:00.000Z')
  `);

  const products = await db.all("SELECT id FROM products LIMIT 3");
  const customers = await db.all("SELECT id FROM customers LIMIT 3");

  if (products.length >= 2 && customers.length >= 2) {
    await db.run(`
      INSERT INTO customer_product_discounts (customer_id, product_id, discount_value)
      VALUES
        (?, ?, ?),
        (?, ?, ?),
        (?, ?, ?)
    `,
      customers[0].id, products[0].id, 500,
      customers[0].id, products[1].id, 1000,
      customers[1].id, products[0].id, 200
    );
  }

  const productsForSales = await db.all("SELECT id FROM products LIMIT 10");

  await db.run(`
    INSERT INTO sales (
      saleDate, paymentStatus, salesChannel, receiptNo, purchaseOrderNumber, customer_id, tin, address, notes, createdOn
    ) VALUES
      ('2024-08-01', 'Paid', 'Online', 'R001', 'PO-20250828-0001', 1, '123-456-789', 'Manila', 'First sale', '2024-08-01T10:00:00Z'),
      ('2024-08-02', 'Unpaid', 'In-Store', 'R002', 'PO-20250828-0002', 2, '234-567-890', 'Quezon City', '', '2024-08-02T11:00:00Z'),
      ('2024-08-03', 'Partial', 'Reseller', 'R003', 'PO-20250828-0003', 3, '345-678-901', 'Singapore', '', '2024-08-03T12:00:00Z')
  `);

  // Example: Insert a sale and related sale_items
  const saleInsert = await db.run(`
    INSERT INTO sales (
      saleDate, paymentStatus, salesChannel, receiptNo, purchaseOrderNumber, customer_id, tin, address, notes, createdOn
    ) VALUES
      ('2025-08-10', 'Paid', 'Online', 'R1001', '', 1, '123-456-789', 'Manila', 'Sample sale', '2025-08-10T10:00:00Z')
  `);

  const saleId = saleInsert.lastID;
  const productsForSaleItems = await db.all("SELECT id, price FROM products LIMIT 2");

  if (saleId && productsForSaleItems.length >= 2) {
    await db.run(`
      INSERT INTO sale_items (sale_id, product_id, quantity, price, discount, tax, total)
      VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
    `,
      saleId, productsForSaleItems[0].id, 2, productsForSaleItems[0].price, 10, 0, (productsForSaleItems[0].price - 10) * 2,
      saleId, productsForSaleItems[1].id, 1, productsForSaleItems[1].price, 0, 0, productsForSaleItems[1].price
    );
  }

  // Create users table (include avatar column)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      phone TEXT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      avatar TEXT,                -- NEW: nullable avatar column
      createdOn TEXT NOT NULL
    );
  `);

  // Seed 3 users if table is empty
  const userCount = await db.get(`SELECT COUNT(*) as count FROM users`);
  if (userCount.count === 0) {
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO users (fullName, phone, username, password, role, status, avatar, createdOn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "Admin User",
        "09171234567",
        "admin",
        "admin123",
        "SuperAdmin",
        "Active",
        "",
        now,
      ]
    );
    await db.run(
      `INSERT INTO users (fullName, phone, username, password, role, status, avatar, createdOn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "Cashier One",
        "09181112222",
        "cashier1",
        "cashierpass",
        "Staff",
        "Active",
        "",
        now,
      ]
    );
    await db.run(
      `INSERT INTO users (fullName, phone, username, password, role, status, avatar, createdOn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "Manager Jane",
        "09182223333",
        "managerjane",
        "managerpw",
        "Manager",
        "Inactive",
        "",
        now,
      ]
    );
  }

  await db.run(`
    INSERT INTO roles (name, status, createdOn) VALUES
      ('SuperAdmin', 'Active', '2024-07-01T10:00:00.000Z'),
      ('Manager', 'Active', '2024-07-01T10:00:00.000Z'),
      ('Staff', 'Active', '2024-07-01T10:00:00.000Z')
  `);

  await db.run(`
    INSERT INTO payments (referenceNo, amount, paymentChannel, description, createdOn, paymentDate, attachment) VALUES
      ('PAY-001', 15000, 'Bank Transfer', 'Payment for invoice INV-001', '2025-08-01T10:00:00.000Z', '2025-08-01', 'receipt-pay-001.pdf'),
      ('PAY-002', 8000, 'Cash', 'Partial payment for invoice INV-002', '2025-08-02T11:00:00.000Z', '2025-08-02', 'receipt-pay-002.jpg'),
      ('PAY-003', 12000, 'Credit Card', 'Full payment for invoice INV-003', '2025-08-03T12:00:00.000Z', '2025-08-03', 'receipt-pay-003.png')
  `);
}

async function seedStockInLog(db: any) {
  const products = await db.all("SELECT id FROM products LIMIT 2");
  if (!products.length) return;

  await db.run(
    `INSERT INTO stock_in_log (stock_in_date, product_id, stocks_added, status, notes, createdOn)
     VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
    '2025-01-01', products[0].id, 100, 'Completed', 'Initial stock', '2025-01-01T10:00:00.000Z',
    '2025-02-01', products[1]?.id || products[0].id, 50, 'In Process', '', '2025-02-01T10:00:00.000Z'
  );
}
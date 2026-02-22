import Database from 'better-sqlite3';

const db = new Database('shop.db', { verbose: console.log });

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    imageUrl TEXT,
    stock INTEGER DEFAULT 0,
    sizes TEXT DEFAULT '["S","M","L"]',
    colors TEXT DEFAULT '["Black","White"]',
    tags TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customerName TEXT NOT NULL,
    customerEmail TEXT NOT NULL,
    customerAddress TEXT NOT NULL,
    totalAmount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    priceAtTime REAL NOT NULL,
    FOREIGN KEY(orderId) REFERENCES orders(id),
    FOREIGN KEY(productId) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imageUrl TEXT NOT NULL,
    title TEXT,
    subtitle TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Safe migrations for existing database
try {
  db.exec(`ALTER TABLE products ADD COLUMN sizes TEXT DEFAULT '["S","M","L"]'`);
} catch (e) { /* Column already exists */ }

try {
  db.exec(`ALTER TABLE products ADD COLUMN colors TEXT DEFAULT '["Black","White"]'`);
} catch (e) { /* Column already exists */ }

try {
  db.exec(`ALTER TABLE products ADD COLUMN images TEXT DEFAULT '[]'`);
} catch (e) { /* Column already exists */ }

try {
  db.exec(`ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'Uncategorized'`);
} catch (e) { /* Column already exists */ }

try {
  db.exec(`ALTER TABLE products ADD COLUMN previousPrice REAL`);
} catch (e) { /* Column already exists */ }

try {
  db.exec(`ALTER TABLE products ADD COLUMN tags TEXT DEFAULT '[]'`);
} catch (e) { /* Column already exists */ }

// New Order Fields
try { db.exec(`ALTER TABLE orders ADD COLUMN customerPhone TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE orders ADD COLUMN shippingArea TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE orders ADD COLUMN orderNote TEXT`); } catch (e) { }

// New Order Item Fields
try { db.exec(`ALTER TABLE order_items ADD COLUMN selectedSize TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE order_items ADD COLUMN selectedColor TEXT`); } catch (e) { }

// Seed default settings if they don't exist
try {
  const checkSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

  if (!checkSetting.get('delivery_inside')) insertSetting.run('delivery_inside', '60');
  if (!checkSetting.get('delivery_outside')) insertSetting.run('delivery_outside', '120');

  if (!checkSetting.get('store_categories')) {
    insertSetting.run('store_categories', JSON.stringify([]));
  } else {
    // If exact default string is still present, wipe it to oblige user request to remove previous defaults
    const currentCats = checkSetting.get('store_categories').value;
    if (currentCats === '[{"name":"Panjabi","serial":1},{"name":"Pajama","serial":2},{"name":"Koti","serial":3}]') {
      db.prepare("UPDATE settings SET value='[]' WHERE key='store_categories'").run();
    }
  }
  if (!checkSetting.get('notification_sound_enabled')) {
    insertSetting.run('notification_sound_enabled', 'true');
  }
} catch (e) {
  console.error("Failed to seed default settings:", e);
}

export default db;

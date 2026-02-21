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
    colors TEXT DEFAULT '["Black","White"]'
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

// New Order Fields
try { db.exec(`ALTER TABLE orders ADD COLUMN customerPhone TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE orders ADD COLUMN shippingArea TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE orders ADD COLUMN orderNote TEXT`); } catch (e) { }

// New Order Item Fields
try { db.exec(`ALTER TABLE order_items ADD COLUMN selectedSize TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE order_items ADD COLUMN selectedColor TEXT`); } catch (e) { }

// Seed some initial breathtaking dresses if products table is empty
const stmt = db.prepare("SELECT count(*) as count FROM products");
const result = stmt.get();

if (result.count === 0) {
  const insert = db.prepare('INSERT INTO products (name, description, price, imageUrl, stock) VALUES (?, ?, ?, ?, ?)');
  const insertMany = db.transaction((products) => {
    for (const prod of products) insert.run(prod.name, prod.description, prod.price, prod.imageUrl, prod.stock);
  });

  insertMany([
    {
      name: 'Midnight Silk Gown',
      description: 'An elegant sweeping midnight blue silk gown, perfect for galas.',
      price: 299.99,
      imageUrl: 'https://images.unsplash.com/photo-1566160983195-6fcfe7e22119?q=80&w=600&auto=format&fit=crop',
      stock: 12
    },
    {
      name: 'Champagne Lace Cocktail',
      description: 'Intricate champagne lace over a blush slip. A modern classic.',
      price: 189.50,
      imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059f581ce?q=80&w=600&auto=format&fit=crop',
      stock: 8
    },
    {
      name: 'Emerald Velvet Wrap',
      description: 'Luxurious emerald velvet with a flattering wrap silhouette.',
      price: 245.00,
      imageUrl: 'https://images.unsplash.com/photo-1572804013309-8c98e252119d?q=80&w=600&auto=format&fit=crop',
      stock: 5
    }
  ]);
  console.log("Database seeded with initial products.");
}



export default db;

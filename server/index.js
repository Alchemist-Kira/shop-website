import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import sharp from 'sharp';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-123';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

const app = express();
const port = process.env.PORT || 3001; // Backend on 3001, Vite frontend on 5173

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Image Optimization Middleware
const processImages = async (req, res, next) => {
    try {
        if (!req.files && !req.file) return next();

        // Single file (Banners)
        if (req.file) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = uniqueSuffix + '.webp';
            const outputPath = path.join(__dirname, 'uploads', filename);

            await sharp(req.file.buffer)
                .webp({ quality: 80, effort: 4 })
                .resize({ width: 1920, withoutEnlargement: true }) // Max width to avoid huge files
                .toFile(outputPath);

            req.file.filename = filename;
            req.file.path = outputPath;
        }

        // Multiple files (Products)
        if (req.files && req.files.length > 0) {
            await Promise.all(req.files.map(async (file) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = uniqueSuffix + '.webp';
                const outputPath = path.join(__dirname, 'uploads', filename);

                await sharp(file.buffer)
                    .webp({ quality: 80, effort: 4 })
                    .resize({ width: 1200, withoutEnlargement: true }) // Max width for products
                    .toFile(outputPath);

                file.filename = filename;
                file.path = outputPath;
            }));
        }
        next();
    } catch (err) {
        console.error("Image processing error:", err);
        return res.status(500).json({ error: 'Image processing failed' });
    }
};

app.use(cors());
app.use(express.json());
// Serve the uploads directory statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- ROUTES ---

// Admin Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Check credentials against environment variables
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ username: ADMIN_USERNAME }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Invalid username or password' });
    }
});

// Get all products (Public)
app.get('/api/products', (req, res) => {
    try {
        const products = db.prepare('SELECT * FROM products').all();
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get a single product (Public)
app.get('/api/products/:id', (req, res) => {
    try {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Add Product (with multiple images support and tags)
app.post('/api/products', authenticateToken, upload.array('images'), processImages, (req, res) => {
    const { name, description, price, previousPrice, stock, sizes, colors, tags, category } = req.body;
    let imagesArr = [];
    if (req.files && req.files.length > 0) {
        imagesArr = req.files.map(file => `/uploads/${file.filename}`);
    }

    const imageUrl = imagesArr.length > 0 ? imagesArr[0] : null;
    const imagesJson = JSON.stringify(imagesArr);

    let productSizes = '[]';
    // If sizes is a stringified JSON array, use it directly. Otherwise construct a default.
    if (sizes) {
        try {
            // Check if it's already a valid JSON string
            JSON.parse(sizes);
            productSizes = sizes;
        } catch (e) {
            productSizes = JSON.stringify(["M-40", "L-42", "XL-44"]);
        }
    } else {
        productSizes = JSON.stringify(["M-40", "L-42", "XL-44"]);
    }

    let productColors = colors || '["Black","White"]';
    let productCategory = category || 'Uncategorized';
    let productTags = tags || '[]';

    // Auto-add new category to settings if it doesn't exist
    try {
        if (productCategory && productCategory !== 'Uncategorized') {
            const catSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('store_categories');
            if (catSetting) {
                let categories = [];
                try { categories = JSON.parse(catSetting.value); } catch (e) { }
                const exists = categories.some(c => c.name.toLowerCase() === productCategory.toLowerCase());
                if (!exists) {
                    const nextSerial = categories.length > 0 ? Math.max(...categories.map(c => c.serial)) + 1 : 1;
                    categories.push({ name: productCategory, serial: nextSerial });
                    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('store_categories', JSON.stringify(categories));
                }
            }
        }
    } catch (err) { console.error("Error auto-adding category:", err); }

    try {
        const stmt = db.prepare('INSERT INTO products (name, description, price, previousPrice, imageUrl, stock, sizes, colors, tags, images, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const info = stmt.run(name, description, price, previousPrice || null, imageUrl, stock, productSizes, productColors, productTags, imagesJson, productCategory);
        res.json({ id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Product (with multiple images replacement support and tags)
app.put('/api/products/:id', authenticateToken, upload.array('images'), processImages, (req, res) => {
    const { id } = req.params;
    const { name, description, price, previousPrice, stock, sizes, colors, tags, category, existingImages } = req.body;

    // existingImages might come as a string or array depending on FormData
    // existingImages field is meant to retain currently uploaded image paths if untouched
    let keepImages = [];
    if (existingImages) {
        try {
            keepImages = JSON.parse(existingImages);
        } catch (e) {
            keepImages = Array.isArray(existingImages) ? existingImages : [existingImages];
        }
    }

    let newImagesArr = [];
    if (req.files && req.files.length > 0) {
        newImagesArr = req.files.map(file => `/uploads/${file.filename}`);
    }

    // Combine kept images and new images
    const finalImagesArr = [...keepImages, ...newImagesArr];
    const imageUrl = finalImagesArr.length > 0 ? finalImagesArr[0] : null;
    const imagesJson = JSON.stringify(finalImagesArr);

    let productCategory = category || 'Uncategorized';
    let productTags = tags || '[]';

    // Auto-add new category to settings if it doesn't exist
    try {
        if (productCategory && productCategory !== 'Uncategorized') {
            const catSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('store_categories');
            if (catSetting) {
                let categories = [];
                try { categories = JSON.parse(catSetting.value); } catch (e) { }
                const exists = categories.some(c => c.name.toLowerCase() === productCategory.toLowerCase());
                if (!exists) {
                    const nextSerial = categories.length > 0 ? Math.max(...categories.map(c => c.serial)) + 1 : 1;
                    categories.push({ name: productCategory, serial: nextSerial });
                    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('store_categories', JSON.stringify(categories));
                }
            }
        }
    } catch (err) { console.error("Error auto-adding category:", err); }

    try {
        const stmt = db.prepare('UPDATE products SET name = ?, description = ?, price = ?, previousPrice = ?, imageUrl = ?, stock = ?, sizes = ?, colors = ?, tags = ?, images = ?, category = ? WHERE id = ?');
        stmt.run(name, description, price, previousPrice || null, imageUrl, stock, sizes, colors, productTags, imagesJson, productCategory, id);
        res.json({ success: true });
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Delete a product (Admin)
app.delete('/api/products/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    try {
        // Fetch product to get images before deletion
        const product = db.prepare('SELECT imageUrl, images FROM products WHERE id = ?').get(id);

        const deleteItems = db.prepare('DELETE FROM order_items WHERE productId = ?');
        const deleteProduct = db.prepare('DELETE FROM products WHERE id = ?');

        const performDeletion = db.transaction(() => {
            deleteItems.run(id);
            deleteProduct.run(id);
        });

        performDeletion();

        // Delete physical files
        if (product) {
            const allImages = [];
            if (product.imageUrl) allImages.push(product.imageUrl);
            if (product.images) {
                try {
                    const parsed = JSON.parse(product.images);
                    allImages.push(...parsed);
                } catch (e) { }
            }

            // Deduplicate and delete
            const uniqueImages = [...new Set(allImages)];
            for (const imgUrl of uniqueImages) {
                if (imgUrl.includes('/uploads/')) {
                    const filename = imgUrl.split('/').pop();
                    const filePath = path.join(__dirname, 'uploads', filename);
                    if (fs.existsSync(filePath)) {
                        try {
                            fs.unlinkSync(filePath);
                        } catch (e) {
                            console.error(`Failed to delete file: ${filePath}`, e);
                        }
                    }
                }
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// --- SSE Setup for Real-time Admin Notifications ---
let sseClients = [];

// Order Stream Endpoint
app.get('/api/orders/stream', (req, res) => {
    const token = req.query.token;
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Tell client connection is established
        res.write('data: {"connected":true}\n\n');

        sseClients.push(res);

        req.on('close', () => {
            sseClients = sseClients.filter(client => client !== res);
        });
    });
});

// Place an order (Public)
app.post('/api/orders', (req, res) => {
    const { customerName, customerEmail, customerPhone, shippingArea, customerAddress, orderNote, totalAmount, items } = req.body;

    try {
        const insertOrder = db.prepare('INSERT INTO orders (customerName, customerEmail, customerPhone, shippingArea, customerAddress, orderNote, totalAmount) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const insertItem = db.prepare('INSERT INTO order_items (orderId, productId, quantity, priceAtTime, selectedSize, selectedColor) VALUES (?, ?, ?, ?, ?, ?)');

        // Run in a transaction
        const placeOrder = db.transaction(() => {
            const info = insertOrder.run(customerName, customerEmail || '', customerPhone || null, shippingArea || null, customerAddress, orderNote || null, totalAmount);
            const orderId = info.lastInsertRowid;

            for (const item of items) {
                const targetId = item.productId || item.id;
                insertItem.run(orderId, targetId, item.quantity, item.price, item.selectedSize || null, item.selectedColor || null);

                // Update stock
                const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
                updateStock.run(item.quantity, targetId);
            }
            return orderId;
        });

        const orderId = placeOrder();

        // Broadcast the new order to connected Admin panels
        try {
            const newOrderRaw = db.prepare(`
                SELECT o.*, 
                       json_group_array(json_object('productId', oi.productId, 'quantity', oi.quantity, 'price', oi.priceAtTime, 'selectedSize', oi.selectedSize, 'selectedColor', oi.selectedColor, 'name', p.name, 'imageUrl', p.imageUrl)) as items
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.orderId
                LEFT JOIN products p ON oi.productId = p.id
                WHERE o.id = ?
                GROUP BY o.id
            `).get(orderId);

            if (newOrderRaw) {
                const formattedNewOrder = {
                    ...newOrderRaw,
                    items: JSON.parse(newOrderRaw.items)
                };
                sseClients.forEach(client => {
                    client.write(`data: ${JSON.stringify(formattedNewOrder)}\n\n`);
                });
            }
        } catch (err) {
            console.error('Failed to broadcast new order via SSE:', err);
        }

        res.json({ success: true, orderId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

// Get all orders (Admin)
app.get('/api/orders', authenticateToken, (req, res) => {
    try {
        const orders = db.prepare(`
      SELECT o.*, 
             json_group_array(json_object('productId', oi.productId, 'quantity', oi.quantity, 'price', oi.priceAtTime, 'selectedSize', oi.selectedSize, 'selectedColor', oi.selectedColor, 'name', p.name, 'imageUrl', p.imageUrl)) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.orderId
      LEFT JOIN products p ON oi.productId = p.id
      GROUP BY o.id
      ORDER BY o.createdAt DESC
    `).all();

        // Parse the JSON string from sqlite back to array
        const formatted = orders.map(o => ({
            ...o,
            items: JSON.parse(o.items)
        }));

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Update order status (Admin)
app.put('/api/orders/:id/status', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const stmt = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
        stmt.run(status, id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// Update order total amount (Admin) - used for changing delivery charges
app.put('/api/orders/:id/total', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { totalAmount } = req.body;
    try {
        const stmt = db.prepare('UPDATE orders SET totalAmount = ? WHERE id = ?');
        stmt.run(totalAmount, id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update order total' });
    }
});

// Delete a specific order (Admin)
app.delete('/api/orders/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    try {
        const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.status === 'pending') {
            return res.status(400).json({ error: 'Cannot delete pending orders' });
        }

        const performDeletion = db.transaction(() => {
            db.prepare('DELETE FROM order_items WHERE orderId = ?').run(id);
            db.prepare('DELETE FROM orders WHERE id = ?').run(id);
        });

        performDeletion();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

// Clear all non-pending orders (Admin)
app.delete('/api/orders', authenticateToken, (req, res) => {
    try {
        const performDeletion = db.transaction(() => {
            // Delete order_items where the parent order is not pending
            db.prepare(`
                DELETE FROM order_items 
                WHERE orderId IN (SELECT id FROM orders WHERE status != 'pending')
            `).run();
            // Delete the orders
            db.prepare("DELETE FROM orders WHERE status != 'pending'").run();
        });

        performDeletion();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to clear orders' });
    }
});

// --- BANNERS API ---

// Get all banners (Public)
app.get('/api/banners', (req, res) => {
    try {
        const banners = db.prepare('SELECT * FROM banners ORDER BY id DESC').all();
        res.json(banners);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch banners' });
    }
});

// Add a banner (Admin)
app.post('/api/banners', authenticateToken, upload.single('image'), processImages, (req, res) => {
    const { title, subtitle } = req.body;
    let imageUrl = '';

    if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
    }

    try {
        const stmt = db.prepare('INSERT INTO banners (imageUrl, title, subtitle) VALUES (?, ?, ?)');
        const info = stmt.run(imageUrl, title || null, subtitle || null);
        res.json({ success: true, id: info.lastInsertRowid, imageUrl, title, subtitle });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add banner' });
    }
});

// Delete a banner (Admin)
app.delete('/api/banners/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    try {
        // Fetch to get image URL before deleting
        const banner = db.prepare('SELECT imageUrl FROM banners WHERE id = ?').get(id);

        const deleteBanner = db.prepare('DELETE FROM banners WHERE id = ?');
        deleteBanner.run(id);

        // Delete physical file
        if (banner && banner.imageUrl && banner.imageUrl.includes('/uploads/')) {
            const filename = banner.imageUrl.split('/').pop();
            const filePath = path.join(__dirname, 'uploads', filename);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (e) {
                    console.error(`Failed to delete banner file: ${filePath}`, e);
                }
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete banner' });
    }
});

// --- SETTINGS API ---

// Get all settings (Public)
app.get('/api/settings', (req, res) => {
    try {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        res.json(settings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update a setting (Admin)
app.put('/api/settings', authenticateToken, (req, res) => {
    const settingsToUpdate = req.body;
    try {
        const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

        const updateAll = db.transaction((settings) => {
            for (const [key, value] of Object.entries(settings)) {
                updateStmt.run(key, value.toString());
            }
        });

        updateAll(settingsToUpdate);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// --- DEPLOYMENT CONFIGURATION ---
// Sanitize old absolute localhost URLs to relative URLs in DB
try {
    db.prepare(`UPDATE products SET imageUrl = REPLACE(imageUrl, 'http://localhost:3001', '') WHERE imageUrl LIKE 'http://localhost:3001%'`).run();
    db.prepare(`UPDATE products SET images = REPLACE(images, 'http://localhost:3001', '') WHERE images LIKE '%http://localhost:3001%'`).run();
    db.prepare(`UPDATE banners SET imageUrl = REPLACE(imageUrl, 'http://localhost:3001', '') WHERE imageUrl LIKE 'http://localhost:3001%'`).run();
} catch (e) { console.error('Sanitization error', e); }

// Serve the built Vite frontend statically
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));

    // Catch-all route to serve React's index.html for unknown routes (React Router support)
    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// Start Server
app.listen(port, () => {
    console.log(`API Server running at http://localhost:${port}`);
});

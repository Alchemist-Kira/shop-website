import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import webpush from 'web-push';
import compression from 'compression';
import helmet from 'helmet';
import db from './db.js';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logging utility for debugging
const logFile = path.join(__dirname, 'server-debug.log');
const isProduction = process.env.NODE_ENV === 'production';

const log = (message) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}\n`;
    console.log(entry.trim());
    if (!isProduction) {
        fs.appendFileSync(logFile, entry);
    }
};

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const rawAdminPassword = process.env.ADMIN_PASSWORD;

if (!JWT_SECRET || !ADMIN_USERNAME || !rawAdminPassword) {
    console.error("FATAL ERROR: Missing required environment variables (JWT_SECRET, ADMIN_USERNAME, or ADMIN_PASSWORD).");
    process.exit(1);
}

// Hash the password on startup if it's not already a bcrypt hash
const ADMIN_PASSWORD_HASH = rawAdminPassword.startsWith('$2a$')
    ? rawAdminPassword
    : bcrypt.hashSync(rawAdminPassword, 10);

const app = express();
const port = process.env.PORT || 3001; // Backend on 3001, Vite frontend on 5173

// Setup Web Push VAPID keys
let vapidPublicKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('vapidPublicKey')?.value;
let vapidPrivateKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('vapidPrivateKey')?.value;

if (!vapidPublicKey || !vapidPrivateKey) {
    const vapidKeys = webpush.generateVAPIDKeys();
    vapidPublicKey = vapidKeys.publicKey;
    vapidPrivateKey = vapidKeys.privateKey;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('vapidPublicKey', vapidPublicKey);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('vapidPrivateKey', vapidPrivateKey);
    console.log("Generated new VAPID keys for Web Push");
}
webpush.setVapidDetails('mailto:admin@shop-website.local', vapidPublicKey, vapidPrivateKey);

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

// Image Optimization Middleware
const processImages = async (req, res, next) => {
    log(`processImages middleware triggered. Method: ${req.method}, URL: ${req.url}`);
    try {
        if (!req.files && !req.file) {
            log('No files found in request');
            return next();
        }

        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Single file (Banners)
        if (req.file) {
            log(`Processing single image: ${req.file.originalname}`);
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = uniqueSuffix + '.webp';
            const outputPath = path.join(uploadDir, filename);

            await sharp(req.file.buffer)
                .webp({ quality: 80, effort: 4 })
                .resize({ width: 1920, withoutEnlargement: true })
                .toFile(outputPath);

            req.file.filename = filename;
            req.file.path = outputPath;
            log(`Successfully processed image: ${filename}`);
        }

        // Multiple files (Products)
        if (req.files && req.files.length > 0) {
            log(`Processing ${req.files.length} images`);
            await Promise.all(req.files.map(async (file) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = uniqueSuffix + '.webp';
                const outputPath = path.join(uploadDir, filename);

                await sharp(file.buffer)
                    .webp({ quality: 80, effort: 4 })
                    .resize({ width: 1200, withoutEnlargement: true })
                    .toFile(outputPath);

                file.filename = filename;
                file.path = outputPath;
            }));
            log(`Successfully processed all ${req.files.length} images`);
        }
        next();
    } catch (err) {
        log(`Image processing error details: ${err.message}`);
        return res.status(500).json({ error: 'Image processing failed', details: err.message });
    }
};

const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL]
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001'];

// Security Headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://www.google-analytics.com"],
            "connect-src": ["'self'", "https://www.google-analytics.com", "https://analytics.google.com", "https://stats.g.doubleclick.net"],
            "img-src": ["'self'", "blob:", "data:", "https://www.google-analytics.com", "https://www.googletagmanager.com"],
        },
    },
}));

// Bandwidth Optimization: GZIP compress all JSON API responses and text
app.use(compression());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Log all incoming requests for debugging
app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
        log(`Incoming ${req.method} request to ${req.url}`);
    }
    next();
});

// Bandwidth Optimization: Serve the uploads directory statically with maximum 1-year caching
// Since unique thumbnails never change names, browsers will never redownload them.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '1y' }));

// Simple Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        log(`Auth failed: No token provided for ${req.url}`);
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            log(`Auth failed: Invalid token for ${req.url}. Error: ${err.message}`);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Session expired. Please log in again.' });
            }
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// --- ROUTES ---

// Rate Limiter for Login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 login requests per windowMs
    message: { error: 'Too many login attempts, please try again after 15 minutes' }
});

// Rate Limiter for Orders
const orderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 orders per windowMs
    message: { error: 'Too many orders placed, please try again after 15 minutes' }
});

// --- WEB PUSH ROUTES ---

app.get('/api/push/vapid-publicKey', authenticateToken, (req, res) => {
    res.json({ publicKey: vapidPublicKey });
});

app.post('/api/push/subscribe', authenticateToken, express.json(), (req, res) => {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription object' });
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO admin_subscriptions (endpoint, p256dh, auth) 
            VALUES (?, ?, ?) 
            ON CONFLICT(endpoint) DO UPDATE SET 
            p256dh = excluded.p256dh, 
            auth = excluded.auth,
            createdAt = CURRENT_TIMESTAMP
        `);

        stmt.run(
            subscription.endpoint,
            subscription.keys.p256dh,
            subscription.keys.auth
        );
        res.status(201).json({ success: true });
    } catch (err) {
        console.error("Failed to save push subscription", err);
        res.status(500).json({ error: 'Failed to save subscription' });
    }
});

// Admin Login
app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME) {
        const passwordMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
        if (passwordMatch) {
            const token = jwt.sign({ username: ADMIN_USERNAME }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({ token });
        }
    }
    res.status(401).json({ error: 'Invalid username or password' });
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
    log(`POST /api/products reached. Body keys: ${Object.keys(req.body)}`);
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
    let productCategory = category || '';
    let productTags = tags || '[]';

    // Auto-add new category to settings if it doesn't exist
    try {
        if (productCategory && productCategory !== '') {
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

    let productCategory = category || '';
    let productTags = tags || '[]';

    // Auto-add new category to settings if it doesn't exist
    try {
        if (productCategory && productCategory !== '') {
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

        const deleteProduct = db.prepare('DELETE FROM products WHERE id = ?');

        const performDeletion = db.transaction(() => {
            // DO NOT delete order_items here, so order history & snapshots remain intact
            deleteProduct.run(id);
        });

        // Temporarily disable foreign key constraints to allow product deletion 
        // without cascading or throwing errors on existing historical order_items
        db.pragma('foreign_keys = OFF');
        performDeletion();
        db.pragma('foreign_keys = ON');

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

            // Deduplicate and delete safely
            const uniqueImages = [...new Set(allImages)];
            for (const imgUrl of uniqueImages) {
                if (imgUrl.includes('/uploads/')) {
                    // Safety Check: Is this exact image used by any OTHER product?
                    // We check both the main imageUrl and inside the JSON images array
                    const stillUsed = db.prepare(`
                        SELECT COUNT(*) as count 
                        FROM products 
                        WHERE id != ? 
                        AND (
                            imageUrl = ? 
                            OR EXISTS (SELECT 1 FROM json_each(images) WHERE value = ?)
                        )
                    `).get(parseInt(id, 10), imgUrl, imgUrl);

                    if (stillUsed.count === 0) {
                        const filename = imgUrl.split('/').pop();
                        // __dirname is already the 'server' folder, so we just append 'uploads'
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
app.post('/api/orders', orderLimiter, async (req, res) => {
    log(`Attempting to place order for customer: ${req.body.customerName}`);
    const { customerName, customerEmail, customerPhone, shippingArea, customerAddress, orderNote, totalAmount, items } = req.body;

    try {
        log(`Validating ${items ? items.length : 0} items`);
        // Calculate Expected Total Amount Securely
        let calculatedProductsTotal = 0;
        let processedItems = [];

        for (const item of items) {
            const targetId = item.productId || item.id;

            // Validate quantity
            const quantity = parseInt(item.quantity, 10);
            if (isNaN(quantity) || quantity <= 0) {
                return res.status(400).json({ error: `Invalid quantity for product ID: ${targetId}` });
            }

            const product = db.prepare('SELECT name, price, imageUrl FROM products WHERE id = ?').get(targetId);
            if (!product) {
                return res.status(404).json({ error: `Product not found: ${targetId}` });
            }

            calculatedProductsTotal += (product.price * quantity);

            let snapshotPath = null;

            if (product && product.imageUrl) {
                const snapshotDir = path.join(__dirname, 'uploads', 'snapshots');
                if (!fs.existsSync(snapshotDir)) {
                    fs.mkdirSync(snapshotDir, { recursive: true });
                }

                // Smart Snapshot Reuse: Map the snapshot name to the original product image name
                const originalImageName = product.imageUrl.split('/').pop();
                const filename = `snapshot_${targetId}_${originalImageName}`;
                const fullSnapshotPath = path.join(snapshotDir, filename);
                const originalPath = path.join(__dirname, product.imageUrl.replace(/^\//, ''));

                try {
                    // Check if this exact snapshot already exists to save disk space
                    if (fs.existsSync(fullSnapshotPath)) {
                        snapshotPath = `/uploads/snapshots/${filename}`;
                    } else if (fs.existsSync(originalPath)) {
                        // Create it if it doesn't exist, use buffer to prevent Windows Sharp file locks
                        const originalBuffer = fs.readFileSync(originalPath);
                        await sharp(originalBuffer)
                            .resize(80, 80, { fit: 'cover' })
                            .webp({ quality: 60 })
                            .toFile(fullSnapshotPath);
                        snapshotPath = `/uploads/snapshots/${filename}`;
                    }
                } catch (err) {
                    console.error("Failed to process snapshot", err);
                }
            }
            processedItems.push({
                ...item,
                targetId,
                quantity: quantity,
                price: product.price,
                productName_snapshot: product ? product.name : 'Unknown Product',
                productImage_snapshot: snapshotPath
            });
        }

        // Calculate shipping securely
        const settingsRow = db.prepare("SELECT key, value FROM settings WHERE key IN ('delivery_inside', 'delivery_outside')").all();
        const settings = {};
        settingsRow.forEach(r => { settings[r.key] = r.value; });

        let shippingCost = 0;
        const area = String(shippingArea).toLowerCase();
        if (area.includes('inside')) {
            shippingCost = parseFloat(settings['delivery_inside']) || 60;
        } else if (area.includes('outside')) {
            shippingCost = parseFloat(settings['delivery_outside']) || 120;
        }

        const expectedTotal = calculatedProductsTotal + shippingCost;

        const insertOrder = db.prepare('INSERT INTO orders (customerName, customerEmail, customerPhone, shippingArea, customerAddress, orderNote, totalAmount) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const insertItem = db.prepare('INSERT INTO order_items (orderId, productId, quantity, priceAtTime, selectedSize, selectedColor, productName_snapshot, productImage_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

        // Run in a transaction
        const placeOrder = db.transaction(() => {
            log(`Starting database transaction for orderId insertion`);
            // Ensure customerEmail is provided or default to '' (DB has NOT NULL constraint)
            const resolvedEmail = customerEmail || '';
            const info = insertOrder.run(customerName, resolvedEmail, customerPhone || null, shippingArea || null, customerAddress, orderNote || null, expectedTotal);
            const orderId = info.lastInsertRowid;
            log(`Order inserted with ID: ${orderId}. Now inserting ${processedItems.length} items.`);

            const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

            for (const item of processedItems) {
                try {
                    insertItem.run(orderId, item.targetId, item.quantity, item.price, item.selectedSize || null, item.selectedColor || null, item.productName_snapshot, item.productImage_snapshot);

                    // Update stock
                    updateStock.run(item.quantity, item.targetId);
                } catch (itemErr) {
                    log(`Warning: Failed to insert order item for product ${item.targetId}: ${itemErr.message}`);
                    // Continue with other items
                }
            }
            log(`Transaction completed successfully for orderId: ${orderId}`);
            return orderId;
        });

        const orderId = placeOrder();
        log(`Order placed successfully. ID: ${orderId}`);

        // Broadcast the new order to connected Admin panels
        try {
            const newOrderRaw = db.prepare(`
                SELECT o.*, 
                       json_group_array(json_object('productId', oi.productId, 'quantity', oi.quantity, 'price', oi.priceAtTime, 'selectedSize', oi.selectedSize, 'selectedColor', oi.selectedColor, 'name', COALESCE(p.name, oi.productName_snapshot), 'imageUrl', COALESCE(p.imageUrl, oi.productImage_snapshot))) as items
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

                // --- WEB PUSH BROADCAST ---
                const pushPayload = JSON.stringify({
                    title: 'New Order!',
                    body: `Received an order from ${customerName} for ${totalAmount} Tk`,
                    url: '/login',
                    icon: '/src/assets/icon.png'
                });

                const subs = db.prepare('SELECT * FROM admin_subscriptions').all();
                const dropSub = db.prepare('DELETE FROM admin_subscriptions WHERE endpoint = ?');

                subs.forEach(sub => {
                    const pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth }
                    };

                    webpush.sendNotification(pushSubscription, pushPayload)
                        .catch(err => {
                            if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 400) {
                                // Subscription has expired or is invalid
                                dropSub.run(sub.endpoint);
                            } else {
                                console.error('Error sending push notification:', err);
                            }
                        });
                });
            }
        } catch (err) {
            console.error('Failed to broadcast new order via SSE:', err);
        }

        res.json({ success: true, orderId });
    } catch (err) {
        log(`ERROR during order placement: ${err.message}`);
        if (err.stack) log(err.stack);
        console.error(err);
        res.status(500).json({ error: 'Failed to place order', details: err.message });
    }
});

// Get all orders (Admin)
app.get('/api/orders', authenticateToken, (req, res) => {
    try {
        const orders = db.prepare(`
      SELECT o.*, 
             json_group_array(json_object('productId', oi.productId, 'quantity', oi.quantity, 'price', oi.priceAtTime, 'selectedSize', oi.selectedSize, 'selectedColor', oi.selectedColor, 'name', COALESCE(p.name, oi.productName_snapshot), 'imageUrl', COALESCE(p.imageUrl, oi.productImage_snapshot))) as items
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
        const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const performUpdate = db.transaction(() => {
            const stmt = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
            stmt.run(status, id);

            // Restock if moving to 'cancelled' from a non-cancelled state
            if (status === 'cancelled' && order.status !== 'cancelled') {
                const items = db.prepare('SELECT productId, quantity FROM order_items WHERE orderId = ?').all(id);
                const updateStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
                for (const item of items) {
                    updateStock.run(item.quantity, item.productId);
                }
            }
            // Deduct stock if un-cancelling
            else if (order.status === 'cancelled' && status !== 'cancelled') {
                const items = db.prepare('SELECT productId, quantity FROM order_items WHERE orderId = ?').all(id);
                const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
                for (const item of items) {
                    updateStock.run(item.quantity, item.productId);
                }
            }
        });

        performUpdate();
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

        const itemsToDelete = db.prepare('SELECT productImage_snapshot FROM order_items WHERE orderId = ?').all(id);

        const performDeletion = db.transaction(() => {
            db.prepare('DELETE FROM order_items WHERE orderId = ?').run(id);
            db.prepare('DELETE FROM orders WHERE id = ?').run(id);
        });

        performDeletion();

        // Cleanup orphaned snapshots
        for (const item of itemsToDelete) {
            if (item.productImage_snapshot) {
                const stillUsed = db.prepare('SELECT COUNT(*) as count FROM order_items WHERE productImage_snapshot = ?').get(item.productImage_snapshot);
                if (stillUsed.count === 0) {
                    const filePath = path.join(__dirname, item.productImage_snapshot.replace(/^\//, ''));
                    if (fs.existsSync(filePath)) {
                        try { fs.unlinkSync(filePath); } catch (e) { }
                    }
                }
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

// Clear all non-pending orders (Admin)
app.delete('/api/orders', authenticateToken, (req, res) => {
    try {
        // 1. First, gather all snapshots that are about to be orphaned
        const itemsToDelete = db.prepare(`
            SELECT productImage_snapshot 
            FROM order_items 
            WHERE orderId IN (SELECT id FROM orders WHERE status != 'pending')
        `).all();

        // 2. Perform the database deletion
        const performDeletion = db.transaction(() => {
            db.prepare(`
                DELETE FROM order_items 
                WHERE orderId IN (SELECT id FROM orders WHERE status != 'pending')
            `).run();
            db.prepare("DELETE FROM orders WHERE status != 'pending'").run();
        });

        performDeletion();

        // 3. Cleanup physical snapshot files
        for (const item of itemsToDelete) {
            if (item.productImage_snapshot) {
                // Check if any other surviving orders still use this exact snapshot
                const stillUsed = db.prepare('SELECT COUNT(*) as count FROM order_items WHERE productImage_snapshot = ?').get(item.productImage_snapshot);
                if (stillUsed.count === 0) {
                    const filePath = path.join(__dirname, item.productImage_snapshot.replace(/^\//, ''));
                    if (fs.existsSync(filePath)) {
                        try { fs.unlinkSync(filePath); } catch (e) { }
                    }
                }
            }
        }

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
    log(`POST /api/banners reached. Body keys: ${Object.keys(req.body)}`);
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

// --- BACKUP API ---

app.get('/api/admin/download-backup', authenticateToken, (req, res) => {
    try {
        log(`Admin ${req.user.username} requested a data backup`);

        const zip = new AdmZip();

        // Add Database
        const dbPath = path.join(__dirname, 'shop.db');
        if (fs.existsSync(dbPath)) {
            // Using readFileSync instead of addLocalFile directly to avoid potential file locks on some systems
            // though with SQLite better-sqlite3 usually handles its own locks.
            zip.addFile('shop.db', fs.readFileSync(dbPath));
            log('Added shop.db to backup zip');
        } else {
            log('Warning: shop.db not found for backup');
        }

        // Add Uploads directory
        const uploadsPath = path.join(__dirname, 'uploads');
        if (fs.existsSync(uploadsPath)) {
            zip.addLocalFolder(uploadsPath, 'uploads');
            log('Added uploads directory to backup zip');
        } else {
            log('Warning: uploads directory not found for backup');
        }

        const zipBuffer = zip.toBuffer();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `shop_backup_${timestamp}.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Length', zipBuffer.length);

        res.send(zipBuffer);
        log(`Backup ${filename} sent successfully`);
    } catch (err) {
        console.error('Backup failed:', err);
        log(`Backup failed: ${err.message}`);
        res.status(500).json({ error: 'Failed to generate backup', details: err.message });
    }
});

// --- SETTINGS API ---

// Get all settings (Public)
app.get('/api/settings', (req, res) => {
    try {
        // SECURITY: Explictly exclude vapidPrivateKey from public responses
        const rows = db.prepare("SELECT key, value FROM settings WHERE key != 'vapidPrivateKey'").all();
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

// Global Error Handler
app.use((err, req, res, next) => {
    log(`GLOBAL ERROR: ${err.message}`);
    if (err instanceof multer.MulterError) {
        log(`Multer error: ${err.code} - ${err.field}`);
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start Server
app.listen(port, () => {
    log(`API Server started on port ${port}`);
    log(`Environment: ADMIN_USERNAME=${ADMIN_USERNAME}`);
});

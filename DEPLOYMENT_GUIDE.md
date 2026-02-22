# Deployment Guide: Marbilo Shop

This guide explains how to take your project from your local computer to the live web.

## ⚠️ Important: The "SQLite Change"
Your website currently uses **SQLite** (`shop.db`), which is a file-based database. 

*   **The Issue with Vercel**: Vercel is "Serverless." Every time you upload code or the site restarts, it wipes the files. This means your products and orders would disappear every time you deploy.
*   **The Solution**: For this specific project, I highly recommend using **Render.com** or **Railway.app** instead of Vercel. They allow you to attach a "Persistent Disk" so your database (`shop.db`) stays safe forever.

---

## 🏗️ Deployment on Traditional Hosting (ExonHost / BD Providers)

Unlike Vercel, traditional hosting (Shared or VPS) usually has **Persistent Storage** by default. Your files stay there unless you delete them.

### To prevent data loss on every deploy:

1.  **NEVER upload your local `shop.db` file**: 
    Your local `shop.db` is empty or has test data. The server's `shop.db` contains your real orders. If you upload your local one, you will overwrite (delete) all your real orders.
2.  **Use `.gitignore`**: 
    Ensure `shop.db` is in your `.gitignore` file. This way, if you deploy via GitHub, the database file will never be part of the upload. The server will create its own `shop.db` the first time it runs and keep it forever.
3.  **Deploying via File Manager/FTP**:
    If you manually drag and drop files to your hosting, **Skip** the `shop.db` file. Leave the one on the server alone.
4.  **Backend Uploads Folder**:
    Similarly, never delete the `server/uploads` folder on the server. That's where your live product images are stored.

---

## ☁️ Deployment on Cloud Platforms (Render / Railway)

## ⚡ alternative: Deployment on Vercel

If you absolutely must use Vercel, you have to change how the database works:

1.  **Frontend**: Vercel will auto-detect your Vite app and deploy the frontend perfectly.
2.  **Backend**: You must add a `vercel.json` file to route `/api` calls to your server.
3.  **Database**: You **CANNOT** use `shop.db` on Vercel. You would need to migrate to a cloud database like **MongoDB Atlas** or **Supabase (PostgreSQL)**.

### Example `vercel.json` (for root directory):
```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/server/index.js" },
    { "source": "/uploads/(.*)", "destination": "/server/uploads/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## ✅ Best Choice for Marbilo
Because you have a finished, working SQLite system, **Render.com** is your best bet to go live in 5 minutes without rewriting any code.

*Documentation maintained by Antigravity AI.*

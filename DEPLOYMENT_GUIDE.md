# Deployment Guide: Marbilo Shop

This guide explains how to take your project from your local computer to the live web.

## ⚠️ Important: The "SQLite Change"
Your website currently uses **SQLite** (`shop.db`), which is a file-based database. 

*   **The Issue with Vercel**: Vercel is "Serverless." Every time you upload code or the site restarts, it wipes the files. This means your products and orders would disappear every time you deploy.
*   **The Solution**: For this specific project, I highly recommend using **Render.com** or **Railway.app** instead of Vercel. They allow you to attach a "Persistent Disk" so your database (`shop.db`) stays safe forever.

---

## 🏗️ Recommended: Deployment on Render.com

Render is the easiest "drop-in" solution for your React + Express + SQLite setup.

### 1. Prepare your code
Ensure your `.env` file is NOT uploaded to GitHub (it should be in `.gitignore`). You will add these variables manually in the Render dashboard.

### 2. Create a Web Service on Render
1.  Connect your GitHub repository to Render.
2.  Select **Web Service**.
3.  Set the following:
    *   **Build Command**: `npm install && npm run build`
    *   **Start Command**: `node server/index.js`
4.  In the **Environment** tab, add your variables from `.env`:
    *   `JWT_SECRET`
    *   `ADMIN_USERNAME`
    *   `ADMIN_PASSWORD`
    *   `PORT=10000` (Render uses 10000 by default)

### 3. Add a Persistent Disk (CRITICAL)
To keep your data safe:
1.  Go to the **Advanced** section in Render.
2.  Add a **Disk**.
3.  Set **Mount Path** to `/var/data`.
4.  Update your `server/db.js` to point to `/var/data/shop.db` instead of just `shop.db`.

---

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

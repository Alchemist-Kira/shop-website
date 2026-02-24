# Marbilo Technical Documentation

This document provides a comprehensive technical overview of the **Marbilo Luxury Panjabi** e-commerce platform. It is intended for developers who wish to maintain, modify, or extend the application.

---

## Tech Stack

- **Frontend**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Backend**: [Node.js](https://nodejs.org/) + [Express 5](https://expressjs.com/)
- **Database**: [SQLite](https://www.sqlite.org/) (via `better-sqlite3`)
- **Router**: [React Router 7](https://reactrouter.com/)
- **Styling**: Vanilla CSS (Custom Design System)

---

## Project Structure

```text
├── /server                 # Backend API & Database
│   ├── index.js            # Main Express server & API routes
│   ├── db.js               # SQLite Database initialization & schema
│   └── /uploads            # Directory for uploaded product/banner images
├── /src                    # Frontend Code
│   ├── /admin              # Admin Dashboard components & views
│   ├── /pages              # Public facing pages (Home, Store, Product)
│   ├── /components         # Global UI components
│   ├── /assets             # Static assets (fonts, sounds, placeholder images)
│   ├── App.jsx             # Main App router & Global layout (Nav/Footer)
│   └── index.css           # Global styles and design system tokens
├── shop.db                 # SQLite Database file
├── .env                    # Environment variables (Authentication & Port)
└── package.json            # Scripts & Dependencies
```

---

## Setup & Installation

### Prerequisites
- Node.js (v18+)
- npm

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory (see **Environment Configuration** below).
4. Run the development server (runs both frontend and backend concurrently):
   ```bash
   npm run dev
   ```

---

## Environment Configuration (.env)

The root `.env` file manages critical security and server settings.

```env
PORT=3001
JWT_SECRET=your-random-secret-key-here
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
```

| Variable | Description |
| :--- | :--- |
| `PORT` | The port the backend server runs on (default: 3001). |
| `JWT_SECRET` | Used to sign and verify Admin login tokens. |
| `ADMIN_USERNAME` | Login username for the Admin Panel. |
| `ADMIN_PASSWORD` | Login password for the Admin Panel. |

---

## Database Schema

The application uses SQLite for persistent storage. The schema is defined in `[server/db.js](file:///d:/CP/Software/shop%20website/shop-website/server/db.js)`.

### Key Tables
- **`products`**: Stores product details (name, price, stock, categories, tags, multiples images).
- **`orders`**: Stores customer order info (name, phone, address, total, status, COD info).
- **`order_items`**: Junction table linking orders to specific products with variant details.
- **`banners`**: Manages hero section imagery and titles.
- **`settings`**: Key-value pairs for site configuration (e.g., delivery charges).

---

## Design System

The project uses a custom Vanilla CSS design system located in `[src/index.css](file:///d:/CP/Software/shop%20website/shop-website/src/index.css)`.

### Fluid Typography
We use CSS `clamp()` for typography to ensure text scales seamlessly from mobile to desktop without media query clutter:
```css
--font-size-hero: clamp(2.5rem, 2rem + 4vw, 4rem);
--font-size-xxl: clamp(1.75rem, 1.5rem + 2vw, 2.5rem);
```

---

## Key Features & Implementation Details

### Admin Dashboard
- **Authentication**: JWT-based session management.
- **Order Management**: Real-time order tracking, status updates, and a printable PDF receipt system.
- **Notification**: Service Worker + Notification API integrated for background order alerts.

### Order Flow
- **Validation**: Strict Bangladesh phone number validation in `[OrderPage.jsx](file:///d:/CP/Software/shop%20website/shop-website/src/pages/OrderPage.jsx)` using Regex.
- **COD**: Optimized for Cash on Delivery with clear "Total Due" and "Payment: COD" labels on receipts.
- **Stock Management**: Inventory automatically deducts on order placement, and automatically restores if an admin cancels the order from the dashboard.

### Media & UI Management
- Handled via `multer`. Images are stored in `/server/uploads` and served statically.
- **Zoom Interactions**: Mobile product images use `react-zoom-pan-pinch` for native-feeling pinch-to-zoom, double-tap, and pan functionality within a lightbox overlay. Native browser pinch-zoom is disabled on the viewport.

---

## How to Contribute / Extend
1. **Adding a Page**: Create a new component in `/src/pages` and add the route in `App.jsx`.
2. **Changing Styles**: Always use the CSS variables defined in `:root` of `index.css` to maintain brand consistency.
3. **API Changes**: Modify `server/index.js` and use the `authenticateToken` middleware for any route that should be restricted to admins.

---

## Deployment

For full details on how to take the site live, refer to the:  
**[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**

### Quick Recommendation
- Use **Render.com** for easiest setup with SQLite (Persistent Disk).
- Avoid **Vercel** unless you plan to migrate to a cloud database (PostgreSQL/MongoDB).

---

*Documentation maintained by Antigravity AI.*

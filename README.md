# 🐝 BrandHive — Egypt's Local Brand Marketplace

> A Smart Digital Marketplace for Egyptian Local Brands — Graduation Project 2026

[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)
[![React](https://img.shields.io/badge/Frontend-React_18-blue)](https://reactjs.org)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-green)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-green)](https://mongodb.com)

## 🚀 Live Demo

🌐 **Frontend**: [brandhive.vercel.app](https://brandhive.vercel.app)  
🔧 **API**: Deployed on Railway/Render

## 📸 Features

- 🏪 **Brand Bazaars** — Every brand has its own mini-storefront
- 🔍 **Smart Search & Filtering** — Filter by governorate, price, rating, category
- 🛒 **Full Cart & Checkout** — With promo codes and multiple payment methods
- 💬 **Support Chat** — Real-time messaging with brands and support
- 📊 **Dashboards** — Customer, Seller, and Admin dashboards
- 🤖 **AI Recommendations** — Personalized product suggestions
- ✅ **Verified Sellers** — Manual brand verification system
- 🇪🇬 **Gen Z Egyptian Identity** — Local & Proud section
- 📱 **Fully Responsive** — Mobile, tablet, desktop

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Icons | Lucide React |
| Routing | React Router v6 |
| State | Context API |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcrypt |
| Deployment | Vercel (frontend) + Railway (backend) |

## 🎭 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| 👤 Customer | nadia@example.com | password123 |
| 🏪 Seller | ahmed@luxorcrafts.com | password123 |
| ⚙️ Admin | admin@brandhive.com | admin123 |

## 📁 Project Structure

```
BrandHive/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Navbar, Footer, ProductCard, BrandCard, OtpInput
│   │   ├── context/        # AuthContext, CartContext, WishlistContext
│   │   ├── data/           # Mock data (products, brands, categories)
│   │   ├── pages/          # All page components
│   │   │   └── dashboards/ # User, Seller, Admin dashboards
│   │   └── utils/          # Helper functions
│   └── vercel.json         # Vercel routing config
│
├── server/                 # Node.js Backend
│   ├── models/             # MongoDB schemas (User, Brand, Product, Order)
│   ├── routes/             # API routes (auth, brands, products, orders)
│   ├── middleware/         # JWT auth middleware
│   └── server.js           # Express app entry
│
└── README.md
```

## ⚡ Quick Start

### Frontend Only (No backend needed for demo)

```bash
cd client
npm install
npm run dev
# Visit http://localhost:5173
```

### Full Stack

```bash
# Terminal 1 - Backend
cd server
npm install
npm run dev   # Runs on http://localhost:5000

# Terminal 2 - Frontend
cd client
npm install
npm run dev   # Runs on http://localhost:5173
```

### Environment Variables (server/.env)

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/brandhive
JWT_SECRET=your_secret_key_here
CLIENT_URL=http://localhost:5173
```

## 🚀 Deploy to Vercel

1. Push code to GitHub
2. Connect GitHub repo to Vercel
3. Set **Root Directory** to `client`
4. Set **Build Command** to `npm run build`
5. Set **Output Directory** to `dist`
6. Deploy!

## 📄 Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Landing with hero, categories, trending |
| Explore | `/explore` | Browse all brands with filters |
| Brand Bazaar | `/brand/:slug` | Brand storefront |
| Products | `/products` | Product listing with filters |
| Product | `/product/:slug` | Product details |
| Cart | `/cart` | Cart + checkout flow |
| Login | `/login` | Authentication |
| Register | `/register` | Sign up |
| Verify | `/verify` | Email OTP verification after registration |
| Forgot Password | `/forgot-password` | Request a password reset code |
| Reset Password | `/reset-password` | Enter code and set new password |
| Sell | `/sell` | Seller registration |
| Account | `/account` | Customer dashboard |
| Seller | `/seller/dashboard` | Seller analytics |
| Admin | `/admin/dashboard` | Admin console |
| Chat | `/chat` | Support chat |

## 👤 User Roles

| Role | How Assigned | Notes |
|------|-------------|-------|
| `customer` | Default on registration | All new accounts start here — no role selection at sign-up |
| `seller` | Auto-upgraded after brand creation | `upgradeToSeller()` in `AuthContext` fires on successful brand submission |
| `admin` | Manually assigned in DB | Full platform management access |

> Role selection was removed from the registration page. Users who want to sell complete the **Seller Registration** flow (`/sell`) which automatically promotes them to `seller` upon submission.

## 🔌 API Integration

Base URL: `https://brandhive-apis-production.up.railway.app`

### Auth Endpoints (`authAPI`)

| Function | Method | Endpoint | Body |
|----------|--------|----------|------|
| `register` | POST | `/auth/register` | `{ name, email, password }` |
| `login` | POST | `/auth/login` | `{ email, password }` |
| `getMe` | GET | `/auth/me` | — (JWT required) |
| `verifyAccount` | POST | `/auth/confirm-email` | `{ email, otp }` |
| `resendOtp` | POST | `/auth/resend-otp` | `{ email }` |
| `forgotPassword` | POST | `/auth/forgot-password` | `{ email }` |
| `resetPassword` | POST | `/auth/reset-password` | `{ email, code, newPassword }` |
| `resendResetCode` | POST | `/auth/resend-otp` | `{ email }` |

## 🧩 Key Reusable Components

| Component | Path | Props | Notes |
|-----------|------|-------|-------|
| `OtpInput` | `src/components/OtpInput.jsx` | `value`, `onChange`, `error`, `disabled` | 6-digit OTP with auto-advance, backspace, paste support. Used in `VerifyPage` and `ResetPasswordPage`. |


## 🎨 Design System

- **Primary**: `#1A2040` (Deep Navy)
- **Gold**: `#C8922A` (Pharaonic Gold)
- **Gen Z Gradient**: Purple → Pink → Orange
- **Background**: `#FAF8F4` (Warm White)
- **Fonts**: Playfair Display (headings) + Inter (body)

## 👥 Team

- Graduation Project — Egypt 2026
- University: [University Name]
- Department: [Department Name]

---
🇪🇬 **Made in Egypt** · BrandHive Inc. © 2025

## 📝 Change Log

| Date | Change |
|------|--------|
| 2026-05-13 | Fixed login redirect bug — initAuth now only clears session on 401, not on 404 or network errors |
| 2026-05-04 | Fixed forgot/reset password endpoint URLs to match actual backend routes: `/auth/forget-password` and `/auth/verify-account` |
| 2026-05-04 | Temporarily mapped `forgotPassword` to `/auth/resend-otp` pending backend implementation of `/auth/forget-password`; added friendly 404/"Cannot POST" error message in `ForgotPasswordPage` |
| 2026-05-04 | Added `ForgotPasswordPage` (`/forgot-password`) and `ResetPasswordPage` (`/reset-password`) with full OTP + password reset flow |
| 2026-05-04 | Extracted `OtpInput` as reusable component (`src/components/OtpInput.jsx`); updated `VerifyPage` to use it |
| 2026-05-04 | Added `forgotPassword`, `resetPassword`, `resendResetCode` to `authAPI` in `api.js` |
| 2026-05-04 | Added "Forgot Password?" link to `LoginPage` password field |
| 2026-04-26 | Removed role selection (Buyer/Seller toggle) from `RegisterPage.jsx`; all new users default to `customer` |
| 2026-04-26 | Added `upgradeToSeller()` to `AuthContext` — updates in-memory state and localStorage in real time |
| 2026-04-26 | `SellerRegistration.jsx` now calls `upgradeToSeller()` on brand submission instead of manually patching the user object |
| 2026-05-19 | Fixed `SettingsPanel` dark mode toggle overflow bug — removed isRTL conditional on translate-x, anchored knob at left-0.5, added flex-shrink-0 |
| 2026-05-19 | Fixed language flags in `SettingsPanel` — replaced unreliable emoji flags with styled JSX divs (EN / ع badges) and added sublabel row |
| 2026-05-19 | Removed dark mode toggle (Moon/Sun button) from `Navbar` — theme now controlled exclusively via `SettingsPanel` |
| 2026-05-19 | Removed EN/AR language toggle from `Navbar` mobile menu — language now controlled exclusively via `SettingsPanel` |
| 2026-05-19 | Fixed `/review` endpoint to `/reviews` in `api.js` `reviewsAPI` |
| 2026-05-19 | Added missing `sellerAPI` and `adminAPI` endpoints in `api.js` for full dashboard functionality |
| 2026-05-19 | Replaced "Coming Soon" placeholders in `SellerDashboard` with functional components (`SellerOrdersTab`, `SellerRevenueTab`, `SellerReviewsTab`, `SellerBazaarTab`, `SellerProductsTab`) |
| 2026-05-19 | Replaced "Coming Soon" placeholders in `AdminDashboard` with functional components (`AdminUsersTab`, `AdminOrdersTab`, `AdminProductsTab`) |
| 2026-05-19 | Replaced "Coming Soon" placeholder in `UserDashboard` with `NotificationsTab` and updated Payment tab UI |
| 2026-05-28 | Fixed crash in `UserDashboard` Wishlist tab caused by undefined `item.price` — added defensive fallbacks for price (`item.price || item.salePrice || item.discountPrice || 0`), brandName (`item.brandName || item.brand?.name || ''`), and slug (`item.slug || item._id || item.id`) |
| 2026-05-28 | Fixed potential undefined crashes in Orders tab amount calculations — wrapped `order.totalAmount || order.total || order.amount || 0` with `Number()` in both the Dashboard overview table and the full Orders tab table |
| 2026-05-28 | Fixed order detail modal item price display to fall back to `item.salePrice` when `item.price` is undefined |
| 2026-05-28 | Added `/seller/products/add` protected route in `App.jsx` — requires `seller` role, renders `AddProductPage` inside `Layout` |
| 2026-05-28 | Fixed Bazaar navbar link in `Navbar.jsx` — changed path from `/brands` to `/bazaar` |
| 2026-05-28 | Created `BazaarPage.jsx` placeholder at `/bazaar` — displays store icon, heading, and link to `/brands` |

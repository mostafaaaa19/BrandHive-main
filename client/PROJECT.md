# BrandHive — Project Knowledge Base

## Overview
BrandHive is an Egyptian e-commerce platform and marketplace. The tagline is "Egypt's #1 Local Marketplace". It connects local Egyptian brands/sellers with buyers, and also features international brands available in Egypt. The platform supports 27 governorates and charges sellers only 5% commission with no monthly fees.

## Tech Stack
- **Frontend:** React 19, Vite 8
- **Routing:** React Router DOM v7
- **Styling:** Tailwind CSS v3 with custom design system
- **Animations:** Framer Motion v12
- **UI Components:** Headless UI v2, Lucide React icons
- **HTTP Client:** Axios
- **Charts:** Recharts
- **Notifications:** React Hot Toast
- **Scroll detection:** React Intersection Observer
- **Build tool:** Vite

## Design System (tailwind.config.js)
### Colors
- `brand-navy`: #1A2040 (primary dark background)
- `brand-gold`: #C8922A (primary accent)
- `brand-gold-light`: #E8B84B
- `brand-gold-pale`: #FDF3DC
- `brand-cream`: #FAF8F4 (light background)
- `brand-dark`: #0F172A
- `genz-purple`: #7C3AED
- `genz-pink`: #EC4899
- `genz-cyan`: #06B6D4
- `genz-lime`: #84CC16

### Typography
- `font-display`: Playfair Display (headings)
- `font-body`: Inter (body text)
- `font-grotesk`: Space Grotesk

### Custom Animations
fade-in, slide-up, slide-in-right, float, shimmer, bounce-slow, pulse-slow, marquee

### Custom Shadows
card, card-hover, gold, genz

### Custom Gradients
gold-gradient, genz-gradient, hero-pattern

## Project Structure
src/
├── components/
│   ├── Navbar.jsx
│   ├── Footer.jsx
│   ├── ProductCard.jsx
│   └── BrandCard.jsx
├── context/
│   ├── AuthContext.jsx       # Auth state: user, login, logout, updateUser, role checks
│   └── CartContext.jsx       # Cart + Wishlist state (synced with API for logged-in users)
├── pages/
│   ├── HomePage.jsx
│   ├── ExploreBrands.jsx
│   ├── BrandPage.jsx
│   ├── ListingPage.jsx
│   ├── ProductPage.jsx
│   ├── CartPage.jsx
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── SellerRegistration.jsx
│   ├── SupportChat.jsx       # AI-powered support chat feature
│   └── dashboards/
│       ├── UserDashboard.jsx
│       ├── SellerDashboard.jsx
│       └── AdminDashboard.jsx
├── data/
│   └── mockData.js           # products, brands, categories, globalBrands, testimonials
└── App.jsx

## Routing & Access Control
| Path | Page | Access |
|------|------|--------|
| / | HomePage | Public |
| /explore or /brands | ExploreBrands | Public |
| /brand/:slug | BrandPage | Public |
| /products | ListingPage | Public |
| /product/:slug | ProductPage | Public |
| /cart | CartPage | Public |
| /global | ListingPage | Public |
| /chat | SupportChat | Public |
| /login | LoginPage | Public (no Navbar/Footer) |
| /register | RegisterPage | Public (no Navbar/Footer) |
| /forgot-password | ForgotPasswordPage | Public (no Navbar/Footer) |
| /verify-reset | VerifyResetPage | Public (no Navbar/Footer) |
| /reset-password | ResetPasswordPage | Public (no Navbar/Footer) |
| /verify | VerifyPage | Public (no Navbar/Footer) |
| /sell | SellerRegistration | Public |
| /account | UserDashboard | Protected (any logged-in user) |
| /seller/pending | SellerPendingPage | Protected (any logged-in user) |
| /seller/dashboard | SellerDashboard | Protected (role: seller) |
| /admin/dashboard | AdminDashboard | Protected (role: admin) |

## User Roles
- **customer** — can browse, buy, manage wishlist/cart
- **seller** — has seller dashboard, can manage products/orders
- **admin** — has admin dashboard, full platform access

## Auth System
- Stored in localStorage under key `brandhive_user`
- Cart stored under `brandhive_cart`
- Wishlist stored under `brandhive_wishlist` (synced with API when logged in)
- CartContext exposes: items, addToCart, removeFromCart, updateQuantity, clearCart, total, subtotal, itemCount, fetchCart
- WishlistContext exposes: items, toggleWishlist, isInWishlist, itemCount, moveToCart, clearWishlist, fetchWishlist, loading

## AI Features
- **SupportChat** — AI-powered customer support chat (/chat)
- **Product Recommendations** — AI-driven product suggestions
- **AI-powered Reviews** — mentioned in features section: "AI-powered reviews and ratings ensure only the best products shine"

## HomePage Sections (in order)
1. Hero — brand-navy background, headline "Discover Egypt's Finest", CTA buttons (Shop Now / Start Selling), animated product showcase cards, stats (12K+ Brands, 280K Products, 27 Governorates, 500K+ Buyers)
2. Features Strip — 4 features: Verified Sellers, Fast Delivery, Support Local, Best Quality
3. Featured Products — tabbed (Popular / New / Featured), shows up to 8 products using ProductCard
4. Gen Z Section — purple/pink gradient, "Local & Proud. Egyptian by Heart." with hashtags
5. Top Brands — 4 brand cards using BrandCard
6. Global Brands — grid of international brand logos
7. Testimonials — 3 community reviews
8. Sell on BrandHive CTA — navy background, seller pitch

## Key Reusable Components
- `<ProductCard />` — used in ListingPage, HomePage
- `<BrandCard />` — used in ExploreBrands, HomePage
- `<Layout />` — wraps Navbar + main + Footer (noFooter prop available)
- `<ProtectedRoute />` — redirects to /login if not authenticated, checks role
- `Order Tracking Modal` — built into `UserDashboard.jsx` to show real-time order status timeline, shipping info, items, and order cancellation.

## localStorage Keys
- `brandhive_user`
- `brandhive_cart`
- `brandhive_wishlist`

## Notes & Conventions
- Currency is EGP (Egyptian Pounds)
- Egyptian market focus — 27 governorates
- Brand identity: navy + gold color scheme, bee theme (🐝), Playfair Display for headings
- 404 page uses 🐝 emoji
- Custom CSS classes used throughout: `btn-primary`, `btn-gold`, `btn-outline`, `btn-ghost`, `card`, `page-container`, `section-heading`, `text-gradient-gold`, `text-gradient-genz`, `bg-pattern`
- Data is currently mock (mockData.js) for brands/products — auth is now wired to the real API
- Brand/product pages still use mockData.js intentionally — the backend returns empty for those endpoints
- [Connected] Products and Brands now use real API data via `src/utils/mappers.js`

## Data Mappers
To ensure consistency between backend responses and frontend UI, we use mappers in `src/utils/mappers.js`:

### Product Mapper (`mapProduct`)
- `id`: `p.id` or `p._id`
- `price`: `p.finalPrice`
- `originalPrice`: `p.price` (if discounted)
- `image`: `p.mainImage`
- `brandName`: `p.brand.name`
- `governorate`: `p.brand.governorate`

### Brand Mapper (`mapBrand`)
- `id`: `b.id` or `b._id`
- `logo`: `b.logo.url`
- `coverImage`: `b.coverImage.url`
- `productCount`: `b.stats.totalProducts`
- `followers`: `b.stats.followers`

## API Integration

### Base URL
`https://brandhive-apis-production.up.railway.app`

### Service Files
| File | Purpose |
|------|---------|
| `src/services/api.js` | Axios instance, request/response interceptors, all API service objects |
| `src/services/index.js` | Re-exports everything from api.js for clean imports |

### Endpoint Status
| Endpoint | Status | Used In |
|----------|--------|---------|
| `POST /auth/register` | ✅ Live | RegisterPage via AuthContext |
| `POST /auth/login` | ✅ Live | LoginPage via AuthContext |
| `GET /auth/me` | ✅ Live | AuthContext (token validation on mount) |
| `POST /auth/verify-account` | ✅ Live | VerifyPage (verifyAccount) |
| `POST /auth/resend-otp` | ✅ Live | VerifyPage (resendOtp) |
| `GET /orders/my-orders` | ✅ Live | ordersAPI (getAll) |
| `GET /orders/my-orders/:id` | ✅ Live | ordersAPI (getMyOrder) |
| `POST /orders/my-orders/:id/cancel` | ✅ Live | ordersAPI (cancelOrder) |
| `GET /users/profile` | ✅ Live | usersAPI (ready to use) |
| `PUT /users/profile` | ✅ Live | usersAPI (ready to use) |
| `GET /brand` | ✅ Live | brandsAPI declared and used in ExploreBrands/HomePage |
| `GET /brand/:slug` | ✅ Live | brandsAPI declared and used in pages |
| `GET /product` | ✅ Live | productsAPI declared and used in ListingPage/HomePage |
| `GET /category` | ✅ Live | categoriesAPI (ready to use) |
| `POST /auth/forget-password` | ✅ Live | ForgotPasswordPage (forgotPassword) |
| `POST /auth/verify-reset-code` | ✅ Live | VerifyResetPage (verifyResetCode) |
| `PATCH /auth/reset-password` | ✅ Live | ResetPasswordPage (resetPassword) |
| `POST /wishlist` | ✅ Live | WishlistProvider (toggleWishlist) |
| `GET /wishlist` | ✅ Live | WishlistProvider (fetchWishlist) |
| `DELETE /wishlist/:id` | ✅ Live | WishlistProvider (toggleWishlist) |
| `POST /wishlist/move-to-cart/:id` | ✅ Live | WishlistProvider (moveToCart) |

### Auth Flow
1. On mount, AuthContext reads `brandhive_user` from localStorage and calls `GET /auth/me` to validate the token. Stale/expired sessions are cleared automatically.
2. `login(email, password)` calls `POST /auth/login`, stores `{ ...user, token }` under `brandhive_user`.
3. `register(name, email, password, extras)` calls `POST /auth/register`, same storage pattern.
4. The Axios request interceptor reads `brandhive_user.token` and attaches it as `Authorization: Bearer <token>` on every request.
5. Any 401 response clears all three localStorage keys and redirects to `/login`.

## Change Log
- [Initial] PROJECT.md created with full project architecture
- API integration layer created (`src/services/api.js`), AuthContext wired to real login/register/getMe endpoints, LoginPage and RegisterPage updated to use real API
- RegisterPage simplified — combined first/last name into single Name field, removed phone and governorate fields
- Added VerifyPage with 6-digit OTP input, 60s resend countdown, wired to /auth/verify-account and /auth/resend-otp endpoints, registration now redirects to /verify after success
- Fixed verify-account endpoint URL — changed from /auth/verify-account to /auth/confirm-email
- Split reset password into 3 pages: ForgotPasswordPage → VerifyResetPage → ResetPasswordPage, endpoints: POST /auth/forget-password, POST /auth/verify-reset-code, PATCH /auth/reset-password
- Added real order tracking to UserDashboard — fetches from API, order detail modal with status timeline, shipping info, items list, and cancel order functionality
- Fixed login redirect bug — removed getMe() validation on mount, auth now relies on localStorage token only, fixed 401 interceptor to not redirect on auth endpoint failures
- Definitive fix for login redirect bug — removed getMe() call from initAuth, made 401 interceptor ignore auth endpoint failures
- Fixed login redirect bug — removed auto-redirect from 401 interceptor, dashboard API failures now show empty state instead of logging out user
- Fixed seller role persistence — SellerRegistration now calls real API (POST /brand/request), added brandhive_role_override to localStorage to persist seller role across logout/login until backend JWT reflects the correct role
- Connected Cart and Checkout to real backend APIs — implemented hybrid cart sync in CartContext using cartAPI, updated CartPage handlePlaceOrder to use ordersAPI.create, and wired up promo codes to cartAPI.applyCoupon
- Fixed token storage — login now handles multiple response formats from backend
- Fixed payment methods to match backend accepted values: cod, paymob, fawry
- Fixed cart sync before order — local cart items are now synced to backend before placing order
- Fixed token field — backend returns accessToken not token, also storing refreshToken, fixed register to use same format
- [Fixed] Cart API calls — skip API sync for mock products with numeric IDs, only sync real MongoDB ObjectId products, show demo message when trying to order mock products
- [Connected] Wishlist to real API — WishlistProvider now syncs with backend for logged-in users, optimistic updates with revert on failure, move-to-cart API integration, wishlist count badge in Navbar
- [Connected] Real API data — HomePage, ListingPage, ExploreBrands now use real products and brands from backend, created mappers.js for API response mapping, ProductCard and BrandCard support real image URLs and logos
- [Connected] ProductPage & BrandPage to real API — Fetches data by slug, added loading skeletons, support for multiple images from Cloudinary, real reviews display, and "not found" states
- [Fixed] Pagination & Search — Standardized `limit=50` across products and brands API calls, connected ListingPage filters to the `/search/products` backend endpoint with real-time re-fetching
- [Connected] UserDashboard — Removed mock data, connected to real `AuthContext` user data, implemented dynamic initials-based avatars for users without profile photos
- [Connected] Seller & Admin Dashboards — Integrated `sellerAPI` and `adminAPI` for real-time stats, order lists, and user management, added empty states and chart placeholders for clean data visualization
- [Fixed] ExploreBrands showing 0 brands — removed rating filter that hid real brands with 0 rating, updated mapBrand to handle missing API fields, fixed search to handle undefined fields
- [Fixed] 401 Unauthorized bug — Added token refresh interceptor using refreshToken in `api.js`, added retry logic for 401 responses in `HomePage` and `ListingPage`.
- [Final Fix] ListingPage — fetch all products once with limit 100, removed pagination, removed Best Match default sort, filtering now done entirely by frontend useMemo.
- [Fixed] CartPage key prop warning, added proper error handling for 500/404 in ProductPage.
- [Fixed] CartPage key prop warnings (Stepper, Cart List, Order Review).
- [Backend Recommendation] GET /product and GET /brand should be PUBLIC endpoints (no auth required) since they show products to all visitors including guests. (ممكن تخلي GET /product و GET /brand public endpoints من غير ما يحتاجوا token؟ المفروض أي زائر يقدر يشوف المنتجات والبراندات)
- Fixed token field mismatch in AuthContext (login/register)
- Fixed product/brand slug fallback to use _id
- Fixed Featured tab empty array logic in HomePage
- Simplified and fixed 401 retry causing loading stuck
- Fixed brand response shape handling in BrandPage
- Added proper empty state to ListingPage
- Wired `categoriesAPI` into HomePage, ListingPage, ExploreBrands, SellerRegistration
- Added `mapCategory` mapper with icon/color metadata fallback
- All category displays now use real API data with mockData as fallback
- Wired Profile Update to `usersAPI.updateProfile()` in UserDashboard
- Added Change Password section using `authAPI.changePassword()` in UserDashboard
- Wired My Reviews tab to `reviewsAPI.getMyReviews()` in UserDashboard
- Added `getMyReviews` to `reviewsAPI` in `services/api.js`
- CartPage: Load saved addresses from API in delivery step with one-click autofill
- AdminDashboard: Wired approveSeller/rejectSeller to real API calls
- AdminDashboard: Moved Sellers tab out of "under development" placeholder
- AdminDashboard: Added Reject button with API call to sellers table
- SellerDashboard: Wired `sellerAPI.getAnalytics()` for revenue chart and top products
- SellerDashboard: Removed hardcoded `revenueData`, `revenueDataAr`, `recentOrders` arrays
- SellerDashboard: Revenue tab now shows real chart with API fallback and loading skeletons
- AdminDashboard: Wired Revenue tab with `getRevenue()`, `getTopProducts()`, `getTopCustomers()`
- AdminDashboard: Revenue tab moved out of "under development" with full analytics UI (stats cards, top products, top customers)
- [Fixed] CORS with Vite proxy — vite.config.js now proxies /brandhive-api → Railway in dev, api.js uses DEV-aware baseURL and refresh URL
- [Connected] SupportChat to Claude AI (claude-haiku-4-5-20251001) — real multi-turn conversation, RTL-aware system prompt, animated typing indicator, error fallback
- [Fixed] CartPage demo-only message — when no real MongoDB items in cart, now attempts order using backend cart instead of blocking with a toast
- [Added] .env and .env.example for VITE_ANTHROPIC_API_KEY, .env added to .gitignore
- [Fixed] reviewsAPI.getMyReviews endpoint: /reviews/my → /reviews/my-reviews (was 404)
- [Fixed] 403 on admin accounts handled silently — orders, reviews, addresses, wishlist, cart all show empty state instead of error when admin visits UserDashboard
- Fixed BrandPage 500 error — now finds brand by slug from brands list instead of calling getOne with slug directly
- Hero section: Replaced hardcoded `heroShowcase` with real trending products from `productsAPI.getTrending()`
- Hero cards are now clickable Links to the product page
- Added skeleton loading state and static fallback if API returns empty
- Fixed hero trending cards to show real product images with proper fallback
- Fixed duplicate products — added Set-based deduplication in getAllPublicProducts pagination loop and deduplicateProducts helper in mappers
- Fixed duplicate products — added deduplication in getAllPublicProducts and HomePage fetch, heroShowcase now uses real product data with image support and fallback to hardcoded
- [Fixed] Products data extraction — handles all response shapes (data/products/items/array), added meta pagination support (res.data.meta.pages), simplified productsAPI.getAll params, added console.log debug logging
- Fixed AddProductPage form submission — removed rejected fields (salePrice/sku/status), converted price/stock/weight to numbers, brand assigned by backend, tags sent as array items, category sent as MongoDB ID
- Fixed AddProductPage — uses JSON body when no images, FormData when images present, price/stock/weight as proper numbers, brand ID fetched from seller dashboard, category sent as MongoDB ID
- Fixed AddProductPage 400 error: brand now sends _id fetched from sellerAPI.getDashboard()
- Fixed field name: salePrice → discountPrice to match API
- Fixed FormData to only send non-empty optional fields
- Removed demoSeller mock import
- Fixed SellerRegistration to send FormData instead of JSON for logo upload support
- Fixed logo upload — input was hidden with no trigger, now wrapped in label
- Added logo preview after selection
- Fixed catch block to show real error instead of silently upgrading seller role
- Fixed categories to send _ids to API
- Added SellerPendingPage — post-registration waiting screen while brand awaits admin approval
- SellerRegistration now redirects to `/seller/pending` instead of dashboard after successful submit
- Added `/seller/pending` protected route in App.jsx
- Removed all remaining mockData imports from pages — globalBrands now from real API, categories derived from products/brands, governorates derived from real data, fixed adminAPI orders endpoint to /orders/admin/all
- Fixed SellerRegistration — now sends phone and city/governorate fields required by backend
- Fixed SellerRegistration — removed governorate field, backend only accepts city
- Fixed Admin pending seller approvals — added brandRequests state, tries multiple endpoints to find brand requests, approve/reject buttons connected to real API
- Fixed sellers filter to handle isVerified/isActive/isApproved/status field variations
- Fixed setBrands response shape parsing with Array.isArray check
- Added debug logging for brand requests API response
- Fixed CORS: added Vercel domain to Railway server allowed origins
- Added vercel.json for SPA routing fix
- Confirmed withCredentials: false for Bearer token auth
- Fixed sellers filter: now uses `status === 'pending'` instead of isVerified/isActive checks
- Fixed brand requests to fetch all pages using pagination meta
- Added getBrandRequests page parameter support
- Fixed reject brand request: now sends rejectionReason to API
- Added rejection reason modal with validation (min 10 characters)
- Confirm button disabled until reason is long enough
- Fixed AddProductPage: brand _id now fetched from sellerAPI.getDashboard() with getBazaar() fallback
- Removed demoSeller mock import
- Fixed salePrice → discountPrice field name
- Fixed FormData to send only non-empty optional fields
- Added brand validation before submit
- Fixed brand fetch in AddProductPage: now fetches all brands and filters by user id
- Fixed AddProductPage brand fetch — now finds seller brand from brands list by owner ID, fallback to checking seller's existing products
- Fixed AddProductPage brand selection — seller can now choose from all available brands manually instead of auto-detecting by owner ID
- Fixed AddProductPage 400 error — sends JSON body with price/stock as numbers and category/brand as MongoDB IDs; FormData only when images present
- Fixed SellerDashboard products tab — falls back to filtering all products by createdBy when seller/products returns empty
- Fixed SellerDashboard products — filters by seller's owned brands, fallback to localStorage saved brand ID, saves selected brand when adding products
- Fixed SellerDashboard products: now fetches via GET /product?brand=ID instead of /seller/products
- Fixed brand lookup: searches all brands since requestedBy field not populated by backend
- Added brand dropdown fallback in AddProductPage when auto-detection fails
- Fixed brand detection: increased limit to 500 to fetch all brands including newly approved ones
- Fixed brand fetch limit: 500 → 50 (backend max)
- Brand dropdown fallback now shows all active brands for manual selection
- Fixed seller dashboard: orders now uses sellerAPI.getOrders() instead of ordersAPI
- Fixed seller dashboard: reviews now uses sellerAPI.getReviews() instead of reviewsAPI
- Fixed bazaar 500 error: wrapped in silent try/catch
- Fixed bazaar polling: added guard to prevent multiple calls
- Admin Products tab: added Delete, Activate, Deactivate actions
- Added search filter for products by name or brand
- Added adminAPI.deleteProduct, activateProduct, deactivateProduct endpoints
- Removed Google and Facebook login buttons from LoginPage and RegisterPage (no backend implementation)
- Fixed SupportChat security: moved Anthropic API call to backend /chat/ai endpoint
- API key now stored in server/.env only, never exposed to browser
- Removed mock conversations, simplified to single support chat window
- Added chatAPI.sendMessage() to services/api.js
- Added /chat/ai endpoint using axios to proxy Anthropic API calls
- Fixed server.js: removed /api/ prefix from all routes to match frontend expectations
- Routes now: /auth, /brand, /product, /orders, /users
- Fixed /chat/ai proxy: now routes to localhost:5000 instead of Railway
- Fixed chatAPI to use direct fetch instead of axios instance
- Fixed Vite proxy: changed /chat to /chat/ai to avoid React Router conflict
- Fixed My Orders badge: replaced hardcoded 1 with dynamic orders.length
- Fixed all dashboard tab badges to use real data counts
- SellerDashboard: Promotions tab now shows discount types with Coming Soon state
- SellerDashboard: Ads Manager tab now shows advertising packages with Coming Soon state
- AdminDashboard: Reports tab shows 4 report types with Coming Soon export
- AdminDashboard: Featured Slots tab shows 3 slot types
- AdminDashboard: Notifications tab wired to send notification API
- AdminDashboard: Audit Log tab shows informative placeholder
- Fixed block/unblock user: replaced isBlocked with isActive === false
- Fixed handleToggle: now uses optimistic local state update instead of refetch
- Reports tab: replaced Coming Soon with real CSV export for Users, Orders, Sellers, Products
- Added exportToCSV helper function
- Export buttons fetch live data from API and download as dated CSV files
- Fixed export endpoints: Users uses /admin/users, Sellers uses /brand/requests, Products uses /search/products
- Fixed response shape parsing for all 4 export handlers
- Fixed Sales Report: now exports dashboard summary data since no admin orders list endpoint exists
- Wired Export button in Admin Overview to export dashboard summary as CSV
- Wired Run Report button to navigate to Reports tab
- Fixed hardcoded date to show current date dynamically
- Fixed categories layout in HomePage: now centered with flex-wrap
- Added Review modal for seller applications showing brand details, logo, categories
- Review modal includes Approve/Reject actions for pending brands
- Fixed SellerRegistration handleSubmit — now sends city and phone to backend, upgrades role before API call, graceful fallback on API error
- Simplified SellerRegistration UI — removed unnecessary fields (nationalId, taxId, businessType, firstName/lastName), combined into name field, form now exactly matches backend accepted fields
- Fixed wishlist items display — now fetches full product details when productId is not populated
- Built real BazaarPage — shows all brands as seller stores with search, logo, cover, stats
- Removed duplicate Change Password section from Profile Settings tab — now only available in Settings tab via SettingsPanel component
- Payment Methods tab: replaced placeholder with real UI showing Paymob, Fawry, COD
- Payment Methods tab: added saved cards section with add/delete/set default
- Cards stored in localStorage
- Kept existing Paymob/Fawry/COD info cards below
- Payment Methods tab: removed How to Pay section
- Moved Add New Card below payment method cards
- Fixed NaN price in cart: added Number() casting and fallbacks for price/quantity
- Fixed subtotal calculation with safe reduce
- Fixed password input losing focus: added profileInitialized guard to useEffect
- Added Current Password input field in Profile Settings
- Fixed change password body: uses email + password fields as per API spec
- Fixed change password 404: routes to PATCH /auth/reset-password (change-password endpoint not on backend)
- Fixed change password flow: verify reset code via OTP before setting new password in Settings
- Added Delete User button in Admin Users tab
- Added guard to prevent deleting admin accounts
- Added deleteUser to adminAPI
- Fixed logout: now calls POST /auth/logout with email before clearing localStorage
- Added Reorder button in UserDashboard orders (delivered/cancelled orders only)
- Added reorder and logout endpoints to their respective APIs
- Added Coupons Management tab to AdminDashboard — create/delete coupons with code, type (percentage/fixed), value, expiry date, connected to real couponsAPI
- Fixed coupon discount — now reads couponDiscount/couponSaving fields from API response correctly
- Fixed coupon total — capped discount at subtotal, total can never be negative, uses API total when available
- Fixed coupon — calculates discount as percentage of API subtotal and applies to local subtotal
- Fixed coupon endpoint: /cart/coupon instead of /cart/apply-coupon
- Fixed discount field: now reads couponDiscount/couponSaving from API response
- Fixed discount calculation using server-returned total
- Fixed coupon discount: now uses subtotal - total from API for both fixed and percentage coupons
- Fixed coupon discount: added piastres-to-EGP conversion for API response values
- Fixed cart items mapping: now reads from product.name/image/id and effectivePrice/lockedPrice
- Fixed price conversion: piastres to EGP (divide by 100)
- Admin coupons: removed Fixed Amount option, percentage only
- Fixed coupon apply: percentage discounts converted from piastres, fixed amount discounts use EGP as-is
- Fixed coupon: removed incorrect /100 division, API returns EGP directly
- Fixed cart item prices: removed /100 division from CartContext mapper
- Navbar notifications: added delete button per notification via deleteNotification API
- Fixed adminAPI.getOrders endpoint from /admin/orders to /orders/admin/all
- Fixed Admin orders display — uses subtotal for amount, user email prefix for customer name, added status update dropdown per order
- Fixed Admin Dashboard Overview — mapped correct API field names (overview.totalRevenue, overview.totalOrders etc), added real orders by status bars, real category breakdown from products, added alerts section for pending orders and low stock

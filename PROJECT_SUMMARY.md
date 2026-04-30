# Gigspace — Project Summary

## What It Is

Gigspace is a **freelance marketplace web app** (like Fiverr/TaskRabbit hybrid) where:
- **Sellers** post services (digital work or in-person home services)
- **Buyers** browse, save, and hire sellers
- **Affiliates** have a separate dashboard (stub, not yet built out)
- **Admins** have a management dashboard (stub, not yet built out)

Live brand name: **Gigspace** (displayed as `igspace` with a location pin icon prepended visually).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Routing | React Router DOM v7 |
| Backend/DB | Firebase (Auth + Realtime Database + Storage) |
| Animation | Framer Motion |
| Icons | Lucide React |
| Deployment | Vercel (`vercel.json` present) |

---

## Project Structure

```
src/
├── firebase.ts           # Firebase init (auth, database, storage)
├── AuthContext.tsx        # Global auth state (user, userProfile, loading, logout)
├── App.tsx               # Router + all routes
├── main.tsx              # Entry point
│
├── LandingPage.tsx        # Public home page (/)
├── SellerLandingPage.tsx  # Marketing page for sellers (/for-sellers)
├── AboutUs.tsx            # About page (/about)
├── AffiliateLanding.tsx   # Affiliate marketing page (/affiliate)
│
├── Signup.tsx             # Email + Google signup
├── Signin.tsx             # Email + Google signin
├── ResetPassword.tsx      # Password reset request
├── VerifyEmail.tsx        # Email verification gate
├── AccountType.tsx        # Post-signup: choose buyer or seller
├── SellerProfile.tsx      # Seller onboarding profile setup
├── BuyerProfile.tsx       # Buyer onboarding profile setup
│
├── SellerDashboard.tsx    # Seller's main dashboard (tabs: Home, Posts, Orders, Messages, Statements, Payouts, Settings)
├── BuyerDashboard.tsx     # Buyer's main dashboard (tabs: Home, Orders, Messages, Saved, Billing, Settings)
├── AffiliateDashboard.tsx # Affiliate dashboard (stub)
├── AdminDashboard.tsx     # Admin dashboard (stub)
│
├── PostService.tsx        # 9-step wizard to create a service listing
├── BuyerSearch.tsx        # Public service search/browse page (/search)
├── BuyerSearchFiltered.tsx# Filtered search results (/search-filtered)
├── ServiceDetail.tsx      # Individual service page (/service-detail?id=...)
│
├── ChatMessages.tsx       # Real-time chat component (used in both dashboards)
├── OrdersTab.tsx          # Orders list with filter pills
├── OrderDetail.tsx        # Full order detail: status timeline, delivery, reviews, order chat
├── SettingsTab.tsx        # Profile + password settings (used in both dashboards)
├── SavedTab.tsx           # Saved services list (buyer dashboard)
├── ReviewModal.tsx        # Star rating + text review modal
│
├── UserAvatar.tsx         # Avatar component (UserAvatar + CurrentUserAvatar)
├── LocationIcon.tsx       # Custom SVG location pin icon (used as logo prefix)
│
├── useSavedServices.ts    # Hook: save/unsave services, real-time sync
├── useUnreadMessages.ts   # Hook: total unread message count per mode (buyer/seller)
│
├── WelcomeEmail.tsx       # Email template preview (/email-welcome)
├── ResetPasswordEmail.tsx # Email template preview (/email-reset-password)
├── PasswordUpdatedEmail.tsx # Email template preview (/email-password-updated)
```

---

## Routes

| Path | Component | Auth Required |
|---|---|---|
| `/` | LandingPage | No |
| `/search` | BuyerSearch | No |
| `/search-filtered` | BuyerSearchFiltered | No |
| `/for-sellers` | SellerLandingPage | No |
| `/about` | AboutUs | No |
| `/affiliate` | AffiliateLanding | No |
| `/service-detail?id=...` | ServiceDetail | No |
| `/signup` | Signup | No |
| `/signin` | Signin | No |
| `/reset-password` | ResetPassword | No |
| `/verify-email` | VerifyEmail | No |
| `/account-type` | AccountType | Yes |
| `/seller-profile` | SellerProfile | Yes |
| `/buyer-profile` | BuyerProfile | Yes |
| `/seller-dashboard` | SellerDashboard | Yes |
| `/buyer-dashboard` | BuyerDashboard | Yes |
| `/affiliate-dashboard` | AffiliateDashboard | Yes |
| `/admin-dashboard` | AdminDashboard | Yes |
| `/post-service` | PostService | Yes |
| `/email-welcome` | WelcomeEmail | No |
| `/email-reset-password` | ResetPasswordEmail | No |
| `/email-password-updated` | PasswordUpdatedEmail | No |

---

## Firebase Realtime Database Schema

```
users/
  {uid}/
    name, username, photoURL, accountType ('buyer'|'seller'), email, createdAt
    posts/ {serviceId}: true   ← index of seller's own posts

services/
  {serviceId}/
    sellerId, sellerName, sellerUsername, sellerPhotoURL
    title, description, category, subcategory
    priceMin, priceMax, priceType ('per_project'|'per_hour')
    images: [url, ...]
    languages: [string, ...]
    primaryLocation, extraLocations: [string, ...]
    offeredRemotely: boolean
    status ('active'|'paused')
    createdAt

conversations/
  {convId}/           ← convId = sorted([buyerId, sellerId]).join('_')
    buyerId, sellerId
    buyerName, sellerName, buyerPhotoURL, sellerPhotoURL
    lastMessage, lastMessageAt, lastMessageBy
    unreadBuyer, unreadSeller

messages/
  {convId}/
    {msgId}/
      senderId, senderName, senderPhotoURL
      text?, imageURL?
      type? ('offer' | 'service_inquiry')
      offer?: { serviceId, serviceTitle, serviceImage, description, price, priceUnit }
      offerStatus? ('pending' | 'accepted')
      serviceContext?: { serviceId, serviceTitle, serviceImage }
      timestamp

userConversations/
  {uid}/ {convId}: true   ← index for fast conversation lookup

orders/
  {orderId}/
    buyerId, buyerName, buyerPhoto
    sellerId, sellerName, sellerPhoto
    serviceId, serviceTitle, serviceImage
    price, priceType
    message
    status ('pending'|'in_progress'|'delivered'|'completed'|'cancelled')
    createdAt
    deliveryMessage?, deliveryFiles?: [{name, url, type, size}]

orderMessages/
  {orderId}/
    {msgId}/ senderId, senderName, senderPhotoURL, text, timestamp

savedServices/
  {uid}/ {serviceId}: { savedAt }

reviews/
  {orderId}/
    buyerReview/  rating, text, reviewerId, reviewerName, reviewerPhoto, reviewedUserId, timestamp
    sellerReview/ (same shape)

userRatings/
  {uid}/ totalStars, reviewCount

serviceReviews/
  {serviceId}/
    {orderId}/ (copy of buyerReview + serviceTitle)
```

---

## Key Features & Flows

### Auth Flow
1. Signup (email/password or Google) → `/account-type`
2. Choose `buyer` or `seller` → profile setup page → respective dashboard
3. `AuthContext` provides `user` (Firebase Auth), `userProfile` (from DB), `loading`, `logout`
4. `ProtectedRoute` wraps all authenticated routes; redirects to `/signin` if unauthenticated
5. 6-second fallback timeout prevents blank screen if Firebase Auth is blocked

### Post Service (9-step wizard)
Steps: Category → Title & Description → Pricing → Images (up to 10) → Languages → Extra Locations (optional, $5/mo each) → Primary Location → Review & Publish → Success

On publish: images uploaded to Firebase Storage (`serviceImages/{uid}/...`), service written to `services/`, and indexed under `users/{uid}/posts/`.

### Service Categories
- **Digital Work**: Web Dev, Mobile Dev, Graphic Design, Video & Animation, Content Writing, SEO & Marketing, Data & Analytics
- **Home Services**: Cleaning, Plumbing, Electrical, Painting, Moving & Delivery, Landscaping, Handyman

### Messaging (ChatMessages.tsx)
- Real-time via Firebase Realtime Database
- Conversation ID = `[uid1, uid2].sort().join('_')`
- Message types: regular text, image attachment, `service_inquiry` (with service card), `offer` (seller sends structured offer with price)
- Buyer can **Accept offer** → creates an order in `orders/`
- Unread badge counts tracked per conversation per role

### Orders (OrdersTab + OrderDetail)
Order lifecycle: `pending` → `in_progress` → `delivered` → `completed` (or `cancelled`)

- Seller: can deliver work (message + file attachments uploaded to Storage), sees "Waiting for buyer" on delivered
- Buyer: can Accept delivery (→ `completed`) or Request revision (→ back to `in_progress`), can Cancel while `in_progress`
- On completion: buyer reviews seller first; seller can review buyer only after buyer's review is submitted (blind review system)
- Reviews denormalized to `serviceReviews/{serviceId}` for display on ServiceDetail page

### Saved Services
- `useSavedServices` hook syncs `savedServices/{uid}` in real-time
- Bookmark button on service cards and ServiceDetail page
- Saved tab in BuyerDashboard

### Settings
- Profile: change display name, username, avatar photo (uploaded to `avatars/{uid}`)
- Security: change password (email provider only); Google users redirected to Google account

---

## Design System

- Background: `#0E1422` (dark navy)
- Card/sidebar: `#111827`
- Input/elevated: `#1A2035`
- Primary/accent: blue (`bg-primary` = Tailwind blue-500 equivalent)
- Text: white / `slate-300` / `slate-400` / `slate-500`
- All UI is dark-mode only
- Responsive: desktop sidebar layout + mobile bottom nav bar in dashboards
- Consistent rounded corners: `rounded-xl`, `rounded-2xl`

---

## Environment Variables (`.env`)

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

---

## What's Built vs. Stub

| Feature | Status |
|---|---|
| Auth (email + Google) | ✅ Complete |
| Post Service wizard | ✅ Complete |
| Service browse/search | ✅ Complete (no real search filter logic yet) |
| Service detail page | ✅ Complete |
| Real-time messaging | ✅ Complete |
| Offer system | ✅ Complete |
| Orders + lifecycle | ✅ Complete |
| Delivery with file upload | ✅ Complete |
| Review system (blind) | ✅ Complete |
| Saved services | ✅ Complete |
| Settings (profile + password) | ✅ Complete |
| Seller dashboard | ✅ Complete |
| Buyer dashboard | ✅ Complete |
| Admin dashboard | 🚧 Stub (UI shell only) |
| Affiliate dashboard | 🚧 Stub (UI shell only) |
| Statements / Payouts tabs | 🚧 "Coming soon" placeholder |
| Billing tab (buyer) | 🚧 "Coming soon" placeholder |
| Search filtering (BuyerSearchFiltered) | 🚧 Partial |
| Escrow/payment processing | ❌ Not implemented |
| Email notifications | ❌ Not implemented (templates exist as React components) |
| Extra locations billing ($5/mo) | ❌ Not implemented |

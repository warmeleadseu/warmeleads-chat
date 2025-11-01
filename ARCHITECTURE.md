# 🏗️ WarmeLeads Architecture

**Last Updated:** 1 November 2025

---

## 📊 System Overview

WarmeLeads is a lead generation and CRM platform built for sustainable energy companies in the Netherlands.

```
┌─────────────────────────────────────────────────────────────┐
│                    WarmeLeads Platform                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Landing    │  │   Customer   │  │  CRM Dashboard  │  │
│  │     Page     │  │    Portal    │  │   (Internal)    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                 │                    │            │
│         └─────────────────┴────────────────────┘            │
│                           │                                  │
│                    ┌──────▼──────┐                          │
│                    │  Next.js 14 │                          │
│                    │  App Router │                          │
│                    └──────┬──────┘                          │
│                           │                                  │
│         ┌─────────────────┼─────────────────┐              │
│         │                 │                 │              │
│    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐          │
│    │Supabase │      │ Stripe  │      │ Google  │          │
│    │  (DB)   │      │Payments │      │ Sheets  │          │
│    └─────────┘      └─────────┘      └─────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3
- **State Management:** Zustand (auth state)
- **UI Components:** Headless UI, Heroicons
- **Animation:** Framer Motion
- **Forms:** Native HTML forms (planning React Hook Form)

### Backend (API Routes)
- **Runtime:** Next.js API Routes (serverless)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Custom bcrypt-based auth
- **Payments:** Stripe
- **Email:** Resend
- **Storage:** Supabase Storage (previously Vercel Blob)

### External Integrations
- **Google Sheets API** - Lead data synchronization
- **Twilio** - WhatsApp Business messaging
- **Stripe** - Payment processing
- **Resend** - Transactional emails

### Development
- **Package Manager:** npm
- **Linting:** ESLint + TypeScript
- **Code Style:** Prettier (implicit via editor)
- **Git:** GitHub
- **CI/CD:** Vercel (automatic deployments)

---

## 📁 Project Structure

```
warmeleads/
├── src/
│   ├── app/                      # Next.js 14 App Router
│   │   ├── api/                  # API Routes (serverless functions)
│   │   │   ├── auth/             # Authentication endpoints
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   ├── get-profile/
│   │   │   │   └── ...
│   │   │   ├── admin/            # Admin-only APIs
│   │   │   │   ├── customers/    # Fetch all customers (SERVICE_ROLE)
│   │   │   │   ├── users/        # Fetch all users
│   │   │   │   └── link-sheet/   # Google Sheets linking
│   │   │   ├── customer-data/    # Customer CRM data
│   │   │   ├── orders/           # Order management
│   │   │   ├── webhooks/         # External webhooks
│   │   │   │   └── stripe/       # Stripe payment webhooks
│   │   │   ├── whatsapp/         # WhatsApp integration
│   │   │   └── ...
│   │   ├── admin/                # Admin dashboard pages
│   │   │   ├── customers/
│   │   │   ├── analytics/
│   │   │   ├── orders/
│   │   │   └── ...
│   │   ├── crm/                  # CRM dashboard for customers
│   │   │   ├── leads/
│   │   │   ├── analytics/
│   │   │   └── settings/
│   │   ├── portal/               # Customer self-service portal
│   │   ├── blog/                 # Blog (SEO content)
│   │   ├── leads/                # Landing pages per product
│   │   └── page.tsx              # Homepage
│   ├── components/               # React components
│   │   ├── admin/                # Admin-specific components
│   │   ├── ui/                   # Reusable UI components (planned)
│   │   ├── ChatInterface.tsx
│   │   ├── CustomerPortal.tsx
│   │   ├── LoginForm.tsx
│   │   └── ...
│   ├── lib/                      # Utility libraries
│   │   ├── auth.ts               # Zustand auth store
│   │   ├── crmSystem.ts          # Core CRM logic (Supabase)
│   │   ├── supabase.ts           # Supabase client factory
│   │   ├── stripe.ts             # Stripe helpers
│   │   ├── googleSheetsAPI.ts    # Google Sheets integration
│   │   ├── whatsappAPI.ts        # WhatsApp messaging
│   │   └── ...
│   ├── hooks/                    # Custom React hooks
│   │   └── useLocalStorage.ts
│   ├── styles/                   # Global styles
│   │   └── globals.css
│   └── data/                     # Static data
│       ├── blogArticles.ts
│       ├── locations.ts
│       └── ...
├── public/                       # Static assets
│   ├── favicon.ico
│   ├── images/
│   └── ...
├── supabase-schema-complete.sql  # Database schema
├── .env.local                    # Environment variables (gitignored)
├── .env.example                  # Template for env vars
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies
```

---

## 🗄️ Database Architecture (Supabase)

### Core Tables

#### `users`
User authentication and profiles
```sql
- id (uuid, PK)
- email (text, unique)
- password_hash (text)
- name (text)
- company (text)
- phone (text)
- role ('owner' | 'employee' | 'admin')
- company_id (uuid, FK -> companies)
- created_at, updated_at, last_login
```

#### `companies`
Company information for multi-tenant support
```sql
- id (uuid, PK)
- name (text)
- owner_email (text)
- industry (text)
- created_at, updated_at
```

#### `customers`
CRM customer records
```sql
- id (uuid, PK)
- email (text, unique)
- name, phone, company (text)
- status ('lead' | 'contacted' | 'customer' | 'inactive')
- source ('chat' | 'direct' | 'landing_page')
- has_account (boolean)
- google_sheet_id, google_sheet_url (text) - Linked Google Sheet
- email_notifications_enabled (boolean)
- created_at, last_activity, account_created_at
```

#### `chat_messages`
Chat history per customer
```sql
- id (uuid, PK)
- customer_id (uuid, FK -> customers)
- type ('lisa' | 'user')
- content (text)
- step (text) - Chat flow step
- timestamp (timestamptz)
```

#### `orders`
Customer orders and purchases
```sql
- id (uuid, PK)
- order_number (text, unique)
- customer_id (uuid, FK -> customers)
- package_id, package_name (text)
- industry, lead_type (text)
- quantity (int)
- price_per_lead, total_amount, vat_amount (numeric)
- status ('pending' | 'completed' | 'cancelled')
- payment_status, payment_method (text)
- stripe_session_id, stripe_payment_intent_id (text)
- created_at, paid_at, delivered_at
```

#### `leads`
Leads managed in CRM
```sql
- id (uuid, PK)
- customer_id (uuid, FK -> customers)
- name, email, phone, company, address, city (text)
- interest, budget, timeline, notes (text)
- status ('new' | 'contacted' | 'qualified' | 'converted' | 'lost')
- deal_value, profit (numeric)
- assigned_to (text)
- source ('campaign' | 'manual' | 'import')
- sheet_row_number (int) - Google Sheets sync
- created_at, updated_at
```

#### `lead_branch_data`
Branch-specific lead metadata
```sql
- id (uuid, PK)
- lead_id (uuid, FK -> leads)
- data (jsonb) - Flexible branch-specific fields
```

#### `open_invoices`
Unpaid invoices/quotes
```sql
- id (uuid, PK)
- customer_id (uuid, FK -> customers)
- customer_email (text)
- industry, lead_type (text)
- quantity (int)
- amount (numeric)
- status ('draft' | 'sent' | 'overdue' | 'abandoned')
- reminder_count (int)
- last_reminder_sent (timestamptz)
- created_at
```

### Additional Tables
- `data_changes` - Audit trail for customer data modifications
- `employees` - Employee accounts management
- `user_preferences` - User settings and preferences
- `lead_reclamations` - Lead quality issues/refunds
- `pricing_config` - Dynamic pricing rules

### Row Level Security (RLS)

**Status:** ⚠️ **Policies defined but bypassed by SERVICE_ROLE**

Currently, API routes use `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. Authentication happens at the API route level (checking user sessions in requests).

**Future improvement:** Use user JWT tokens + RLS for defense in depth.

---

## 🔐 Authentication Flow

### Registration
```
User submits form
  → POST /api/auth/register
    → Validate input (email, password)
    → Hash password (bcrypt, 10 rounds)
    → Create user in Supabase `users` table
    → Create company in `companies` table
    → Return user data (no password)
  → Frontend stores auth state (Zustand + localStorage)
  → Redirect to /portal
```

### Login
```
User submits credentials
  → POST /api/auth/login
    → Fetch user by email from Supabase
    → Compare password with hash (bcrypt)
    → Update last_login timestamp
    → Return user data + permissions
  → Frontend stores auth state (Zustand + localStorage)
  → Redirect based on role (admin → /admin, user → /portal)
```

### Session Management
- **Client:** Zustand store (`useAuthStore`)
- **Persistence:** localStorage (`warmeleads-auth`)
- **Expiry:** 24 hours (checked on init)
- **Refresh:** Re-fetch user data on page load if cached

**⚠️ TODO:** Replace localStorage with secure httpOnly cookies or Supabase auth sessions.

---

## 💳 Payment Flow (Stripe)

### Checkout Process
```
User selects package
  → Fills contact form (creates customer in CRM)
  → Creates open_invoice
  → Clicks "Bestellen"
  → POST /api/create-checkout-session
    → Create Stripe Checkout Session
    → Store session_id with invoice
    → Return checkout URL
  → Redirect to Stripe Checkout
  → User completes payment
  → Stripe webhook → POST /api/webhooks/stripe
    → Verify webhook signature
    → Convert open_invoice to order
    → Mark as paid
    → Send confirmation email (TODO)
  → Redirect to /payment-success
```

### Webhook Security
- Signature verification using `STRIPE_WEBHOOK_SECRET`
- Idempotency handling (check if order already exists)
- Error logging + retry mechanism (Stripe handles retries)

---

## 📊 Google Sheets Integration

### Purpose
Customers can sync their purchased leads to a Google Sheet for easy management.

### Flow
```
Admin links Google Sheet to customer
  → Customer has active orders
  → POST /api/admin/link-sheet
    → Extract sheet_id from URL
    → Update customer.google_sheet_id & google_sheet_url
  → Background sync (Cron Job)
    → Fetch new leads from lead provider
    → Write to customer's Google Sheet
    → Update lead status in CRM
```

### Google Sheets API
- **Service Account:** Used for server-side access
- **Scope:** `https://www.googleapis.com/auth/spreadsheets`
- **Libraries:** Custom wrapper in `googleSheetsAPI.ts`

---

## 🤖 Cron Jobs (Vercel Cron)

### `/api/check-new-leads` (Daily)
- Runs every day at 9:00 AM CET
- Checks all customers with linked Google Sheets
- Fetches new rows from sheets
- Sends email notifications for new leads
- Protected by `CRON_SECRET` in Authorization header

**Configuration:** `vercel.json`
```json
{
  "crons": [{
    "path": "/api/check-new-leads",
    "schedule": "0 9 * * *"
  }]
}
```

---

## 🔄 Data Flow Examples

### Example 1: User Purchases Leads

```
1. User browses /leads-zonnepanelen
2. Clicks "Leads kopen"
3. Fills ChatInterface (collects email, name, company)
   → Creates customer in Supabase via crmSystem
4. Selects package (10 leads, exclusive)
5. Redirected to checkout
6. Creates open_invoice in Supabase
7. Stripe Checkout Session created
8. User pays via Stripe
9. Webhook received → order created, invoice removed
10. User gets confirmation
11. Admin links Google Sheet to customer
12. Leads delivered to Google Sheet
13. Customer manages leads in CRM dashboard
```

### Example 2: Admin Views Customer

```
1. Admin logs in with admin email
2. Navigates to /admin/customers
3. Page calls GET /api/admin/customers
   → Uses SERVICE_ROLE_KEY to bypass RLS
   → Fetches all customers with related data
4. Admin sees list of customers
5. Clicks "Link Google Sheet" button
6. Enters Google Sheet URL
7. POST /api/admin/link-sheet
   → Updates customer.google_sheet_url
8. Customer can now see leads in their portal
```

---

## 🚀 Deployment Architecture

### Hosting: Vercel

**Production:**
- URL: https://www.warmeleads.eu
- Branch: `main`
- Auto-deploy on push to main

**Preview:**
- Auto-generated for every PR
- URL: `https://warmeleads-chat-<hash>.vercel.app`

### Environment Variables

**Vercel Dashboard:** Project Settings → Environment Variables

Required for all environments (Development, Preview, Production):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Secret
- `STRIPE_SECRET_KEY` ⚠️ Secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `ADMIN_EMAILS`
- `CRON_SECRET`

### Build Process
```bash
# Install dependencies
npm install

# Build Next.js application
npm run build

# Output: .next/ directory (serverless functions + static pages)
```

### Serverless Functions
- Each API route = 1 serverless function
- Cold start: ~1-2 seconds
- Execution limit: 10 seconds (Hobby plan)
- Memory: 1024 MB

---

## 📈 Monitoring & Logging

### Current State
- **Console logs** throughout codebase (via `console.log`, `console.error`)
- **Vercel logs** accessible in dashboard
- **Stripe Dashboard** for payment monitoring
- **Supabase Dashboard** for database queries

### Recommended Improvements
- [ ] Structured logging service (e.g., LogRocket, Sentry)
- [ ] Error tracking & alerting
- [ ] Performance monitoring (Web Vitals)
- [ ] User analytics (Mixpanel, Amplitude)
- [ ] Uptime monitoring (Uptime Robot, Better Stack)

---

## 🔮 Future Architecture Plans

### Short Term (1-3 months)
1. **Authentication Middleware** - Centralized auth for API routes
2. **React Query** - Better data fetching & caching
3. **Design System** - Consistent UI component library
4. **Testing** - Jest + Playwright setup

### Medium Term (3-6 months)
1. **Multi-tenancy** - Multiple users per company
2. **Real-time updates** - WebSockets or Supabase Realtime
3. **Advanced CRM** - Pipeline management, email sequences
4. **Mobile App** - React Native version

### Long Term (6-12 months)
1. **Microservices** - Split into specialized services
2. **Event-driven** - Message queue for async tasks
3. **AI Features** - Lead scoring, chatbot improvements
4. **Internationalization** - Multi-language support

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

---

## 📚 Related Documentation

- [Database Schema](./docs/DATABASE.md)
- [API Documentation](./docs/API.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Security Guidelines](./docs/SECURITY.md)

---

*Last updated: November 1, 2025*


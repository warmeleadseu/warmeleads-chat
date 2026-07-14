# WarmeLeads Data Storage Analyse

## Huidige Data Storage Locaties

### 1. ✅ Vercel Blob Storage (moet naar Supabase)

**Auth/User Data:**
- `/api/auth/register` - User accounts
- `/api/auth/login` - User authentication  
- `/api/auth/get-profile` - Profile data
- `/api/auth/update-profile` - Profile updates
- `/api/auth/change-password` - Password changes
- `/api/auth/company` - Company data
- `/api/auth/invite-employee` - Employee invites
- `/api/auth/activate-employee` - Employee activation
- `/api/auth/manage-account` - Account management
- `/api/auth/list-accounts` - List all accounts
- `/api/auth/force-delete-employee` - Delete employees

**Customer/CRM Data:**
- `/api/customer-data` - Customer CRM data (orders, leads, chat history)
- `/api/orders` - Order data
- `/api/customer-sheets` - Google Sheets mapping

**Andere Data:**
- `/api/user-preferences` - User preferences
- `/api/reclaim-lead` - Lead reclamations
- `/api/pricing` - Pricing configuration
- `/api/webhooks/stripe` - Order/invoice storage

### 2. ✅ localStorage (client-side)

**CRM System (`crmSystem.ts`):**
- `warmeleads_crm_data` - Alle CRM data (customers, orders, leads, chat history)
- Dit wordt alleen gebruikt in browser, NIET server-side

**Auth State (`auth.ts`):**
- `warmeleads-auth` - Auth state persistence
- `warmeleads_visited` - Visitor tracking

### 3. ✅ Google Sheets (externe integratie)

**Lead Data:**
- Customer leads worden opgeslagen in Google Sheets
- Sync via `googleSheetsAPI.ts`
- URL per customer opgeslagen in customer data

## Wat MOET naar Supabase

### Prioriteit 1 - CRITICAL (auth is al gedaan)
- ✅ User accounts - DONE
- ✅ Login/register - DONE
- ✅ Profile data - DONE
- ⚠️ Company data - PARTIAL (schema klaar, routes nog niet)
- ⚠️ Employee management - PARTIAL (schema klaar, routes nog niet)

### Prioriteit 2 - HIGH  
- ❌ **Customer CRM data** - customers, chat history, data changes
- ❌ **Orders** - alle bestellingen
- ❌ **Open invoices** - openstaande facturen
- ❌ **Leads** - alle lead data (nu in Google Sheets + localStorage)
- ❌ **User preferences** - instellingen per user

### Prioriteit 3 - MEDIUM
- ❌ **Pricing configuration** - pricing per branch
- ❌ **Lead reclamations** - klachten over leads

## Voordelen Supabase vs Huidige Setup

### Blob Storage Problemen:
1. ❌ Geen relationele queries mogelijk
2. ❌ Geen foreign keys/constraints
3. ❌ Geen transacties
4. ❌ JSON files moeten volledig gelezen/geschreven worden
5. ❌ Race conditions mogelijk
6. ❌ Moeilijk te migreren/backup
7. ❌ Geen real-time functionaliteit

### localStorage Problemen:
1. ❌ Alleen in browser beschikbaar
2. ❌ Geen server-side toegang
3. ❌ Geen sync tussen devices
4. ❌ Geen backup
5. ❌ Beperkte storage (5-10MB)
6. ❌ Verdwijnt bij cache clear

### Supabase Voordelen:
1. ✅ PostgreSQL relationele database
2. ✅ Foreign keys + constraints
3. ✅ ACID transacties
4. ✅ Snelle queries met indexes
5. ✅ Row Level Security
6. ✅ Automatische backups
7. ✅ Real-time subscriptions mogelijk
8. ✅ Multi-device sync
9. ✅ Server-side toegang
10. ✅ GraphQL + REST APIs

## Migratie Plan

### Fase 1: Auth & Users ✅
- User accounts
- Login/register
- Profile management
**Status: COMPLETED**

### Fase 2: Customers & CRM (NU)
- Customer data
- Chat messages
- Data changes history
- Orders
- Open invoices
**Status: TODO**

### Fase 3: Leads & Data
- Lead storage
- Branch-specific data
- Lead reclamations
- User preferences
**Status: TODO**

### Fase 4: Configuration
- Pricing config
- Company/employee (complete)
**Status: PARTIAL**

### Fase 5: Cleanup
- Remove Blob Storage dependencies
- Remove localStorage CRM sync
- Keep Google Sheets (externe source blijft)
**Status: TODO**

## Google Sheets - BLIJFT
Google Sheets blijft als externe lead bron. Supabase wordt sync target:
- Leads komen uit Google Sheets
- Worden gesynchroniseerd naar Supabase
- Supabase = master voor status updates
- Google Sheets = source of truth voor lead data

## Action Items

1. ✅ Database schema uitbreiden (customers, orders, leads, etc.)
2. ⬜ Migreer `/api/customer-data` naar Supabase
3. ⬜ Migreer `/api/orders` naar Supabase
4. ⬜ Migreer CRM system naar Supabase
5. ⬜ Update alle components die Blob Storage gebruiken
6. ⬜ Test volledige flow (register → order → leads → CRM)
7. ⬜ Migreer bestaande data (als nodig)
8. ⬜ Remove Blob Storage waar mogelijk


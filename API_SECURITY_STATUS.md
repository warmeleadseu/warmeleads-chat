# 🔒 API ROUTES SECURITY AUDIT

## ✅ BEVEILIGDE ROUTES (7/42 - 17%)

### Tier 1: Critical User-Facing Routes
1. ✅ `/api/customer-data` - withAuth + ownership
2. ✅ `/api/orders` - withAuth + ownership  
3. ✅ `/api/user-preferences` - withAuth + ownership
4. ✅ `/api/reclaim-lead` - withAuth + ownership

### Tier 2: Admin & Payment Routes
5. ✅ `/api/pricing` - GET public, POST/PUT admin-only
6. ✅ `/api/admin/link-sheet` - Admin-only
7. ✅ `/api/create-checkout-session` - withAuth + ownership
8. ✅ `/api/webhooks/stripe` - Stripe signature verification (extern webhook)

---

## 🔄 TE BEVEILIGEN (35 routes)

### Categorie A: Admin Routes (ADMIN ONLY)
- `/api/admin/customers` - Admin customer list
- `/api/admin/users` - Admin user list
- `/api/admin/real-data` - Admin analytics
- `/api/admin/migrate-accounts` - Admin migration tool

### Categorie B: Auth Routes (AL DEELS VEILIG)
- `/api/auth/register` - ✅ Al veilig (validatie)
- `/api/auth/login` - ✅ Al veilig (validatie)
- `/api/auth/get-profile` - ✅ Al veilig (validatie)
- `/api/auth/update-profile` - ✅ Al veilig (validatie)
- `/api/auth/change-password` - ✅ Al veilig (validatie)
- `/api/auth/manage-account` - Needs auth check
- `/api/auth/list-accounts` - Needs admin check
- `/api/auth/invite-employee` - Needs owner/admin check
- `/api/auth/activate-employee` - Needs verification
- `/api/auth/force-delete-employee` - Needs owner/admin check
- `/api/auth/company` - Needs auth check

### Categorie C: Payment Routes
- `/api/create-payment-intent` - Needs auth + ownership
- `/api/stripe-payment` - Needs auth + ownership
- `/api/verify-payment` - Needs auth + ownership
- `/api/test-payment` - DELETE (test route)

### Categorie D: Content/AI Routes (ADMIN ONLY of AUTHENTICATED)
- `/api/generate-content` - Admin only
- `/api/publish-ai-article` - Admin only
- `/api/test-ai-content` - DELETE (test route)

### Categorie E: WhatsApp Integration (AUTHENTICATED)
- `/api/whatsapp/send` - Auth + ownership
- `/api/whatsapp/trigger-new-lead` - Internal/Admin
- `/api/whatsapp/config` - Admin only
- `/api/whatsapp/analytics` - Admin only
- `/api/whatsapp/webhook` - Webhook verificatie (extern)

### Categorie F: Lead Management (AUTHENTICATED)
- `/api/check-new-leads` - Auth + ownership
- `/api/send-lead-notification` - Internal/Admin
- `/api/follow-up-emails` - Cron job (signed token)

### Categorie G: Utilities
- `/api/sheets-auth` - Auth + ownership (Google Sheets auth)
- `/api/sign-jwt` - Internal use (needs security check)

### Categorie H: Debug Routes (DELETE IN PRODUCTION)
- `/api/debug/supabase` - DELETE
- `/api/debug/customers-raw` - DELETE

---

## 🎯 PRIORITEIT PLAN

### FASE 1: Critical (Nu) ⏰
Beveilig routes die direct door users worden gebruikt:
1. Payment routes (create-payment-intent, stripe-payment, verify-payment)
2. Auth management routes (manage-account, company)
3. Lead check route (check-new-leads)
4. WhatsApp send

### FASE 2: Admin (Vandaag)
Beveilig admin-only functionaliteit:
1. Admin dashboard routes (customers, users, real-data)
2. Content generation routes
3. WhatsApp config/analytics
4. Employee management

### FASE 3: Internal (Vandaag)
Beveilig internal/cron routes:
1. Cron jobs met signed JWT
2. Internal webhooks
3. Background jobs

### FASE 4: Cleanup (Vandaag)
Verwijder test/debug routes in production:
1. Debug routes
2. Test routes

---

## 🛠️ IMPLEMENTATIE PATRONEN

### Pattern 1: User Ownership
```typescript
export const GET = withAuth(async (req, user) => {
  const email = req.searchParams.get('email');
  if (email !== user.email && !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // ... logic
});
```

### Pattern 2: Admin Only
```typescript
export const POST = withAuth(async (req, user) => {
  // ... logic
}, { adminOnly: true });
```

### Pattern 3: Cron/Internal (Signed JWT)
```typescript
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... logic
}
```

### Pattern 4: External Webhook (Signature)
```typescript
export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-webhook-signature');
  if (!verifySignature(await req.text(), signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  // ... logic
}
```

---

## 📊 VOORTGANG TRACKING

- ✅ Tier 1 Critical: 4/4 (100%)
- ✅ Tier 2 Important: 4/4 (100%)  
- 🔄 Tier 3 Remaining: 0/34 (0%)

**Totaal: 8/42 routes beveiligd (19%)**

---

## 🚨 HOGE RISICO ROUTES (Prioriteit 1)

Deze routes MOETEN vandaag beveiligd worden:
1. `/api/create-payment-intent` - Payment creation zonder auth!
2. `/api/stripe-payment` - Direct payment zonder auth!
3. `/api/admin/customers` - Customer data zonder auth check
4. `/api/admin/users` - User data zonder auth check
5. `/api/auth/force-delete-employee` - Delete zonder verificatie!

---

Status: **IN PROGRESS** - Continue naar Tier 3 implementatie


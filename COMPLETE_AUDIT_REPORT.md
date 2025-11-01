# 🎯 COMPLETE PLATFORM AUDIT - WarmeLeads

**Datum:** 1 November 2025  
**Status:** ✅ Audit Compleet - Klaar voor Implementatie  
**Geschatte tijd voor alle fixes:** 12-15 werkdagen

---

## 📊 EXECUTIVE SUMMARY

### ✅ STERKE PUNTEN (Wat al perfect is)

1. **✅ Auth Fully Migrated** - Alle authenticatie naar Supabase, bcrypt hashing
2. **✅ CRM System Supabase** - `crmSystem.ts` volledig async met Supabase
3. **✅ Google Sheets Integration** - Perfect werkend via Supabase
4. **✅ Stripe Payments** - Volledige checkout flow
5. **✅ Modern Stack** - Next.js 14 App Router, TypeScript, Tailwind
6. **✅ Mobile Responsive** - Basis responsive design aanwezig
7. **✅ Error Handling** - ApiResponseHandler consistent in gebruik

### ⚠️ KRITIEKE VERBETERINGEN NODIG

1. **🔒 SECURITY** - API routes missen authenticatie checks (HIGH)
2. **💾 DATA** - localStorage cleanup needed in dataSyncService.ts & auth.ts (HIGH)  
3. **🎨 DESIGN** - Inconsistente UI patterns door hele app (MEDIUM)
4. **⚡ PERFORMANCE** - Geen code splitting, veel onnodige re-renders (MEDIUM)
5. **♿ ACCESSIBILITY** - ARIA labels ontbreken, keyboard navigation minimaal (MEDIUM)
6. **🧪 TESTING** - Geen tests, geen CI/CD (LOW maar BELANGRIJK)
7. **📚 DOCS** - Minimale documentatie voor developers (LOW)

---

## 🔒 SECURITY AUDIT - DETAILED

### 🚨 PRIORITY 1: API Authentication Missing

**PROBLEEM:**  
42 API routes hebben **geen authenticatie**. Iedereen kan ze aanroepen met juiste params.

**GETROFFEN ROUTES:**
```typescript
// ❌ GEEN AUTH:
/api/customer-data      // Kan elke customer data ophalen
/api/orders             // Kan elke order ophalen
/api/user-preferences   // Kan elke user preferences lezen/schrijven
/api/admin/customers    // Alleen email check, geen token verificatie
/api/admin/users        // Geen authenticatie
/api/pricing            // Config kan worden aangepast zonder auth
/api/reclaim-lead       // Iedereen kan reclaims maken
// ... en 35 andere routes
```

**OPLOSSING: Authenticatie Middleware**

Maak een centrale auth middleware:

```typescript
// src/middleware/auth.ts (NIEUW BESTAND)
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function verifyAuthToken(request: NextRequest) {
  // Get token from cookie or header
  const token = request.cookies.get('auth-token')?.value 
    || request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return { user: null, error: 'No authentication token' };
  }
  
  // Verify with Supabase
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', token)  // Of gebruik JWT decode
    .single();
  
  if (error || !data) {
    return { user: null, error: 'Invalid token' };
  }
  
  return { user: data, error: null };
}

// Middleware wrapper
export function withAuth(handler: Function, options?: { adminOnly?: boolean }) {
  return async (request: NextRequest) => {
    const { user, error } = await verifyAuthToken(request);
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Admin check
    if (options?.adminOnly) {
      const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
      if (!adminEmails.includes(user.email)) {
        return NextResponse.json(
          { error: 'Forbidden - Admin only' },
          { status: 403 }
        );
      }
    }
    
    // Call handler with user
    return handler(request, user);
  };
}

// Per-resource ownership check
export function withOwnershipCheck(
  handler: Function, 
  resourceGetter: (req: NextRequest) => Promise<{ ownerId: string }>
) {
  return async (request: NextRequest) => {
    const { user, error } = await verifyAuthToken(request);
    
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get resource and check ownership
    const resource = await resourceGetter(request);
    if (resource.ownerId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    return handler(request, user);
  };
}
```

**UPDATE API ROUTES:**

```typescript
// VOOR (ONVEILIG):
export async function GET(request: NextRequest) {
  const email = request.searchParams.get('email');
  // ... fetch customer data
}

// NA (VEILIG):
export const GET = withAuth(async (request: NextRequest, user: User) => {
  // user is automatically authenticated
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  
  // Check if user can access this data
  if (email !== user.email && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // ... fetch customer data
});

// Admin routes:
export const GET = withAuth(async (request: NextRequest, user: User) => {
  // ...
}, { adminOnly: true });
```

**IMPACT:** 🔴 CRITICAL - Moet voor launch

---

### 🔐 PRIORITY 2: localStorage Cleanup

**PROBLEEM:**  
Auth state en data sync gebruiken nog localStorage caching.

**FILES:**

1. **`src/lib/auth.ts`** (Lines 398-433):
```typescript
// ❌ PROBLEEM: User data cached in localStorage
init: () => {
  const authData = localStorage.getItem('warmeleads-auth');
  if (authData) {
    const parsed = JSON.parse(authData);
    // ... restore user state from localStorage
  }
}

// ✅ OPLOSSING: Gebruik Supabase session of secure httpOnly cookie
init: async () => {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.user) {
    // Fetch full user profile from Supabase
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (data) {
      set({ 
        user: transformUser(data), 
        isAuthenticated: true 
      });
    }
  }
}
```

2. **`src/lib/dataSyncService.ts`** (Lines 213-222):
```typescript
// ❌ localStorage fallback
private async fetchFromLocalStorage(userEmail: string): Promise<Customer | null> {
  const { crmSystem } = require('./crmSystem');
  const customers = await crmSystem.getAllCustomers();
  // ...
}

// ✅ OPLOSSING: Remove fallback, Supabase is source of truth
// If API fails, show error instead of silently falling back
```

**ACTION ITEMS:**
- [ ] Replace localStorage auth cache with Supabase sessions
- [ ] Remove localStorage fallbacks in dataSyncService
- [ ] Add session refresh logic
- [ ] Clear localStorage on logout

---

### 🔓 PRIORITY 3: Input Validation

**GOED:** Auth routes hebben goede validation  
**VERBETERING NODIG:** Andere API routes

```typescript
// ❌ Minimale validation
export async function POST(req: NextRequest) {
  const { customerId, data } = await req.json();
  // Direct use zonder checks
}

// ✅ Zod schema validation
import { z } from 'zod';

const CustomerSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^[+]?[\d\s()-]+$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = CustomerSchema.parse(body);
    // Use validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
  }
}
```

---

## 🎨 DESIGN CONSISTENCY AUDIT

### PROBLEEM: 4 Verschillende Design Systems

1. **Landing Page** - Gradient purple/pink, rounded-2xl buttons
2. **Customer Portal** - White clean, rounded-lg, shadow-sm
3. **CRM Dashboard** - Glassmorphism, backdrop-blur, rounded-xl
4. **Admin Dashboard** - Corporate gray, shadow-md, rounded-lg

### OPLOSSING: Unified Design System

```typescript
// src/styles/design-tokens.ts (NIEUW)
export const tokens = {
  colors: {
    // Brand colors
    brand: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',  // Primary
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
    },
    // Semantic colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  
  spacing: {
    xs: '0.5rem',   // 8px
    sm: '0.75rem',  // 12px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
    '2xl': '3rem',  // 48px
  },
  
  radius: {
    sm: '0.5rem',   // 8px
    md: '0.75rem',  // 12px
    lg: '1rem',     // 16px
    full: '9999px',
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  },
  
  typography: {
    h1: 'text-4xl font-bold',
    h2: 'text-3xl font-semibold',
    h3: 'text-2xl font-semibold',
    body: 'text-base',
    small: 'text-sm',
    xs: 'text-xs',
  },
};
```

```typescript
// src/components/ui/Button.tsx (NIEUW)
import { tokens } from '@/styles/design-tokens';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
        outline: 'border-2 border-brand-600 text-brand-600 hover:bg-brand-50',
        ghost: 'text-brand-600 hover:bg-brand-50',
        danger: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm rounded-md',
        md: 'px-4 py-2 text-base rounded-lg',
        lg: 'px-6 py-3 text-lg rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export function Button({ 
  children, 
  variant, 
  size, 
  onClick, 
  type = 'button',
  disabled 
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={buttonVariants({ variant, size })}
    >
      {children}
    </button>
  );
}
```

**REFACTOR PLAN:**
1. **Week 1:** Create UI component library (Button, Card, Input, etc.)
2. **Week 2:** Refactor alle pages om nieuwe components te gebruiken
3. **Week 3:** Polish & testing

---

## ⚡ PERFORMANCE OPTIMIZATIONS

### 1. Code Splitting (CRITICAL)

```typescript
// ❌ VOOR: Alles wordt direct geladen
import { CustomerPortal } from '@/components/CustomerPortal';

// ✅ NA: Dynamic import
const CustomerPortal = dynamic(() => import('@/components/CustomerPortal'), {
  loading: () => <LoadingSpinner />,
  ssr: false, // Indien client-only component
});
```

**TARGETS:**
- CustomerPortal (846 lines)
- ChatInterface (700+ lines)
- All admin pages
- CRM Dashboard

**VERWACHTE IMPACT:** 40-50% snellere initial load

### 2. React Query voor Data Fetching

```bash
npm install @tanstack/react-query
```

```typescript
// src/hooks/useCustomers.ts (NIEUW)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/customers');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minuten cache
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
```

**VOORDELEN:**
- Automatische caching
- Background refetching
- Optimistic updates
- Request deduplication

### 3. Virtualization voor Grote Lijsten

```bash
npm install @tanstack/react-virtual
```

```typescript
// Voor customers lijst met 1000+ items
import { useVirtualizer } from '@tanstack/react-virtual';

export function CustomersList({ customers }: { customers: Customer[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: customers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Row height
  });
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <CustomerCard customer={customers[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## ♿ ACCESSIBILITY IMPROVEMENTS

### 1. ARIA Labels (Quick Win - 2 uur)

```typescript
// ❌ VOOR:
<UserIcon className="w-6 h-6" />

// ✅ NA:
<UserIcon className="w-6 h-6" aria-label="Gebruiker profiel" />
```

**TOOL:** Gebruik `eslint-plugin-jsx-a11y` om automatisch te checken

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:jsx-a11y/recommended"
  ],
  "plugins": ["jsx-a11y"]
}
```

### 2. Keyboard Navigation

```typescript
// Modal focus trap
import { useEffect, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export function Modal({ isOpen, onClose, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div
      role="dialog"
      aria-modal="true"
      ref={modalRef}
      className="modal"
    >
      <button 
        onClick={onClose}
        aria-label="Sluit modal"
        className="close-button"
      >
        <XMarkIcon />
      </button>
      {children}
    </div>
  );
}
```

---

## 🧪 TESTING STRATEGY

### Phase 1: Setup (1 dag)

```bash
# Install dependencies
npm install --save-dev \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  @playwright/test \
  jest \
  jest-environment-jsdom

# Setup Jest
npx jest --init
```

```javascript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
```

### Phase 2: Unit Tests (2 dagen)

**Priority test files:**

```typescript
// __tests__/lib/auth.test.ts
import { validatePassword, hashPassword } from '@/lib/auth';

describe('Authentication', () => {
  describe('validatePassword', () => {
    it('requires minimum 6 characters', () => {
      expect(validatePassword('12345')).toBe(false);
      expect(validatePassword('123456')).toBe(true);
    });
    
    it('requires letters and numbers', () => {
      expect(validatePassword('aaaaaa')).toBe(false);
      expect(validatePassword('123456')).toBe(false);
      expect(validatePassword('abc123')).toBe(true);
    });
  });
});

// __tests__/api/auth/login.test.ts
import { POST } from '@/app/api/auth/login/route';

describe('POST /api/auth/login', () => {
  it('returns 400 for missing credentials', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
  
  it('returns 401 for invalid credentials', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'wrongpass',
      }),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
```

### Phase 3: Integration Tests (1 dag)

```typescript
// __tests__/integration/checkout-flow.test.ts
describe('Checkout Flow', () => {
  it('completes full checkout process', async () => {
    // 1. User selects package
    // 2. Fills contact form
    // 3. Goes to checkout
    // 4. Completes payment
    // 5. Order is created
  });
});
```

### Phase 4: E2E Tests (2 dagen)

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can register and login', async ({ page }) => {
  // Register
  await page.goto('/');
  await page.click('text=Account aanmaken');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button:has-text("Registreren")');
  
  // Should redirect to portal
  await expect(page).toHaveURL('/portal');
  
  // Logout
  await page.click('[aria-label="Menu"]');
  await page.click('text=Uitloggen');
  
  // Login
  await page.goto('/');
  await page.click('text=Inloggen');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button:has-text("Inloggen")');
  
  // Should be at portal again
  await expect(page).toHaveURL('/portal');
});
```

---

## 📚 DOCUMENTATION IMPROVEMENTS

### 1. README.md Update

```markdown
# WarmeLeads Platform

Lead generation & CRM platform voor duurzame energie bedrijven.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- Stripe account (for payments)

### Installation
\`\`\`bash
git clone https://github.com/yourusername/warmeleads.git
cd warmeleads
npm install
\`\`\`

### Environment Setup
Copy \`.env.example\` to \`.env.local\` and fill in:
\`\`\`bash
cp .env.example .env.local
\`\`\`

Required variables:
- \`NEXT_PUBLIC_SUPABASE_URL\` - Your Supabase project URL
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` - Supabase anon key
- \`SUPABASE_SERVICE_ROLE_KEY\` - Supabase service role key (secret!)
- \`STRIPE_SECRET_KEY\` - Stripe secret key
- \`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY\` - Stripe publishable key

### Database Setup
1. Create Supabase project
2. Run SQL schema:
\`\`\`bash
psql $DATABASE_URL < supabase-schema-complete.sql
\`\`\`

### Development
\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Structure
\`\`\`
warmeleads/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── api/          # API routes
│   │   ├── admin/        # Admin dashboard
│   │   ├── crm/          # CRM dashboard
│   │   └── portal/       # Customer portal
│   ├── components/       # React components
│   ├── lib/              # Utility libraries
│   │   ├── auth.ts       # Authentication
│   │   ├── crmSystem.ts  # CRM logic
│   │   └── supabase.ts   # Supabase client
│   └── styles/           # Global styles
├── public/               # Static assets
└── supabase-schema-complete.sql  # Database schema
\`\`\`

## 🧪 Testing
\`\`\`bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
\`\`\`

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy!

### Environment Variables in Vercel
Go to Project Settings → Environment Variables and add all from \`.env.example\`

## 📖 Documentation
- [API Documentation](./docs/API.md)
- [Database Schema](./docs/DATABASE.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Contributing Guide](./docs/CONTRIBUTING.md)

## 🤝 Contributing
See [CONTRIBUTING.md](./docs/CONTRIBUTING.md)

## 📄 License
Proprietary - All rights reserved
\`\`\`

### 2. .env.example (NIEUW BESTAND)

```bash
# .env.example - Copy to .env.local and fill in values

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Resend)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@warmeleads.eu

# Google Sheets API
GOOGLE_SHEETS_API_KEY=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG...

# Admin
ADMIN_EMAILS=admin@warmeleads.eu,rick@warmeleads.eu

# Cron Jobs
CRON_SECRET=your_secret_for_cron_jobs

# Site
NEXT_PUBLIC_SITE_URL=https://www.warmeleads.eu

# Legacy (can be removed after full migration)
BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

---

## 🎯 IMPLEMENTATION ROADMAP

### PHASE 1: CRITICAL SECURITY (Week 1) 🔴

**Dagen 1-2: API Authentication**
- [ ] Create `src/middleware/auth.ts`
- [ ] Implement `withAuth()` wrapper
- [ ] Implement `withOwnershipCheck()`
- [ ] Update 20 most critical API routes
- [ ] Test authentication flow

**Dagen 3-4: localStorage Cleanup**
- [ ] Refactor `auth.ts` to use Supabase sessions
- [ ] Remove localStorage fallbacks in `dataSyncService.ts`
- [ ] Add session refresh logic
- [ ] Test auth persistence

**Dag 5: Input Validation**
- [ ] Install Zod
- [ ] Create validation schemas
- [ ] Apply to 10 most used API routes
- [ ] Test error handling

**DELIVERABLE:** Secure API layer + Auth zonder localStorage

---

### PHASE 2: DESIGN SYSTEM (Week 2) 🎨

**Dag 1: Design Tokens**
- [ ] Create `src/styles/design-tokens.ts`
- [ ] Define color palette
- [ ] Define spacing scale
- [ ] Define typography scale
- [ ] Update Tailwind config

**Dag 2-3: UI Components**
- [ ] Create `Button` component (+ variants)
- [ ] Create `Card` component
- [ ] Create `Input` / `TextArea` components
- [ ] Create `Modal` component
- [ ] Create `Badge` / `Chip` components

**Dag 4-5: Refactor Pages**
- [ ] Refactor Landing Page
- [ ] Refactor Customer Portal
- [ ] Refactor CRM Dashboard
- [ ] Refactor Admin Dashboard

**DELIVERABLE:** Consistent UI across all pages

---

### PHASE 3: PERFORMANCE (Week 3) ⚡

**Dag 1: Code Splitting**
- [ ] Add dynamic imports voor grote components
- [ ] Setup React.lazy voor routes
- [ ] Add loading skeletons
- [ ] Test bundle sizes

**Dag 2: React Query**
- [ ] Install React Query
- [ ] Create `useCustomers` hook
- [ ] Create `useOrders` hook
- [ ] Create `useLeads` hook
- [ ] Migrate API calls

**Dag 3: Virtualization**
- [ ] Install React Virtual
- [ ] Virtualize customers list
- [ ] Virtualize orders list
- [ ] Virtualize leads list

**Dag 4: Images & Assets**
- [ ] Optimize images (next/image)
- [ ] Add lazy loading
- [ ] Setup CDN for static assets

**Dag 5: Performance Testing**
- [ ] Lighthouse audit
- [ ] Bundle analyzer
- [ ] Performance benchmarks
- [ ] Fix issues

**DELIVERABLE:** 50%+ faster page loads

---

### PHASE 4: ACCESSIBILITY (Week 4) ♿

**Dag 1: ARIA Labels**
- [ ] Install eslint-plugin-jsx-a11y
- [ ] Fix all auto-detected issues
- [ ] Add labels to icons
- [ ] Add roles to elements

**Dag 2: Keyboard Navigation**
- [ ] Implement focus trap in modals
- [ ] Add keyboard shortcuts
- [ ] Test tab order
- [ ] Add skip links

**Dag 3: Color Contrast**
- [ ] Run Lighthouse accessibility
- [ ] Fix contrast issues
- [ ] Test with screen reader

**Dag 4: Forms**
- [ ] Add proper labels
- [ ] Add error announcements
- [ ] Add success messages
- [ ] Test with keyboard only

**Dag 5: Testing**
- [ ] Manual accessibility test
- [ ] Screen reader test
- [ ] Keyboard only test
- [ ] Lighthouse score >90

**DELIVERABLE:** WCAG 2.1 AA compliant

---

### PHASE 5: TESTING & QA (Week 5-6) 🧪

**Week 5: Setup + Unit Tests**
- [ ] Setup Jest + React Testing Library
- [ ] Setup Playwright
- [ ] Write auth tests
- [ ] Write API route tests
- [ ] Write utility function tests
- [ ] Achieve 60%+ coverage

**Week 6: Integration + E2E**
- [ ] Write checkout flow tests
- [ ] Write CRM workflow tests
- [ ] Write admin workflow tests
- [ ] Setup CI/CD pipeline
- [ ] Fix all failing tests

**DELIVERABLE:** 60%+ test coverage + CI/CD

---

### PHASE 6: DOCUMENTATION (Week 7) 📚

**Dag 1-2: Technical Docs**
- [ ] Update README.md
- [ ] Create API.md
- [ ] Create DATABASE.md
- [ ] Create ARCHITECTURE.md

**Dag 3: Developer Docs**
- [ ] Create CONTRIBUTING.md
- [ ] Create SETUP.md
- [ ] Create DEPLOYMENT.md

**Dag 4: User Docs**
- [ ] Customer portal guide
- [ ] CRM guide
- [ ] Admin guide

**Dag 5: Polish**
- [ ] Video tutorials?
- [ ] Screenshots
- [ ] FAQs
- [ ] Troubleshooting guide

**DELIVERABLE:** Complete documentation

---

## 💰 EFFORT & ROI

### Time Investment
- **Total:** ~7 weken (35 werkdagen)
- **Critical path:** 2 weken (Security + Core UX)
- **Nice to have:** 5 weken (Design, Performance, Testing, Docs)

### ROI per Phase

| Phase | Time | Business Impact | Technical Debt Reduction |
|-------|------|-----------------|-------------------------|
| Security | 1 week | 🔴 CRITICAL - Launch blocker | ⭐⭐⭐⭐⭐ |
| Design | 1 week | 🟢 HIGH - User satisfaction | ⭐⭐⭐⭐ |
| Performance | 1 week | 🟢 HIGH - Conversion rate | ⭐⭐⭐⭐ |
| Accessibility | 1 week | 🟡 MEDIUM - Market reach | ⭐⭐⭐ |
| Testing | 2 weeks | 🟡 MEDIUM - Confidence | ⭐⭐⭐⭐⭐ |
| Docs | 1 week | 🟢 MEDIUM - Team velocity | ⭐⭐⭐ |

### Minimal Viable Launch (MVP)

**Week 1-2 ONLY:**
- ✅ Security fixes
- ✅ Critical bugs
- ✅ Quick UI wins (color consistency)
- ✅ Basic tests

**Time:** 2 weken  
**Readiness:** 80% voor soft launch

---

## ✅ ACCEPTANCE CRITERIA

### Security ✅
- [ ] All API routes hebben auth
- [ ] Geen localStorage voor sensitive data
- [ ] Input validation op alle routes
- [ ] Security audit passed

### Design ✅
- [ ] Design system gedocumenteerd
- [ ] 90%+ components gebruiken tokens
- [ ] Consistent across all pages
- [ ] Mobile responsive

### Performance ✅
- [ ] Lighthouse score >90
- [ ] Initial load <3s
- [ ] Bundle size <500kb
- [ ] No performance warnings

### Accessibility ✅
- [ ] Lighthouse accessibility >90
- [ ] All images hebben alt text
- [ ] Keyboard navigation werkt
- [ ] Screen reader compatible

### Testing ✅
- [ ] 60%+ test coverage
- [ ] Critical paths E2E tested
- [ ] CI/CD pipeline actief
- [ ] No failing tests

### Documentation ✅
- [ ] README compleet
- [ ] API gedocumenteerd
- [ ] Setup <30 min voor nieuwe dev
- [ ] Deployment guide compleet

---

## 🚀 NEXT STEPS

1. **Review dit rapport** met team
2. **Prioriteer** welke phases nu
3. **Alloceer resources** (1-2 developers?)
4. **Start Week 1** (Security) - CRITICAL
5. **Itereer** op basis van feedback

---

**Questions?** Contact: rick@warmeleads.eu

*End of Audit Report - Ready for Implementation*

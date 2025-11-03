# 🎨 WarmeLeads Design Guidelines

## Brand Gradient - The ONE TRUE GRADIENT™

**IMPORTANT:** WarmeLeads heeft ÉÉN officiële gradient die **OVERAL** gebruikt moet worden.

### ✅ Correcte Gradient

```
from-brand-navy via-brand-purple to-brand-pink
```

**Hex Kleuren:**
- Navy: `#1A1A2E`
- Purple: `#3B2F75`
- Pink: `#E74C8C`

---

## Hoe te Gebruiken

### Optie 1: Tailwind Classes (Aanbevolen)

```tsx
<div className="bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
  Your content here
</div>
```

### Optie 2: Global CSS Class

```tsx
<div className="bg-brand-gradient">
  Your content here
</div>
```

### Optie 3: Via Constants (Type-Safe)

```tsx
import { BRAND_GRADIENT } from '@/lib/brandConstants';

<div className={BRAND_GRADIENT.tailwind}>
  Your content here
</div>
```

---

## ❌ NIET DOEN

**Gebruik NOOIT deze gradients:**
- ❌ `from-purple-900 via-indigo-900 to-blue-900`
- ❌ `from-purple-600 via-pink-600 to-orange-500`
- ❌ `from-brand-purple via-brand-pink to-brand-orange`
- ❌ Welke andere combinatie dan ook!

**Er is maar ÉÉN juiste gradient!**

---

## Waar Wordt Het Gebruikt?

De brand gradient moet gebruikt worden op:
- ✅ Homepage/Landing Page
- ✅ Alle CRM pagina's
- ✅ Portal pagina's
- ✅ Login/Register forms
- ✅ Product landing pages
- ✅ Blog pages
- ✅ Admin login
- ✅ Alle andere full-page backgrounds

---

## Checklist Voor Nieuwe Pagina's

Voordat je een nieuwe pagina maakt:

- [ ] Gebruikt de pagina `bg-brand-gradient` of de volledige Tailwind classes?
- [ ] Is de gradient `from-brand-navy via-brand-purple to-brand-pink`?
- [ ] Geen andere gradient gebruikt?
- [ ] Loading states gebruiken de `<Loading fullScreen />` component?

---

## Design System Components

Gebruik de volgende components voor consistentie:

```tsx
import { Button, Card, Input, Loading, Modal } from '@/components/ui';
import { BRAND_GRADIENT } from '@/lib/brandConstants';
```

Zie `/src/components/ui/DesignSystem.tsx` voor alle beschikbare components.

---

## Hulp Nodig?

Check deze bestanden:
- `/src/lib/brandConstants.ts` - Alle brand constants
- `/src/app/globals.css` - Global CSS classes
- `/src/components/ui/` - Design system components


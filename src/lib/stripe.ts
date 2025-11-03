import Stripe from 'stripe';

// Use live Stripe keys
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_for_build';

console.log('Stripe configuration:', {
  hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
  keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 8) + '...',
  nodeEnv: process.env.NODE_ENV,
  usingLiveKeys: process.env.NODE_ENV === 'production'
});

if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === 'production') {
  console.error('STRIPE_SECRET_KEY not found in production!');
} else if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not found, using dummy key for build');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-08-27.basil',
  typescript: true,
  timeout: 20000, // 20 seconds timeout
  maxNetworkRetries: 3,
});

export interface PricingTier {
  minQuantity: number;
  maxQuantity?: number;
  pricePerLead: number; // in cents
}

export interface LeadPackage {
  id: string;
  name: string;
  description: string;
  basePrice: number; // in cents
  price: number; // in cents
  currency: string;
  industry: string;
  type: 'exclusive' | 'shared_fresh' | 'bulk';
  quantity: number;
  minQuantity?: number;
  pricingTiers?: PricingTier[];
  features: string[];
  deliveryTime: string;
  deliveryMethod: string;
}

// Helper function to calculate 1/3 of exclusive price
function getSharedPrice(exclusivePrice: number): number {
  return Math.round(exclusivePrice / 3);
}

export const leadPackages: Record<string, LeadPackage[]> = {
  'Test': [
    {
      id: 'test_exclusive',
      name: '🧪 Test Exclusieve Leads',
      description: 'Test exclusieve leads - €0,01 per lead voor het testen van de betaalflow',
      basePrice: 1,
      price: 1,
      currency: 'eur',
      industry: 'Test',
      type: 'exclusive',
      quantity: 1,
      minQuantity: 1,
      pricingTiers: [{ minQuantity: 1, pricePerLead: 1 }],
      features: ['🧪 TEST MODUS', '€0,01 per lead', 'Minimum 1 lead'],
      deliveryTime: 'Direct',
      deliveryMethod: 'Portal'
    }
  ],
  'Thuisbatterijen': [
    {
      id: 'thuisbatterij_exclusive',
      name: '💎 Verse Exclusieve Thuisbatterij Leads',
      description: '100% exclusieve verse thuisbatterij leads uit eigen campagnes',
      basePrice: 4250,
      price: 4250,
      currency: 'eur',
      industry: 'Thuisbatterijen',
      type: 'exclusive',
      quantity: 30,
      minQuantity: 30,
      pricingTiers: [
        { minQuantity: 30, maxQuantity: 49, pricePerLead: 4250 }, // €42.50
        { minQuantity: 50, maxQuantity: 74, pricePerLead: 4000 }, // €40.00
        { minQuantity: 75, pricePerLead: 3750 }, // €37.50
      ],
      features: [
        '💎 100% exclusief voor u',
        '⚡ Campagnes starten binnen 24u',
        '📊 Real-time in uw persoonlijk portal',
        '🎯 Geen concurrentie',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 25-40% conversie'
      ],
      deliveryTime: 'Campagnes binnen 24u, leads real-time',
      deliveryMethod: 'Persoonlijk CRM Portal'
    },
    {
      id: 'thuisbatterij_shared_fresh',
      name: '🤝 Gedeelde Verse Thuisbatterij Leads',
      description: 'Verse thuisbatterij leads uit eigen campagnes (gedeeld met 2 anderen)',
      basePrice: 1417, // €14.17 (1/3 van €42.50)
      price: 1417,
      currency: 'eur',
      industry: 'Thuisbatterijen',
      type: 'shared_fresh',
      quantity: 250,
      minQuantity: 250,
      features: [
        '🤝 Gedeeld met 3 partijen totaal',
        '⚡ Verse leads uit campagnes',
        '💰 1/3 van de prijs van exclusief',
        '📧 Excel binnen 24u per email',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 15-25% conversie'
      ],
      deliveryTime: 'Binnen 24u per email',
      deliveryMethod: 'Excel bestand'
    },
    {
      id: 'thuisbatterij_bulk',
      name: '📦 Bulk Thuisbatterij Leads',
      description: 'Thuisbatterij leads uit onze database (tot 6 maanden oud)',
      basePrice: 425, // €4.25 for 100
      price: 425,
      currency: 'eur',
      industry: 'Thuisbatterijen',
      type: 'bulk',
      quantity: 100,
      minQuantity: 100,
      pricingTiers: [
        { minQuantity: 100, maxQuantity: 199, pricePerLead: 425 }, // €4.25
        { minQuantity: 200, maxQuantity: 299, pricePerLead: 400 }, // €4.00
        { minQuantity: 300, maxQuantity: 499, pricePerLead: 375 }, // €3.75
        { minQuantity: 500, pricePerLead: 350 }, // €3.50
      ],
      features: [
        '📦 Database leads (tot 6 mnd oud)',
        '💰 Laagste prijs per lead',
        '📧 Excel binnen 24u per email',
        '🎯 Ideaal voor grote volumes',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 5-10% conversie'
      ],
      deliveryTime: 'Binnen 24u per email',
      deliveryMethod: 'Excel bestand'
    }
  ],
  'Zonnepanelen': [
    {
      id: 'zonnepanelen_exclusive',
      name: '💎 Verse Exclusieve Zonnepanelen Leads',
      description: '100% exclusieve verse zonnepanelen leads uit eigen campagnes',
      basePrice: 4500,
      price: 4500,
      currency: 'eur',
      industry: 'Zonnepanelen',
      type: 'exclusive',
      quantity: 30,
      minQuantity: 30,
      pricingTiers: [
        { minQuantity: 30, maxQuantity: 49, pricePerLead: 4500 }, // €45.00
        { minQuantity: 50, maxQuantity: 74, pricePerLead: 4250 }, // €42.50
        { minQuantity: 75, pricePerLead: 4000 }, // €40.00
      ],
      features: [
        '💎 100% exclusief voor u',
        '⚡ Campagnes starten binnen 24u',
        '📊 Real-time in uw persoonlijk portal',
        '🎯 Geen concurrentie',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 25-40% conversie'
      ],
      deliveryTime: 'Campagnes binnen 24u, leads real-time',
      deliveryMethod: 'Persoonlijk CRM Portal'
    },
    {
      id: 'zonnepanelen_shared_fresh',
      name: '🤝 Gedeelde Verse Zonnepanelen Leads',
      description: 'Verse zonnepanelen leads uit eigen campagnes (gedeeld met 2 anderen)',
      basePrice: 1500, // €15.00 (1/3 van €45.00)
      price: 1500,
      currency: 'eur',
      industry: 'Zonnepanelen',
      type: 'shared_fresh',
      quantity: 250,
      minQuantity: 250,
      features: [
        '🤝 Gedeeld met 3 partijen totaal',
        '⚡ Verse leads uit campagnes',
        '💰 1/3 van de prijs van exclusief',
        '📧 Excel binnen 24u per email',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 15-25% conversie'
      ],
      deliveryTime: 'Binnen 24u per email',
      deliveryMethod: 'Excel bestand'
    },
    {
      id: 'zonnepanelen_bulk',
      name: '📦 Bulk Zonnepanelen Leads',
      description: 'Zonnepanelen leads uit onze database (tot 6 maanden oud)',
      basePrice: 425,
      price: 425,
      currency: 'eur',
      industry: 'Zonnepanelen',
      type: 'bulk',
      quantity: 100,
      minQuantity: 100,
      pricingTiers: [
        { minQuantity: 100, maxQuantity: 199, pricePerLead: 425 },
        { minQuantity: 200, maxQuantity: 299, pricePerLead: 400 },
        { minQuantity: 300, maxQuantity: 499, pricePerLead: 375 },
        { minQuantity: 500, pricePerLead: 350 },
      ],
      features: [
        '📦 Database leads (tot 6 mnd oud)',
        '💰 Laagste prijs per lead',
        '📧 Excel binnen 24u per email',
        '🎯 Ideaal voor grote volumes',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 5-10% conversie'
      ],
      deliveryTime: 'Binnen 24u per email',
      deliveryMethod: 'Excel bestand'
    }
  ],
  'Warmtepompen': [
    {
      id: 'warmtepomp_exclusive',
      name: '💎 Verse Exclusieve Warmtepomp Leads',
      description: '100% exclusieve verse warmtepomp leads uit eigen campagnes',
      basePrice: 5000,
      price: 5000,
      currency: 'eur',
      industry: 'Warmtepompen',
      type: 'exclusive',
      quantity: 30,
      minQuantity: 30,
      pricingTiers: [
        { minQuantity: 30, maxQuantity: 49, pricePerLead: 5000 }, // €50.00
        { minQuantity: 50, maxQuantity: 74, pricePerLead: 4750 }, // €47.50
        { minQuantity: 75, pricePerLead: 4500 }, // €45.00
      ],
      features: [
        '💎 100% exclusief voor u',
        '⚡ Campagnes starten binnen 24u',
        '📊 Real-time in uw persoonlijk portal',
        '🎯 Geen concurrentie',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 25-40% conversie'
      ],
      deliveryTime: 'Campagnes binnen 24u, leads real-time',
      deliveryMethod: 'Persoonlijk CRM Portal'
    },
    {
      id: 'warmtepomp_shared_fresh',
      name: '🤝 Gedeelde Verse Warmtepomp Leads',
      description: 'Verse warmtepomp leads uit eigen campagnes (gedeeld met 2 anderen)',
      basePrice: 1667, // €16.67 (1/3 van €50.00)
      price: 1667,
      currency: 'eur',
      industry: 'Warmtepompen',
      type: 'shared_fresh',
      quantity: 250,
      minQuantity: 250,
      features: [
        '🤝 Gedeeld met 3 partijen totaal',
        '⚡ Verse leads uit campagnes',
        '💰 1/3 van de prijs van exclusief',
        '📧 Excel binnen 24u per email',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 15-25% conversie'
      ],
      deliveryTime: 'Binnen 24u per email',
      deliveryMethod: 'Excel bestand'
    },
    {
      id: 'warmtepomp_bulk',
      name: '📦 Bulk Warmtepomp Leads',
      description: 'Warmtepomp leads uit onze database (tot 6 maanden oud)',
      basePrice: 425,
      price: 425,
      currency: 'eur',
      industry: 'Warmtepompen',
      type: 'bulk',
      quantity: 100,
      minQuantity: 100,
      pricingTiers: [
        { minQuantity: 100, maxQuantity: 199, pricePerLead: 425 },
        { minQuantity: 200, maxQuantity: 299, pricePerLead: 400 },
        { minQuantity: 300, maxQuantity: 499, pricePerLead: 375 },
        { minQuantity: 500, pricePerLead: 350 },
      ],
      features: [
        '📦 Database leads (tot 6 mnd oud)',
        '💰 Laagste prijs per lead',
        '📧 Excel binnen 24u per email',
        '🎯 Ideaal voor grote volumes',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 5-10% conversie'
      ],
      deliveryTime: 'Binnen 24u per email',
      deliveryMethod: 'Excel bestand'
    }
  ],
  'Airco': [
    {
      id: 'airco_exclusive',
      name: '💎 Verse Exclusieve Airco Leads',
      description: '100% exclusieve verse airco leads uit eigen campagnes',
      basePrice: 4000,
      price: 4000,
      currency: 'eur',
      industry: 'Airco',
      type: 'exclusive',
      quantity: 30,
      minQuantity: 30,
      pricingTiers: [
        { minQuantity: 30, maxQuantity: 49, pricePerLead: 4000 }, // €40.00
        { minQuantity: 50, maxQuantity: 74, pricePerLead: 3750 }, // €37.50
        { minQuantity: 75, pricePerLead: 3500 }, // €35.00
      ],
      features: [
        '💎 100% exclusief voor u',
        '⚡ Campagnes starten binnen 24u',
        '📊 Real-time in uw persoonlijk portal',
        '🎯 Geen concurrentie',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 25-40% conversie'
      ],
      deliveryTime: 'Campagnes binnen 24u, leads real-time',
      deliveryMethod: 'Persoonlijk CRM Portal'
    },
    {
      id: 'airco_shared_fresh',
      name: '🤝 Gedeelde Verse Airco Leads',
      description: 'Verse airco leads uit eigen campagnes (gedeeld met 2 anderen)',
      basePrice: 1333, // €13.33 (1/3 van €40.00)
      price: 1333,
      currency: 'eur',
      industry: 'Airco',
      type: 'shared_fresh',
      quantity: 250,
      minQuantity: 250,
      features: [
        '🤝 Gedeeld met 3 partijen totaal',
        '⚡ Verse leads uit campagnes',
        '💰 1/3 van de prijs van exclusief',
        '📧 Excel binnen 24u per email',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 15-25% conversie'
      ],
      deliveryTime: 'Binnen 24u per email',
      deliveryMethod: 'Excel bestand'
    },
    {
      id: 'airco_bulk',
      name: '📦 Bulk Airco Leads',
      description: 'Airco leads uit onze database (tot 6 maanden oud)',
      basePrice: 425,
      price: 425,
      currency: 'eur',
      industry: 'Airco',
      type: 'bulk',
      quantity: 100,
      minQuantity: 100,
      pricingTiers: [
        { minQuantity: 100, maxQuantity: 199, pricePerLead: 425 },
        { minQuantity: 200, maxQuantity: 299, pricePerLead: 400 },
        { minQuantity: 300, maxQuantity: 499, pricePerLead: 375 },
        { minQuantity: 500, pricePerLead: 350 },
      ],
      features: [
        '📦 Database leads (tot 6 mnd oud)',
        '💰 Laagste prijs per lead',
        '📧 Excel binnen 24u per email',
        '🎯 Ideaal voor grote volumes',
        '🇳🇱🇧🇪 Nederlandse & Belgische prospects',
        '📈 5-10% conversie'
      ],
      deliveryTime: 'Binnen 24u per email',
      deliveryMethod: 'Excel bestand'
    }
  ],
  'Financial Lease': [
    {
      id: 'lease_exclusive',
      name: '💎 Verse Exclusieve Financial Lease Leads',
      description: '100% exclusieve verse financial lease leads uit eigen campagnes',
      basePrice: 5500,
      price: 5500,
      currency: 'eur',
      industry: 'Financial Lease',
      type: 'exclusive',
      quantity: 30,
      minQuantity: 30,
      pricingTiers: [
        { minQuantity: 30, maxQuantity: 49, pricePerLead: 5500 }, // €55.00
        { minQuantity: 50, maxQuantity: 74, pricePerLead: 5000 }, // €50.00
        { minQuantity: 75, pricePerLead: 4500 }, // €45.00
      ],
      features: [
        '💎 100% exclusief voor u',
        '⚡ Campagnes starten binnen 24u',
        '📊 Real-time in uw persoonlijk portal',
        '🎯 Geen concurrentie',
        '🇳🇱🇧🇪 Nederlandse & Belgische zakelijke prospects',
        '📈 25-40% conversie'
      ],
      deliveryTime: 'Campagnes binnen 24u, leads real-time',
      deliveryMethod: 'Persoonlijk CRM Portal'
    },
    {
      id: 'lease_shared_fresh',
      name: '🤝 Gedeelde Verse Financial Lease Leads',
      description: 'Verse financial lease leads uit eigen campagnes (gedeeld met 2 anderen)',
      basePrice: 1833, // €18.33 (1/3 van €55.00)
      price: 1833,
      currency: 'eur',
      industry: 'Financial Lease',
      type: 'shared_fresh',
      quantity: 250,
      minQuantity: 250,
      features: [
        '🤝 Gedeeld met 3 partijen totaal',
        '⚡ Verse leads uit campagnes',
        '💰 1/3 van de prijs van exclusief',
        '📧 Excel binnen 24u per email',
        '🇳🇱🇧🇪 Nederlandse & Belgische zakelijke prospects',
        '📈 15-25% conversie'
      ],
      deliveryTime: 'Binnen 24u per email',
      deliveryMethod: 'Excel bestand'
    },
    {
      id: 'lease_bulk',
      name: '📦 Bulk Financial Lease Leads',
      description: 'Financial lease leads uit onze database (tot 6 maanden oud)',
      basePrice: 425,
      price: 425,
      currency: 'eur',
      industry: 'Financial Lease',
      type: 'bulk',
      quantity: 100,
      minQuantity: 100,
      pricingTiers: [
        { minQuantity: 100, maxQuantity: 199, pricePerLead: 425 },
        { minQuantity: 200, maxQuantity: 299, pricePerLead: 400 },
        { minQuantity: 300, maxQuantity: 499, pricePerLead: 375 },
        { minQuantity: 500, pricePerLead: 350 },
      ],
      features: [
        '📦 Database leads (tot 6 mnd oud)',
        '💰 Laagste prijs per lead',
        '📧 Excel binnen 24u per email',
        '🎯 Ideaal voor grote volumes',
        '🇳🇱🇧🇪 Nederlandse & Belgische zakelijke prospects',
        '📈 5-10% conversie'
      ],
      deliveryTime: 'Binnen 24u per email',
      deliveryMethod: 'Excel bestand'
    }
  ]
};

export async function createPaymentIntent(
  packageId: string,
  quantity: number = 1,
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
  }
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  try {
    const allPackages = Object.values(leadPackages).flat();
    const selectedPackage = allPackages.find(pkg => pkg.id === packageId);
    
    if (!selectedPackage) {
      throw new Error('Package not found');
    }

    const pricing = calculatePackagePrice(selectedPackage, quantity);
    const totalAmount = pricing.totalPrice;

    let customer;
    const existingCustomers = await stripe.customers.list({
      email: customerInfo.email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        name: customerInfo.name,
        email: customerInfo.email,
        phone: customerInfo.phone,
        metadata: {
          company: customerInfo.company || '',
        },
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: selectedPackage.currency,
      customer: customer.id,
      metadata: {
        packageId,
        quantity: quantity.toString(),
        industry: selectedPackage.industry,
        type: selectedPackage.type,
        customerName: customerInfo.name,
        customerCompany: customerInfo.company || '',
      },
      description: `${selectedPackage.name} x${quantity}`,
      receipt_email: customerInfo.email,
      shipping: {
        name: customerInfo.name,
        address: {
          line1: 'Digital Delivery',
          city: 'Online',
          country: 'NL',
        },
      },
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
}

export async function handleSuccessfulPayment(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      const orderData = {
        paymentIntentId,
        customerId: paymentIntent.customer as string,
        packageId: paymentIntent.metadata.packageId,
        quantity: parseInt(paymentIntent.metadata.quantity),
        industry: paymentIntent.metadata.industry,
        type: paymentIntent.metadata.type,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        customerName: paymentIntent.metadata.customerName,
        customerCompany: paymentIntent.metadata.customerCompany,
        createdAt: new Date(paymentIntent.created * 1000),
      };

      console.log('Order processed:', orderData);
      
      return orderData;
    }
    
    return null;
  } catch (error) {
    console.error('Error handling successful payment:', error);
    throw error;
  }
}

export function calculateDiscount(
  originalPrice: number,
  discountPercentage: number
): { discountedPrice: number; savings: number } {
  const savings = Math.round(originalPrice * (discountPercentage / 100));
  const discountedPrice = originalPrice - savings;
  
  return {
    discountedPrice,
    savings,
  };
}

export function formatPrice(amountInCents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
  }).format(amountInCents / 100);
}

export function calculatePackagePrice(pkg: LeadPackage, quantity: number): { pricePerLead: number; totalPrice: number; tierInfo?: string } {
  // For shared_fresh leads, quantity is fixed
  if (pkg.type === 'shared_fresh') {
    const totalPrice = pkg.price * pkg.quantity;
    return {
      pricePerLead: pkg.price,
      totalPrice,
      tierInfo: `Vaste batch van ${pkg.quantity} verse gedeelde leads`
    };
  }
  
  // For exclusive and bulk leads, use pricing tiers
  if (pkg.pricingTiers && pkg.pricingTiers.length > 0) {
    const tier = pkg.pricingTiers.find(t => {
      if (t.maxQuantity) {
        return quantity >= t.minQuantity && quantity <= t.maxQuantity;
      }
      return quantity >= t.minQuantity;
    });
    
    if (tier) {
      const totalPrice = tier.pricePerLead * quantity;
      let tierInfo = '';
      
      if (tier.maxQuantity) {
        tierInfo = `${formatPrice(tier.pricePerLead)} per lead (${tier.minQuantity}-${tier.maxQuantity} leads)`;
      } else {
        tierInfo = `${formatPrice(tier.pricePerLead)} per lead (${tier.minQuantity}+ leads)`;
      }
      
      return {
        pricePerLead: tier.pricePerLead,
        totalPrice,
        tierInfo
      };
    }
  }
  
  // Fallback to base price
  const totalPrice = pkg.price * quantity;
  return {
    pricePerLead: pkg.price,
    totalPrice,
    tierInfo: `${formatPrice(pkg.price)} per lead`
  };
}

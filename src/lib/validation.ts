/**
 * INPUT VALIDATION SCHEMAS
 * 
 * Zod schemas voor API route input validation.
 * Voorkomt invalid data en security issues.
 */

import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================

export const emailSchema = z.string().email('Ongeldig e-mailadres');

export const phoneSchema = z.string()
  .regex(/^[+]?[\d\s()-]+$/, 'Ongeldig telefoonnummer')
  .min(10, 'Telefoonnummer te kort')
  .max(20, 'Telefoonnummer te lang');

export const passwordSchema = z.string()
  .min(6, 'Wachtwoord moet minimaal 6 karakters zijn')
  .regex(/[a-zA-Z]/, 'Wachtwoord moet letters bevatten')
  .regex(/[0-9]/, 'Wachtwoord moet cijfers bevatten');

export const uuidSchema = z.string().uuid('Ongeldige ID');

export const nameSchema = z.string()
  .min(1, 'Naam is verplicht')
  .max(100, 'Naam te lang')
  .trim();

export const companySchema = z.string()
  .min(1, 'Bedrijfsnaam is verplicht')
  .max(200, 'Bedrijfsnaam te lang')
  .trim();

// ============================================
// AUTH SCHEMAS
// ============================================

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  company: companySchema,
  phone: phoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Wachtwoord is verplicht'),
});

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  company: companySchema.optional(),
  phone: phoneSchema.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Huidig wachtwoord is verplicht'),
  newPassword: passwordSchema,
});

// ============================================
// CUSTOMER SCHEMAS
// ============================================

export const customerSchema = z.object({
  email: emailSchema,
  name: nameSchema.optional(),
  phone: phoneSchema.optional(),
  company: companySchema.optional(),
  status: z.enum(['lead', 'contacted', 'customer', 'inactive']).optional(),
  source: z.enum(['chat', 'direct', 'landing_page']).optional(),
});

export const updateCustomerSchema = z.object({
  customerId: uuidSchema,
  customerData: z.object({
    name: nameSchema.optional(),
    phone: phoneSchema.optional(),
    company: companySchema.optional(),
    status: z.enum(['lead', 'contacted', 'customer', 'inactive']).optional(),
    googleSheetId: z.string().optional(),
    googleSheetUrl: z.string().url('Ongeldige URL').optional(),
    hasAccount: z.boolean().optional(),
    emailNotifications: z.object({
      enabled: z.boolean().optional(),
      newLeads: z.boolean().optional(),
    }).optional(),
  }),
});

// ============================================
// LEAD SCHEMAS
// ============================================

export const leadSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company: companySchema.optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  interest: z.string().min(1, 'Interest is verplicht'),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'deal_closed', 'lost']).optional(),
  dealValue: z.number().positive().optional(),
  profit: z.number().optional(),
  assignedTo: z.string().optional(),
  source: z.enum(['campaign', 'manual', 'import']).optional(),
});

export const updateLeadSchema = z.object({
  leadId: uuidSchema,
  updates: z.object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'deal_closed', 'lost']).optional(),
    notes: z.string().max(1000).optional(),
    dealValue: z.number().positive().optional(),
    profit: z.number().optional(),
  }),
});

// ============================================
// ORDER SCHEMAS
// ============================================

export const createOrderSchema = z.object({
  customerId: uuidSchema.optional(),
  customerEmail: emailSchema,
  customerName: nameSchema,
  packageId: z.string().min(1),
  packageName: z.string().min(1),
  industry: z.string().min(1),
  leadType: z.enum(['exclusive', 'shared']),
  quantity: z.number().int().positive(),
  pricePerLead: z.number().positive(),
  totalAmount: z.number().positive(),
});

export const updateOrderSchema = z.object({
  orderId: uuidSchema,
  status: z.enum(['pending', 'completed', 'cancelled', 'processing']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  deliveredAt: z.string().datetime().optional(),
});

// ============================================
// INVOICE SCHEMAS
// ============================================

export const createInvoiceSchema = z.object({
  customerEmail: emailSchema,
  industry: z.string().min(1),
  leadType: z.string().min(1),
  quantity: z.string().regex(/\d+/).transform(s => parseInt(s)),
  amount: z.string().regex(/[\d.,]+/).transform(s => parseFloat(s.replace(/[.,]/g, ''))),
});

// ============================================
// GOOGLE SHEETS SCHEMAS
// ============================================

export const googleSheetUrlSchema = z.string()
  .url('Ongeldige URL')
  .regex(/docs\.google\.com\/spreadsheets/, 'Moet een Google Sheets URL zijn');

export const linkSheetSchema = z.object({
  email: emailSchema,
  sheetUrl: googleSheetUrlSchema,
});

// ============================================
// PREFERENCES SCHEMAS
// ============================================

export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  emailNotifications: z.boolean().optional(),
  newLeadNotifications: z.boolean().optional(),
  weeklyReports: z.boolean().optional(),
  language: z.enum(['nl', 'en']).optional(),
});

// ============================================
// PAYMENT SCHEMAS
// ============================================

export const createCheckoutSchema = z.object({
  customerId: uuidSchema.optional(),
  customerEmail: emailSchema,
  packageId: z.string().min(1),
  quantity: z.number().int().positive(),
  amount: z.number().positive(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// ============================================
// WHATSAPP SCHEMAS
// ============================================

export const whatsappConfigSchema = z.object({
  enabled: z.boolean(),
  businessName: z.string().min(1).max(100),
  phoneNumber: phoneSchema.optional(),
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  messagingServiceSid: z.string().optional(),
});

export const sendWhatsAppSchema = z.object({
  to: phoneSchema,
  customerName: nameSchema,
  leadUrl: z.string().url(),
  templateType: z.enum(['new_lead', 'lead_update', 'custom']).optional(),
});

// ============================================
// ADMIN SCHEMAS
// ============================================

export const inviteEmployeeSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  role: z.enum(['employee', 'admin']),
  permissions: z.object({
    canViewLeads: z.boolean(),
    canViewOrders: z.boolean(),
    canManageEmployees: z.boolean(),
    canCheckout: z.boolean(),
  }),
});

// ============================================
// PAGINATION & FILTERS
// ============================================

export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1)).default(() => 1),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).default(() => 50),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate request body with Zod schema
 * Returns validated data or throws validation error
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Validation failed',
        error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      );
    }
    throw error;
  }
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQueryParams<T>(
  url: string,
  schema: z.ZodSchema<T>
): T {
  try {
    const { searchParams } = new URL(url);
    const params = Object.fromEntries(searchParams.entries());
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Invalid query parameters',
        error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      );
    }
    throw error;
  }
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(error: z.ZodError) {
  return {
    error: 'Validation failed',
    details: error.issues.map(e => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code
    }))
  };
}


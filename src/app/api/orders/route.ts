import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withAuth, withOptionalAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

export interface Order {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  customerCompany?: string;
  packageId: string;
  packageName: string;
  industry: string;
  leadType: 'exclusive' | 'shared';
  quantity: number;
  pricePerLead: number;
  totalAmount: number;
  vatAmount: number;
  totalAmountInclVAT: number;
  vatPercentage: number;
  currency: string;
  status: 'pending' | 'completed' | 'delivered' | 'cancelled';
  paymentMethod: string;
  paymentIntentId?: string;
  sessionId?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  createdAt: string;
  deliveredAt?: string;
  leads?: number;
  conversions?: number;
}

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

// GET - Fetch orders for a customer (AUTHENTICATED)
export const GET = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(req.url);
    const customerEmail = searchParams.get('customerEmail');

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email is required' },
        { status: 400 }
      );
    }

    // Security: User can only fetch their own orders (unless admin)
    if (customerEmail !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only access your own orders' },
        { status: 403 }
      );
    }

    console.log('📦 Fetching orders for customer:', customerEmail);

    const supabase = createServerClient();

    // Fetch orders from Supabase
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_email', customerEmail)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching orders from Supabase:', error);
      return NextResponse.json(
        { error: 'Failed to fetch orders', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${orders?.length || 0} order(s) for customer:`, customerEmail);

    // Transform to match expected format
    const transformedOrders: Order[] = (orders || []).map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      customerCompany: order.customer_company,
      packageId: order.package_id,
      packageName: order.package_name,
      industry: order.industry,
      leadType: order.lead_type as 'exclusive' | 'shared',
      quantity: order.quantity,
      pricePerLead: order.price_per_lead,
      totalAmount: order.total_amount,
      vatAmount: order.vat_amount,
      totalAmountInclVAT: order.total_amount_incl_vat,
      vatPercentage: order.vat_percentage,
      currency: order.currency || 'EUR',
      status: order.status,
      paymentMethod: order.payment_method || '',
      paymentIntentId: order.payment_intent_id,
      sessionId: order.session_id,
      invoiceNumber: order.invoice_number,
      invoiceUrl: order.invoice_url,
      createdAt: order.created_at,
      deliveredAt: order.delivered_at,
      leads: order.leads_delivered,
      conversions: order.conversions,
    }));

    return NextResponse.json({ orders: transformedOrders });
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});

// POST - Create a new order (AUTHENTICATED)
export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await req.json();
    const { order } = body as { order: Order };

    if (!order || !order.customerEmail) {
      return NextResponse.json(
        { error: 'Order data with customerEmail is required' },
        { status: 400 }
      );
    }

    // Security: User can only create orders for themselves (unless admin)
    if (order.customerEmail !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only create orders for yourself' },
        { status: 403 }
      );
    }

    console.log('📦 Creating new order:', order.orderNumber);

    const supabase = createServerClient();

    // Insert order into Supabase
    const { data: newOrder, error } = await supabase
      .from('orders')
      .insert({
        order_number: order.orderNumber,
        customer_email: order.customerEmail,
        customer_name: order.customerName,
        customer_company: order.customerCompany,
        package_id: order.packageId,
        package_name: order.packageName,
        industry: order.industry,
        lead_type: order.leadType,
        quantity: order.quantity,
        price_per_lead: order.pricePerLead,
        total_amount: order.totalAmount,
        vat_amount: order.vatAmount,
        total_amount_incl_vat: order.totalAmountInclVAT,
        vat_percentage: order.vatPercentage,
        currency: order.currency || 'EUR',
        status: order.status || 'pending',
        payment_method: order.paymentMethod,
        payment_intent_id: order.paymentIntentId,
        session_id: order.sessionId,
        stripe_session_id: order.sessionId, // Legacy field
        stripe_payment_intent_id: order.paymentIntentId, // Legacy field
        invoice_number: order.invoiceNumber,
        invoice_url: order.invoiceUrl,
        leads_delivered: order.leads || 0,
        conversions: order.conversions || 0,
        delivered_at: order.deliveredAt,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating order in Supabase:', error);
      return NextResponse.json(
        { error: 'Failed to create order', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Order created successfully:', newOrder.order_number);

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        id: newOrder.id,
      }
    });
  } catch (error) {
    console.error('❌ Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});

// PUT - Update an existing order (AUTHENTICATED + ADMIN ONLY)
export const PUT = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await req.json();
    const { orderNumber, updates } = body;

    if (!orderNumber || !updates) {
      return NextResponse.json(
        { error: 'Order number and updates are required' },
        { status: 400 }
      );
    }

    // Only admins can update orders
    if (!isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin only' },
        { status: 403 }
      );
    }

    console.log('📦 Updating order:', orderNumber);

    const supabase = createServerClient();

    // Build update object
    const updateData: any = {};
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.leads !== undefined) updateData.leads_delivered = updates.leads;
    if (updates.conversions !== undefined) updateData.conversions = updates.conversions;
    if (updates.deliveredAt !== undefined) updateData.delivered_at = updates.deliveredAt;
    if (updates.invoiceNumber !== undefined) updateData.invoice_number = updates.invoiceNumber;
    if (updates.invoiceUrl !== undefined) updateData.invoice_url = updates.invoiceUrl;

    // Update order in Supabase
    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('order_number', orderNumber)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating order in Supabase:', error);
      return NextResponse.json(
        { error: 'Failed to update order', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Order updated successfully:', orderNumber);

    return NextResponse.json({
      success: true,
      order: updatedOrder
    });
  } catch (error) {
    console.error('❌ Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}, { adminOnly: true });

// DELETE - Delete an order (ADMIN ONLY)
export const DELETE = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(req.url);
    const orderNumber = searchParams.get('orderNumber');

    if (!orderNumber) {
      return NextResponse.json(
        { error: 'Order number is required' },
        { status: 400 }
      );
    }

    console.log('🗑️ Deleting order:', orderNumber);

    const supabase = createServerClient();

    // Delete order from Supabase
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('order_number', orderNumber);

    if (error) {
      console.error('❌ Error deleting order from Supabase:', error);
      return NextResponse.json(
        { error: 'Failed to delete order', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Order deleted successfully:', orderNumber);

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}, { adminOnly: true });

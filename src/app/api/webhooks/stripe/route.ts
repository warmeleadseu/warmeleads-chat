import { NextRequest, NextResponse } from 'next/server';
import { stripe, handleSuccessfulPayment, formatPrice } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase';
import { generateInvoiceNumber, generateInvoiceHTML, type InvoiceData } from '@/lib/invoiceGenerator';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    // Debug logging
    console.log('🔔 Webhook received');
    console.log('📋 Has webhook secret:', !!webhookSecret);
    console.log('🔑 Secret length:', webhookSecret?.length || 0);
    console.log('🔑 Secret prefix:', webhookSecret?.substring(0, 10) || 'undefined');
    
    if (!webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET is not set!');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }
    
    const body = await req.text();
    const signature = req.headers.get('stripe-signature')!;
    
    console.log('📝 Body length:', body.length);
    console.log('✍️ Has signature:', !!signature);

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('✅ Signature verified successfully');
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      console.error('Error details:', err instanceof Error ? err.message : 'Unknown error');
      return NextResponse.json(
        { error: 'Webhook signature verification failed', details: err instanceof Error ? err.message : 'Unknown' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', paymentIntent.id);
        
        // Process the successful payment
        await handleSuccessfulPayment(paymentIntent.id);
        
        // Send lead delivery notification
        await sendLeadDeliveryNotification(paymentIntent);
        
        // Add to admin dashboard
        await addOrderToAdmin(paymentIntent);
        
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', paymentIntent.id);
        
        // Handle failed payment
        await handleFailedPayment(paymentIntent);
        
        break;
      }
      
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('✅ Checkout session completed:', session.id);
        
        // Save order to Blob Storage (this also generates PDF invoice)
        const order = await saveOrderFromSession(session);
        
        // Generate and send invoice (legacy HTML invoice)
        await generateAndSendInvoice(session);
        
        // Send lead delivery notification with PDF invoice
        const invoiceUrl = order && 'invoiceUrl' in order ? (order as any).invoiceUrl : undefined;
        await sendLeadDeliveryNotificationFromSession(session, invoiceUrl);
        
        break;
      }
      
      case 'customer.created': {
        const customer = event.data.object as Stripe.Customer;
        console.log('Customer created:', customer.id);
        
        // Sync to CRM
        await syncCustomerToCRM(customer);
        
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function sendLeadDeliveryNotification(paymentIntent: Stripe.PaymentIntent) {
  try {
    const customer = await stripe.customers.retrieve(paymentIntent.customer as string);
    
    if ('email' in customer && customer.email) {
      // Send confirmation email
      console.log('Sending lead delivery notification to:', customer.email);
      
      // Here you would integrate with your email service
      // Example: await sendEmail({
      //   to: customer.email,
      //   subject: 'Uw leads zijn onderweg! 🚀',
      //   template: 'lead-delivery-confirmation',
      //   data: {
      //     customerName: paymentIntent.metadata.customerName,
      //     packageId: paymentIntent.metadata.packageId,
      //     industry: paymentIntent.metadata.industry,
      //   }
      // });
    }
    
    // Trigger lead delivery process
    await triggerLeadDelivery({
      customerId: paymentIntent.customer as string,
      packageId: paymentIntent.metadata.packageId,
      quantity: parseInt(paymentIntent.metadata.quantity),
      industry: paymentIntent.metadata.industry,
      type: paymentIntent.metadata.type,
    });
    
  } catch (error) {
    console.error('Failed to send lead delivery notification:', error);
  }
}

async function handleFailedPayment(paymentIntent: Stripe.PaymentIntent) {
  try {
    const customer = await stripe.customers.retrieve(paymentIntent.customer as string);
    
    if ('email' in customer && customer.email) {
      // Send payment failure notification
      console.log('Sending payment failure notification to:', customer.email);
      
      // Here you would send a payment failure email with retry options
    }
    
  } catch (error) {
    console.error('Failed to handle payment failure:', error);
  }
}

async function syncCustomerToCRM(customer: Stripe.Customer) {
  try {
    // Here you would sync the customer to your CRM system
    // Example integrations: HubSpot, Salesforce, Pipedrive
    
    const crmData = {
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      company: customer.metadata.company,
      source: 'WarmeLeads Chat',
      createdAt: new Date(customer.created * 1000),
    };
    
    console.log('Syncing customer to CRM:', crmData);
    
    // Example HubSpot integration:
    // await hubspotClient.crm.contacts.basicApi.create({
    //   properties: {
    //     email: crmData.email,
    //     firstname: crmData.name?.split(' ')[0],
    //     lastname: crmData.name?.split(' ').slice(1).join(' '),
    //     phone: crmData.phone,
    //     company: crmData.company,
    //     hs_lead_status: 'NEW',
    //     lifecyclestage: 'lead',
    //   }
    // });
    
  } catch (error) {
    console.error('Failed to sync customer to CRM:', error);
  }
}

async function triggerLeadDelivery(orderData: {
  customerId: string;
  packageId: string;
  quantity: number;
  industry: string;
  type: string;
}) {
  try {
    // Here you would trigger your lead delivery system
    console.log('Triggering lead delivery:', orderData);
    
    // This could involve:
    // 1. Calling your lead generation API
    // 2. Scheduling lead delivery jobs
    // 3. Updating inventory systems
    // 4. Setting up automated follow-ups
    
    // Example:
    // await leadDeliveryService.scheduleDelivery({
    //   customerId: orderData.customerId,
    //   leads: await generateLeads(orderData.industry, orderData.quantity),
    //   deliveryTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    //   type: orderData.type,
    // });
    
  } catch (error) {
    console.error('Failed to trigger lead delivery:', error);
  }
}

// Voeg bestelling toe aan Blob Storage
async function addOrderToAdmin(paymentIntent: any) {
  try {
    const timestamp = Date.now();
    const orderNumber = `WL-${new Date().getFullYear()}-${String(timestamp).slice(-6)}`;
    
    const orderData = {
      id: `order_${timestamp}`,
      orderNumber,
      customerName: paymentIntent.metadata.customerName || 'Onbekend',
      customerEmail: paymentIntent.receipt_email || paymentIntent.metadata.customerEmail || 'onbekend@email.com',
      customerCompany: paymentIntent.metadata.customerCompany || undefined,
      packageId: paymentIntent.metadata.packageId || 'unknown',
      packageName: paymentIntent.description || 'Lead Package',
      industry: paymentIntent.metadata.industry || 'Onbekend',
      leadType: paymentIntent.metadata.leadType || 'exclusive',
      quantity: parseInt(paymentIntent.metadata.leadQuantity || paymentIntent.metadata.quantity || '1'),
      pricePerLead: parseInt(paymentIntent.metadata.pricePerLead || '0'),
      totalAmount: paymentIntent.amount, // in cents
      currency: paymentIntent.currency.toUpperCase(),
      status: 'completed',
      paymentMethod: 'Stripe',
      paymentIntentId: paymentIntent.id,
      createdAt: new Date().toISOString(),
    };

    console.log('📋 Saving order to Blob Storage:', orderData.orderNumber);
    
    // Save order via API
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.warmeleads.eu'}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: orderData }),
    });

    if (response.ok) {
      console.log('✅ Order saved successfully:', orderNumber);
    } else {
      const error = await response.text();
      console.error('❌ Failed to save order:', error);
    }
    
    return orderData;
    
  } catch (error) {
    console.error('Failed to add order to admin:', error);
  }
}

async function generateAndSendInvoice(session: Stripe.Checkout.Session) {
  try {
    console.log('📄 Generating invoice for session:', session.id);
    
    // Extract metadata
    const metadata = session.metadata || {};
    const customerEmail = session.customer_email || session.customer_details?.email || '';
    const customerName = metadata.customerName || session.customer_details?.name || 'Klant';
    
    // Generate invoice data
    const invoiceData: InvoiceData = {
      invoiceNumber: generateInvoiceNumber(),
      invoiceDate: new Date().toISOString(),
      customerName,
      customerEmail,
      customerCompany: metadata.customerCompany,
      packageName: session.line_items?.data[0]?.description || metadata.packageId || 'Lead Package',
      packageDescription: metadata.industry ? `${metadata.leadQuantity} leads voor ${metadata.industry}` : 'Lead pakket',
      quantity: parseInt(metadata.orderQuantity || '1'),
      unitPrice: session.amount_total || 0,
      totalPrice: session.amount_total || 0,
      currency: session.currency || 'eur',
      paymentMethod: session.payment_method_types?.[0] || 'card',
      transactionId: session.payment_intent as string || session.id,
    };
    
    // Generate invoice HTML
    const invoiceHTML = generateInvoiceHTML(invoiceData);
    
    console.log('✅ Invoice generated:', invoiceData.invoiceNumber);
    
    // TODO: Send invoice via email service
    // For now, we'll log it
    console.log('📧 Invoice would be sent to:', customerEmail);
    
    // Store invoice in blob storage or database
    await storeInvoice(invoiceData, invoiceHTML);
    
    return invoiceData;
  } catch (error) {
    console.error('Failed to generate invoice:', error);
    throw error;
  }
}

async function generateAndStorePDFInvoice(orderData: any): Promise<string | null> {
  try {
    console.log('📄 Generating PDF invoice for order:', orderData.orderNumber);
    
    // Import PDF generator
    const { generateInvoicePDF } = await import('@/lib/pdfInvoiceGenerator');
    
    const invoiceData = {
      invoiceNumber: `INV-${orderData.orderNumber}`,
      invoiceDate: orderData.createdAt,
      orderNumber: orderData.orderNumber,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      customerCompany: orderData.customerCompany,
      packageName: orderData.packageName,
      industry: orderData.industry,
      quantity: orderData.quantity,
      pricePerLead: orderData.pricePerLead,
      totalAmountExclVAT: orderData.totalAmount,
      vatAmount: orderData.vatAmount,
      totalAmountInclVAT: orderData.totalAmountInclVAT,
      vatPercentage: orderData.vatPercentage,
      currency: orderData.currency,
      paymentMethod: orderData.paymentMethod,
    };
    
    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoiceData);
    
    // Store PDF in Blob Storage
    const { put } = await import('@vercel/blob');
    
    const filename = `invoices/${orderData.customerEmail}/INV-${orderData.orderNumber}.pdf`;
    const blob = await put(filename, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
    });
    
    console.log('✅ PDF invoice stored:', blob.url);
    return blob.url;
    
  } catch (error) {
    console.error('❌ Error generating PDF invoice:', error);
    return null;
  }
}

async function sendLeadDeliveryNotificationFromSession(session: Stripe.Checkout.Session, invoiceUrl?: string) {
  try {
    const customerEmail = session.customer_email || session.customer_details?.email;
    const customerName = session.metadata?.customerName || session.customer_details?.name || 'Klant';
    
    if (customerEmail) {
      console.log('📧 Preparing to send order confirmation emails');
      
      // Import email service
      const { sendOrderConfirmationEmail, sendAdminOrderNotification } = await import('@/lib/emailService');
      
      const metadata = session.metadata || {};
      const timestamp = Date.now();
      const orderNumber = `WL-${new Date().getFullYear()}-${String(timestamp).slice(-6)}`;
      
      const emailData = {
        customerName,
        customerEmail,
        orderNumber,
        packageName: session.line_items?.data?.[0]?.description || metadata.packageId || 'Lead Package',
        industry: metadata.industry || 'Onbekend',
        quantity: parseInt(metadata.leadQuantity || metadata.orderQuantity || '1'),
        totalAmount: session.amount_total || 0,
        currency: (session.currency || 'eur').toUpperCase(),
        paymentMethod: session.payment_method_types?.[0] || 'card',
        invoiceUrl: undefined, // Will be set by generateAndSendInvoice
      };
      
      // Send customer confirmation email with PDF invoice
      const customerEmailSent = await sendOrderConfirmationEmail(emailData, invoiceUrl);
      
      if (customerEmailSent) {
        console.log('✅ Customer confirmation email sent to:', customerEmail);
      } else {
        console.error('❌ Failed to send customer confirmation email');
      }
      
      // Send admin notification email
      const adminEmailSent = await sendAdminOrderNotification(emailData);
      
      if (adminEmailSent) {
        console.log('✅ Admin notification email sent to: info@warmeleads.eu');
      } else {
        console.error('❌ Failed to send admin notification email');
      }
    }
  } catch (error) {
    console.error('Failed to send notifications:', error);
  }
}

async function storeInvoice(invoiceData: InvoiceData, invoiceHTML: string) {
  try {
    // Store invoice in blob storage
    const { put } = await import('@vercel/blob');
    
    const blob = await put(
      `invoices/${invoiceData.invoiceNumber}.html`,
      invoiceHTML,
      {
        access: 'public',
        contentType: 'text/html',
      }
    );
    
    console.log('✅ Invoice stored:', blob.url);
    
    // TODO: Also store invoice metadata in database
    // For tracking and retrieval
    
    return blob.url;
  } catch (error) {
    console.error('Failed to store invoice:', error);
    // Don't throw - invoice generation should not fail the webhook
  }
}

// Save order from checkout session
async function saveOrderFromSession(session: Stripe.Checkout.Session) {
  try {
    const timestamp = Date.now();
    const orderNumber = `WL-${new Date().getFullYear()}-${String(timestamp).slice(-6)}`;
    
    const metadata = session.metadata || {};
    const customerEmail = session.customer_email || session.customer_details?.email || 'unknown@email.com';
    
    // Import VAT calculator
    const { calculateVAT, VAT_PERCENTAGE } = await import('@/lib/vatCalculator');
    
    // Calculate VAT (bedragen in Stripe zijn EXCL BTW)
    const pricePerLead = parseInt(metadata.pricePerLead || '0');
    const quantity = parseInt(metadata.leadQuantity || metadata.orderQuantity || '1');
    const totalAmountExclVAT = pricePerLead * quantity;
    
    const vatBreakdown = calculateVAT(totalAmountExclVAT);
    
    const orderData = {
      id: `order_${timestamp}`,
      orderNumber,
      customerName: metadata.customerName || session.customer_details?.name || 'Onbekend',
      customerEmail,
      customerCompany: metadata.customerCompany || undefined,
      packageId: metadata.packageId || 'unknown',
      packageName: session.line_items?.data?.[0]?.description || metadata.industry || 'Lead Package',
      industry: metadata.industry || 'Onbekend',
      leadType: (metadata.leadType as 'exclusive' | 'shared') || 'exclusive',
      quantity,
      pricePerLead, // EXCL VAT
      totalAmount: vatBreakdown.amountExclVAT, // EXCL VAT
      vatAmount: vatBreakdown.vatAmount,
      totalAmountInclVAT: vatBreakdown.amountInclVAT, // INCL VAT
      vatPercentage: VAT_PERCENTAGE,
      currency: (session.currency || 'eur').toUpperCase(),
      status: 'completed' as const,
      paymentMethod: session.payment_method_types?.[0] || 'card',
      sessionId: session.id,
      paymentIntentId: session.payment_intent as string || undefined,
      createdAt: new Date().toISOString(),
      invoiceUrl: undefined as string | undefined,
      invoiceNumber: undefined as string | undefined,
    };

    console.log('📋 Saving order from session to Supabase:', orderData.orderNumber);

    const supabase = createServerClient();

    // Ensure customer exists and get ID
    let customerId: string | null = null;
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerEmail)
      .single();

    if (existingCustomer?.id) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: createCustomerError } = await supabase
        .from('customers')
        .insert({
          email: customerEmail,
          name: orderData.customerName,
          company: orderData.customerCompany || null,
          source: 'checkout',
          status: 'active',
        })
        .select('id')
        .single();

      if (createCustomerError) {
        console.warn('⚠️ Failed to create customer for order:', createCustomerError.message);
      } else if (newCustomer?.id) {
        customerId = newCustomer.id;
      }
    }

    // Insert order
    const { data: insertedOrder, error: insertError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        order_number: orderData.orderNumber,
        customer_email: orderData.customerEmail,
        customer_name: orderData.customerName,
        customer_company: orderData.customerCompany || null,
        package_id: orderData.packageId,
        package_name: orderData.packageName,
        industry: orderData.industry,
        lead_type: orderData.leadType,
        quantity: orderData.quantity,
        price_per_lead: orderData.pricePerLead,
        total_amount: orderData.totalAmount,
        vat_amount: orderData.vatAmount,
        total_amount_incl_vat: orderData.totalAmountInclVAT,
        vat_percentage: orderData.vatPercentage,
        currency: orderData.currency,
        status: orderData.status,
        payment_method: orderData.paymentMethod,
        session_id: orderData.sessionId,
        stripe_session_id: orderData.sessionId,
        payment_intent_id: orderData.paymentIntentId,
        stripe_payment_intent_id: orderData.paymentIntentId,
        created_at: orderData.createdAt,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('❌ Failed to save order from session:', insertError.message);
      throw new Error(insertError.message);
    }

    let savedOrder = {
      ...orderData,
      id: insertedOrder?.id,
    };

    // Generate PDF invoice and store it
    const invoiceUrl = await generateAndStorePDFInvoice(orderData);

    if (invoiceUrl && insertedOrder?.id) {
      const invoiceNumber = `INV-${orderData.orderNumber}`;

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          invoice_url: invoiceUrl,
          invoice_number: invoiceNumber,
        })
        .eq('id', insertedOrder.id);

      if (updateError) {
        console.warn('⚠️ Failed to update order with invoice URL:', updateError.message);
      } else {
        console.log('✅ Invoice generated and stored:', invoiceUrl);
        savedOrder = {
          ...savedOrder,
          invoiceUrl,
          invoiceNumber,
        };
      }
    }

    return savedOrder;
    
  } catch (error) {
    console.error('❌ Error saving order from session:', error);
    throw error;
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Stripe webhook endpoint' });
}

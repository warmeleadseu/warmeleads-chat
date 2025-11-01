/**
 * WHATSAPP NEW LEAD TRIGGER API
 * 
 * Automatically sends WhatsApp messages when new leads are added
 * - Triggered by Google Sheets sync or manual lead addition
 * - Uses customer's WhatsApp configuration
 * - Respects timing settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppConfig } from '@/lib/whatsappAPI';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { 
      customerId, 
      leadId, 
      leadName, 
      phoneNumber, 
      product,
      branch
    } = await request.json();

    if (!customerId || !leadId || !phoneNumber) {
      return NextResponse.json({ 
        error: 'Customer ID, Lead ID, and phone number are required' 
      }, { status: 400 });
    }

    // Security check: User can only trigger for themselves (unless admin)
    if (!isAdmin(user.email) && customerId !== user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log(`🔄 WhatsApp trigger for new lead: ${leadName} (${phoneNumber})`);

    // Get WhatsApp config for customer
    const configResponse = await fetch(`${request.nextUrl.origin}/api/whatsapp/config?customerId=${customerId}`);
    if (!configResponse.ok) {
      console.log('ℹ️ No WhatsApp config found for customer');
      return NextResponse.json({ message: 'WhatsApp not configured' });
    }

    const { config }: { config: WhatsAppConfig } = await configResponse.json();

    if (!config.enabled) {
      console.log('ℹ️ WhatsApp is disabled for customer');
      return NextResponse.json({ message: 'WhatsApp disabled' });
    }

    // Check if phone number is valid
    if (!phoneNumber || phoneNumber.length < 10) {
      console.log('ℹ️ Invalid phone number, skipping WhatsApp');
      return NextResponse.json({ message: 'Invalid phone number' });
    }

    // Determine product name from branch
    const productName = getProductNameFromBranch(branch);

    // Get template based on timing
    let template = config.templates.newLead;
    let delay = 0;

    switch (config.timing.newLead) {
      case 'immediate':
        delay = 0;
        break;
      case '1hour':
        delay = 60 * 60 * 1000; // 1 hour in milliseconds
        break;
      case '24hours':
        delay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        break;
    }

    // Schedule message
    if (delay > 0) {
      console.log(`⏰ Scheduling WhatsApp message for ${delay}ms delay`);
      
      // Store scheduled message in blob storage
      await storeScheduledMessage({
        customerId,
        leadId,
        phoneNumber,
        leadName,
        product: productName,
        template,
        scheduledFor: new Date(Date.now() + delay).toISOString(),
        status: 'scheduled'
      });

      return NextResponse.json({
        success: true,
        message: 'WhatsApp message scheduled',
        scheduledFor: new Date(Date.now() + delay).toISOString()
      });
    } else {
      // Send immediately
      console.log(`📤 Sending immediate WhatsApp message`);
      
      const sendResponse = await fetch(`${request.nextUrl.origin}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          leadId,
          phoneNumber,
          message: template,
          template: 'newLead',
          leadName,
          product: productName
        })
      });

      if (sendResponse.ok) {
        const result = await sendResponse.json();
        console.log(`✅ WhatsApp message sent immediately: ${result.messageId}`);
        
        return NextResponse.json({
          success: true,
          message: 'WhatsApp message sent immediately',
          messageId: result.messageId
        });
      } else {
        const error = await sendResponse.json();
        console.error(`❌ Failed to send immediate WhatsApp message: ${error.error}`);
        
        return NextResponse.json({
          success: false,
          error: error.error
        }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Error in WhatsApp new lead trigger:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});

// Get product name from branch
function getProductNameFromBranch(branch: string): string {
  const branchMap: { [key: string]: string } = {
    'Thuisbatterijen': 'thuisbatterijen',
    'Zonnepanelen': 'zonnepanelen',
    'Warmtepompen': 'warmtepompen',
    'Financial Lease': 'financial lease',
    'Airco': 'airconditioning',
    'Custom': 'onze diensten'
  };
  
  return branchMap[branch] || 'onze diensten';
}

// Store scheduled message
async function storeScheduledMessage(message: any) {
  try {
    const response = await fetch('https://blob.vercel-storage.com/whatsapp-scheduled-messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [message]
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to store scheduled message');
    }
  } catch (error) {
    console.error('Error storing scheduled message:', error);
  }
}







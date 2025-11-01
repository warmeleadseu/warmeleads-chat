/**
 * WHATSAPP SEND MESSAGE API
 * 
 * Sends WhatsApp messages to leads
 * - Uses Warmeleads WhatsApp Business (default)
 * - Uses customer's own WhatsApp Business (premium)
 * 
 * AUTHENTICATED - User can only send messages from their own account
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsappService, WhatsAppService } from '@/lib/whatsappAPI';
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
      phoneNumber, 
      message, 
      template,
      leadName,
      product,
      useFreeFormParam = false // New parameter to enable free-form messages
    } = await request.json();

    // SECURITY: Force template messages for automatic lead messages
    // Only allow free-form for manual test messages
    const isAutomaticMessage = leadId && leadId.startsWith('sheet_');
    const forceTemplate = isAutomaticMessage && useFreeFormParam;
    
    let useFreeForm = useFreeFormParam;
    if (forceTemplate) {
      console.log(`🔒 SECURITY: Forcing template message for automatic lead message (leadId: ${leadId})`);
      useFreeForm = false;
    }

    // Input validation
    if (!customerId || !phoneNumber || !message) {
      return NextResponse.json({ 
        error: 'Customer ID, phone number, and message are required' 
      }, { status: 400 });
    }

    // Security: User can only send messages from their own account (unless admin)
    if (customerId !== user.email && !isAdmin(user.email)) {
      return NextResponse.json({ 
        error: 'Forbidden - You can only send messages from your own account' 
      }, { status: 403 });
    }

    // Validate customerId format (email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerId)) {
      return NextResponse.json({ 
        error: 'Invalid customer ID format' 
      }, { status: 400 });
    }

    // Validate phoneNumber format (basic check)
    const cleanedPhone = phoneNumber.replace(/[\s\-\+]/g, '');
    if (cleanedPhone.length < 9 || cleanedPhone.length > 15) {
      return NextResponse.json({ 
        error: 'Invalid phone number format' 
      }, { status: 400 });
    }

    // Validate message length
    if (message.trim().length === 0 || message.length > 1600) {
      return NextResponse.json({ 
        error: 'Message must be between 1 and 1600 characters' 
      }, { status: 400 });
    }

    // Get WhatsApp config for customer
    const configResponse = await fetch(`${request.nextUrl.origin}/api/whatsapp/config?customerId=${customerId}`);
    if (!configResponse.ok) {
      return NextResponse.json({ error: 'WhatsApp config not found' }, { status: 404 });
    }

    const { config }: { config: WhatsAppConfig } = await configResponse.json();
    
    console.log(`📡 Send API: Config loaded for customer ${customerId}:`, { 
      enabled: config.enabled, 
      businessName: config.businessName,
      type: typeof config.enabled 
    });

    if (!config.enabled) {
      console.log(`❌ Send API: WhatsApp not enabled for customer ${customerId}`);
      return NextResponse.json({ error: 'WhatsApp is not enabled for this customer' }, { status: 400 });
    }

    // Check usage limits
    if (config.usage.messagesSent >= config.billing.messagesLimit) {
      return NextResponse.json({ 
        error: 'Message limit reached. Please upgrade your plan.',
        limitReached: true,
        currentUsage: config.usage.messagesSent,
        limit: config.billing.messagesLimit
      }, { status: 429 });
    }

    // Process message template
    const processedMessage = WhatsAppService.processTemplate(message, config, leadName, product);

    console.log(`📤 Sending WhatsApp message to ${phoneNumber} for customer ${customerId}`);
    console.log(`📝 Message: ${processedMessage}`);

    // QUICKPULSE-STYLE TWILIO WHATSAPP BUSINESS API Implementation
    console.log(`📤 [QUICKPULSE-STYLE TWILIO] Sending WhatsApp message to ${phoneNumber}`);
    console.log(`📝 [QUICKPULSE-STYLE TWILIO] Message: ${processedMessage}`);
    
    // Get Twilio credentials from environment
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const twilioContentSid = process.env.TWILIO_CONTENT_SID; // Optional - can be null for direct messaging
    
    console.log(`🔑 Twilio Account SID: ${twilioAccountSid ? 'SET' : 'NOT SET'}`);
    console.log(`🔑 Twilio Auth Token: ${twilioAuthToken ? 'SET' : 'NOT SET'}`);
    console.log(`🔑 Twilio Messaging Service SID: ${twilioMessagingServiceSid ? 'SET' : 'NOT SET'}`);
    console.log(`🔑 Twilio Content SID: ${twilioContentSid ? 'SET' : 'NOT SET'}`);
    
    if (!twilioAccountSid || !twilioAuthToken || !twilioMessagingServiceSid) {
      console.error('❌ Twilio WhatsApp credentials not configured');
      return NextResponse.json({
        success: false,
        error: 'Twilio WhatsApp not configured. Please contact support.'
      }, { status: 500 });
    }
    
    // Format phone number for Twilio (whatsapp:+31...)
    // Handle various Dutch phone number formats:
    // - 0612345678 -> +31612345678
    // - 31612345678 -> +31612345678
    // - +31612345678 -> +31612345678
    let cleanPhone = phoneNumber.replace(/\s/g, '').replace(/-/g, ''); // Remove spaces and dashes
    
    // If it starts with 'whatsapp:', extract the number part
    if (cleanPhone.startsWith('whatsapp:')) {
      cleanPhone = cleanPhone.replace('whatsapp:', '');
    }
    
    // Remove leading + if present
    cleanPhone = cleanPhone.replace(/^\+/, '');
    
    // Convert Dutch mobile numbers starting with 06 to international format
    if (cleanPhone.startsWith('06')) {
      cleanPhone = '31' + cleanPhone.substring(1); // 0612345678 -> 31612345678
    }
    
    // Ensure it starts with 31 for Dutch numbers
    if (!cleanPhone.startsWith('31') && cleanPhone.length >= 9) {
      cleanPhone = '31' + cleanPhone;
    }
    
    // Add + prefix and whatsapp: prefix
    const formattedPhone = `whatsapp:+${cleanPhone}`;
    
    console.log(`📞 Original phone: ${phoneNumber}`);
    console.log(`📞 Formatted phone: ${formattedPhone}`);
    
    // Create Twilio API URL
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    console.log(`🌐 Twilio API URL: ${twilioUrl}`);
    
    // Choose between template and free-form messages
    let requestBody;
    
    if (useFreeForm) {
      // FREE-FORM MESSAGE - Direct text message without template
      // NOTE: Free-form messages only work within 24-hour conversation window
      console.log(`📝 Using FREE-FORM message (direct text)`);
      console.log(`⚠️ WARNING: Free-form messages only work within 24-hour conversation window!`);
      
      requestBody = new URLSearchParams({
        To: formattedPhone,
        MessagingServiceSid: twilioMessagingServiceSid,
        Body: processedMessage // Direct message content
      });
      
      console.log(`📝 Request body (FREE-FORM):`, {
        To: formattedPhone,
        MessagingServiceSid: twilioMessagingServiceSid,
        Body: processedMessage
      });
    } else {
      // TEMPLATE MESSAGE - Use ContentSid (QuickPulse style)
      console.log(`📝 Using TEMPLATE message (ContentSid)`);
      const defaultContentSid = twilioContentSid || 'HX1234567890abcdef1234567890abcdef'; // Default template
      
      // Prepare placeholders for Twilio template (exact QuickPulse style)
      const placeholders = {
        "1": leadName || "Lead",
        "2": config.businessName || "WarmeLeads"
      };
      
      requestBody = new URLSearchParams({
        To: formattedPhone,
        MessagingServiceSid: twilioMessagingServiceSid,
        ContentSid: defaultContentSid,
        ContentVariables: JSON.stringify(placeholders)
      });
      
      console.log(`📝 Request body (TEMPLATE):`, {
        To: formattedPhone,
        MessagingServiceSid: twilioMessagingServiceSid,
        ContentSid: defaultContentSid,
        ContentVariables: JSON.stringify(placeholders)
      });
    }
    
    // Send message via Twilio WhatsApp API (QuickPulse style)
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody
    });
    
    console.log(`📡 Twilio response status: ${twilioResponse.status}`);
    console.log(`📡 Twilio response headers:`, Object.fromEntries(twilioResponse.headers.entries()));
    
    const twilioData = await twilioResponse.json();
    console.log(`📡 Twilio response data:`, twilioData);
    
    let result;
    if (twilioResponse.ok && twilioData.sid) {
      result = {
        success: true,
        messageId: twilioData.sid
      };
      console.log(`✅ Twilio WhatsApp message sent successfully (QuickPulse style): ${result.messageId}`);
    } else {
      console.error('❌ Twilio WhatsApp API error:', twilioData);
      
      // Handle specific WhatsApp errors
      let errorMessage = twilioData.message || 'Failed to send WhatsApp message via Twilio';
      
      if (twilioData.code === 63007) {
        errorMessage = 'Free-form messages can only be sent within 24 hours of the last customer message. Use template messages for new conversations.';
      } else if (twilioData.code === 63016) {
        errorMessage = 'WhatsApp message template not found or not approved.';
      } else if (twilioData.code === 63017) {
        errorMessage = 'WhatsApp message template variables are invalid.';
      } else if (twilioData.code === 63018) {
        errorMessage = 'WhatsApp message template is not approved for this use case.';
      }
      
      result = {
        success: false,
        error: errorMessage,
        code: twilioData.code,
        details: twilioData
      };
    }

    if (result.success) {
      // Update usage counter
      config.usage.messagesSent++;
      
      // Log the message
      await WhatsAppService.logMessage({
        id: result.messageId,
        customerId,
        leadId: leadId || 'unknown',
        phoneNumber,
        message: processedMessage,
        template: template || 'newLead',
        status: 'sent',
        sentAt: new Date().toISOString(),
        timestamp: new Date().toISOString(), // For analytics compatibility
        type: 'template',
        templateName: template || 'newLead',
        direction: 'outgoing',
        retryCount: 0
      });

      // Save updated config
      await fetch(`${request.nextUrl.origin}/api/whatsapp/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, config })
      });

      console.log(`✅ WhatsApp message sent successfully: ${result.messageId}`);
      
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: 'WhatsApp message sent successfully'
      });
    } else {
      console.error(`❌ Failed to send WhatsApp message`);
      
      // Update failed counter
      config.usage.messagesFailed++;
      
      // Save updated config
      await fetch(`${request.nextUrl.origin}/api/whatsapp/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, config })
      });

      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send message'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST /api/whatsapp/send:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});

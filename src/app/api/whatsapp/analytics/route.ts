/**
 * WHATSAPP ANALYTICS API
 * 
 * Provides analytics data for WhatsApp messages
 * - Messages sent count
 * - Response rates
 * - Delivery status
 * - Usage statistics
 * 
 * AUTHENTICATED - User can only view their own analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppConfig } from '@/lib/whatsappAPI';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    // Security: User can only view their own analytics (unless admin)
    if (customerId !== user.email && !isAdmin(user.email)) {
      return NextResponse.json({ 
        error: 'Forbidden - You can only view your own analytics' 
      }, { status: 403 });
    }

    console.log(`📊 Fetching WhatsApp analytics for customer: ${customerId}`);

    // Get WhatsApp config to access message history
    const configResponse = await fetch(`${request.nextUrl.origin}/api/whatsapp/config?customerId=${customerId}`);
    if (!configResponse.ok) {
      return NextResponse.json({ error: 'WhatsApp config not found' }, { status: 404 });
    }

    const { config }: { config: WhatsAppConfig } = await configResponse.json();

    // Calculate analytics from message history
    const messages = config.messageHistory || [];
    const totalMessages = messages.length;
    
    // Group by date for daily stats
    const dailyStats = messages.reduce((acc: any, message: any) => {
      const date = new Date(message.timestamp).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          messagesSent: 0,
          messagesDelivered: 0,
          messagesRead: 0,
          responses: 0
        };
      }
      
      acc[date].messagesSent++;
      
      // Simulate delivery/read status (in real implementation, this would come from Twilio webhooks)
      if (message.status === 'sent' || message.status === 'delivered' || message.status === 'read') {
        acc[date].messagesDelivered++;
      }
      if (message.status === 'read') {
        acc[date].messagesRead++;
      }
      if (message.direction === 'inbound') {
        acc[date].responses++;
      }
      
      return acc;
    }, {});

    // Calculate overall statistics
    const deliveredMessages = messages.filter(m => 
      m.status === 'sent' || m.status === 'delivered' || m.status === 'read'
    ).length;
    
    const readMessages = messages.filter(m => m.status === 'read').length;
    const inboundMessages = messages.filter(m => m.direction === 'incoming').length;
    
    const deliveryRate = totalMessages > 0 ? (deliveredMessages / totalMessages) * 100 : 0;
    const readRate = deliveredMessages > 0 ? (readMessages / deliveredMessages) * 100 : 0;
    const responseRate = totalMessages > 0 ? (inboundMessages / totalMessages) * 100 : 0;

    // Get recent messages (last 10)
    const recentMessages = messages
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    // Calculate usage vs limit
    const usagePercentage = (config.usage.messagesSent / config.billing.messagesLimit) * 100;

    const analytics = {
      overview: {
        totalMessagesSent: totalMessages,
        messagesDelivered: deliveredMessages,
        messagesRead: readMessages,
        responsesReceived: inboundMessages,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        readRate: Math.round(readRate * 100) / 100,
        responseRate: Math.round(responseRate * 100) / 100,
        usagePercentage: Math.round(usagePercentage * 100) / 100,
        messagesRemaining: config.billing.messagesLimit - config.usage.messagesSent
      },
      dailyStats: Object.values(dailyStats).sort((a: any, b: any) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
      recentMessages: recentMessages,
      config: {
        enabled: config.enabled,
        businessName: config.businessName,
        messagesLimit: config.billing.messagesLimit,
        planType: config.billing.plan
      }
    };

    console.log(`📊 Analytics calculated for ${customerId}:`, {
      totalMessages: totalMessages,
      deliveryRate: deliveryRate,
      responseRate: responseRate
    });

    return NextResponse.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('❌ Error fetching WhatsApp analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

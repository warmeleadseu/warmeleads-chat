import { NextRequest, NextResponse } from 'next/server';
import { getOverdueInvoices, crmSystem } from '@/lib/crmSystem';

export async function POST(req: NextRequest) {
  try {
    const overdueInvoices = await getOverdueInvoices();
    const emailsSent = [];

    console.log(`📧 Processing ${overdueInvoices.length} overdue invoices`);

    for (const { customer, invoice } of overdueInvoices) {
      // Don't send more than 3 reminders
      if (invoice.reminderCount >= 3) {
        continue;
      }

      // Don't send reminder if one was sent in the last 6 hours
      if (invoice.lastReminderSent) {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        if (new Date(invoice.lastReminderSent) > sixHoursAgo) {
          continue;
        }
      }

      // Generate personalized follow-up email
      const quantityNumber = parseInt(invoice.quantity.match(/\d+/)?.[0] || '0');
      const emailContent = generateFollowUpEmail(customer, invoice, quantityNumber);

      // In production, send via email service (SendGrid, Mailgun, etc.)
      console.log(`📧 Follow-up email for ${customer.email}:`, emailContent);

      // Mark reminder as sent
      crmSystem.markReminderSent(invoice.id);

      emailsSent.push({
        customerId: customer.id,
        customerEmail: customer.email,
        invoiceId: invoice.id,
        reminderNumber: invoice.reminderCount + 1,
        subject: emailContent.subject
      });
    }

    return NextResponse.json({
      success: true,
      emailsSent: emailsSent.length,
      totalOverdue: overdueInvoices.length,
      emails: emailsSent
    });

  } catch (error) {
    console.error('Follow-up email error:', error);
    return NextResponse.json(
      { error: 'Failed to send follow-up emails' },
      { status: 500 }
    );
  }
}

function generateFollowUpEmail(customer: any, invoice: any, quantity: number) {
  const customerName = customer.name || 'Beste klant';
  const industry = invoice.industry.toLowerCase();
  
  // Personalized subject lines
  const subjects = [
    `🔥 Uw ${quantity} ${industry} leads wachten op u!`,
    `⏰ Nog steeds geïnteresseerd in ${industry} leads?`,
    `💡 Laatste kans: ${quantity} verse ${industry} leads`
  ];

  const subject = subjects[Math.min(invoice.reminderCount, subjects.length - 1)];

  // Personalized email content
  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 15px 15px 0 0;">
        <h2 style="color: white; margin: 0;">🔥 Uw leads wachten nog steeds!</h2>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 0 0 15px 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p><strong>${customerName},</strong></p>
        
        <p>We zagen dat u geïnteresseerd was in <strong>${quantity} ${invoice.leadType.toLowerCase()} voor ${industry}</strong>, maar de bestelling is nog niet afgerond.</p>
        
        <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 10px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #92400e; margin-top: 0;">⚡ Uw leads staan klaar:</h3>
          <ul style="color: #92400e; margin: 10px 0;">
            <li>✅ ${quantity} verse ${industry} leads</li>
            <li>✅ Binnen 15 minuten geleverd</li>
            <li>✅ Nederlandse prospects</li>
            <li>✅ Realtime dashboard toegang</li>
          </ul>
          <p style="color: #92400e; font-weight: bold; margin-bottom: 0;">
            Totaal: ${invoice.amount}
          </p>
        </div>

        ${invoice.reminderCount === 0 ? `
          <p>Heeft u vragen over de leads of het bestellen? Onze experts helpen u graag!</p>
        ` : invoice.reminderCount === 1 ? `
          <p>Misschien was u even afgeleid? Geen probleem! Uw leadpakket staat nog steeds voor u klaar.</p>
          <p><strong>🎁 Speciale aanbieding:</strong> Bestel binnen 24 uur en ontvang 5 extra leads gratis!</p>
        ` : `
          <p>Dit is onze laatste reminder. Na vandaag vervalt deze aanbieding.</p>
          <p><strong>🚨 Laatste kans:</strong> Uw concurrenten zijn al actief met verse leads. Mis deze kans niet!</p>
        `}

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://www.warmeleads.eu" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">
            🚀 Bestelling Afronden
          </a>
        </div>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px; text-align: center;">
          <p style="color: #6b7280; font-size: 14px;">
            <strong>Direct contact?</strong><br>
            📧 <a href="mailto:info@warmeleads.eu" style="color: #667eea;">info@warmeleads.eu</a> | 
            📞 <a href="tel:+31850477067" style="color: #667eea;">085-0477067</a><br>
            💬 <a href="https://wa.me/31613927338" style="color: #667eea;">WhatsApp: +31 6 1392 7338</a>
          </p>
        </div>
      </div>
    </div>
  `;

  return {
    to: customer.email,
    subject,
    html: emailBody,
    customerName,
    invoiceAmount: invoice.amount,
    quantity,
    industry
  };
}

// Manual trigger endpoint
export async function GET() {
  const overdueInvoices = await getOverdueInvoices();
  return NextResponse.json({
    message: 'Use POST to trigger follow-up emails',
    overdueCount: overdueInvoices.length
  });
}







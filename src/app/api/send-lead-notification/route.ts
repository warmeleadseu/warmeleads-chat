import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// API route voor het versturen van email notificaties over nieuwe leads
// AUTHENTICATED - Internal use only (called from other API routes)

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build');

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { customerEmail, customerName, lead } = body;
    
    console.log('📧 Sending lead notification email to:', customerEmail);
    console.log('Lead:', lead?.name);
    
    if (!customerEmail || !lead) {
      return NextResponse.json(
        { error: 'Customer email and lead data are required' },
        { status: 400 }
      );
    }

    // Security: User can only send notifications to themselves (unless admin)
    if (customerEmail !== user.email && !isAdmin(user.email)) {
      return NextResponse.json({ 
        error: 'Forbidden - You can only send notifications to yourself' 
      }, { status: 403 });
    }

    // Maak email content voor individuele lead
    const emailContent = {
      to: customerEmail,
      subject: `🎉 Nieuwe lead: ${lead.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px;
              text-align: center;
              margin-bottom: 30px;
            }
            .lead-card {
              background: #f8f9fa;
              border-left: 4px solid #667eea;
              padding: 20px;
              margin: 15px 0;
              border-radius: 8px;
            }
            .lead-name {
              font-size: 18px;
              font-weight: bold;
              color: #667eea;
              margin-bottom: 10px;
            }
            .lead-info {
              display: flex;
              align-items: center;
              margin: 8px 0;
              font-size: 14px;
            }
            .icon {
              margin-right: 8px;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              margin-top: 20px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🎉 Nieuwe Lead Binnengekomen!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Je hebt een nieuwe warme lead ontvangen</p>
          </div>
          
          <p>Hallo ${customerName || 'daar'},</p>
          
          <p>Goed nieuws! Er is een nieuwe lead binnengekomen in je leadportaal:</p>
          
          <div class="lead-card">
            <div class="lead-name">${lead.name}</div>
            <div class="lead-info">
              <span class="icon">📧</span> <strong>Email:</strong> ${lead.email || 'Niet opgegeven'}
            </div>
            <div class="lead-info">
              <span class="icon">📞</span> <strong>Telefoon:</strong> ${lead.phone || 'Niet opgegeven'}
            </div>
            ${lead.company ? `
              <div class="lead-info">
                <span class="icon">🏢</span> <strong>Bedrijf:</strong> ${lead.company}
              </div>
            ` : ''}
            ${lead.interest ? `
              <div class="lead-info">
                <span class="icon">💼</span> <strong>Interesse:</strong> ${lead.interest}
              </div>
            ` : ''}
            ${lead.budget ? `
              <div class="lead-info">
                <span class="icon">💰</span> <strong>Budget:</strong> ${lead.budget}
              </div>
            ` : ''}
            ${lead.timeline ? `
              <div class="lead-info">
                <span class="icon">📅</span> <strong>Tijdlijn:</strong> ${lead.timeline}
              </div>
            ` : ''}
            ${lead.notes ? `
              <div class="lead-info">
                <span class="icon">📝</span> <strong>Notities:</strong> ${lead.notes}
              </div>
            ` : ''}
            ${lead.branchData?.postcode ? `
              <div class="lead-info">
                <span class="icon">📍</span> <strong>Postcode:</strong> ${lead.branchData.postcode} ${lead.branchData.huisnummer || ''}
              </div>
            ` : ''}
            ${lead.branchData?.zonnepanelen ? `
              <div class="lead-info">
                <span class="icon">☀️</span> <strong>Zonnepanelen:</strong> ${lead.branchData.zonnepanelen}
              </div>
            ` : ''}
            ${lead.branchData?.dynamischContract ? `
              <div class="lead-info">
                <span class="icon">⚡</span> <strong>Dynamisch Contract:</strong> ${lead.branchData.dynamischContract}
              </div>
            ` : ''}
            ${lead.branchData?.stroomverbruik ? `
              <div class="lead-info">
                <span class="icon">🔌</span> <strong>Stroomverbruik:</strong> ${lead.branchData.stroomverbruik}
              </div>
            ` : ''}
          </div>
          
          <div style="text-align: center;">
            <a href="https://www.warmeleads.eu/portal/leads" class="cta-button">
              👉 Bekijk Lead in Portal
            </a>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background: #fff9e6; border-left: 4px solid #ffc107; border-radius: 8px;">
            <p style="margin: 0; color: #856404;">
              <strong>💡 Tip:</strong> Neem zo snel mogelijk contact op met deze lead om je conversiekans te maximaliseren!
            </p>
          </div>
          
          <div class="footer">
            <p>Je ontvangt deze email omdat je email notificaties hebt ingeschakeld voor nieuwe leads.</p>
            <p>Je kunt deze instelling aanpassen in je <a href="https://www.warmeleads.eu/portal">leadportaal instellingen</a>.</p>
            <p style="margin-top: 15px;">
              <strong>WarmeLeads</strong><br>
              De slimste manier om aan leads te komen<br>
              <a href="https://www.warmeleads.eu">www.warmeleads.eu</a>
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Hallo ${customerName || 'daar'},

Goed nieuws! Er is een nieuwe lead binnengekomen in je leadportaal:

🎯 ${lead.name}
📧 Email: ${lead.email || 'Niet opgegeven'}
📞 Telefoon: ${lead.phone || 'Niet opgegeven'}
${lead.company ? `🏢 Bedrijf: ${lead.company}` : ''}
${lead.interest ? `💼 Interesse: ${lead.interest}` : ''}
${lead.budget ? `💰 Budget: ${lead.budget}` : ''}
${lead.timeline ? `📅 Tijdlijn: ${lead.timeline}` : ''}
${lead.notes ? `📝 Notities: ${lead.notes}` : ''}
${lead.branchData?.postcode ? `📍 Postcode: ${lead.branchData.postcode} ${lead.branchData.huisnummer || ''}` : ''}
${lead.branchData?.zonnepanelen ? `☀️ Zonnepanelen: ${lead.branchData.zonnepanelen}` : ''}
${lead.branchData?.dynamischContract ? `⚡ Dynamisch Contract: ${lead.branchData.dynamischContract}` : ''}
${lead.branchData?.stroomverbruik ? `🔌 Stroomverbruik: ${lead.branchData.stroomverbruik}` : ''}

Bekijk de lead in het portal:
https://www.warmeleads.eu/portal/leads

💡 Tip: Neem zo snel mogelijk contact op met deze lead om je conversiekans te maximaliseren!

Je ontvangt deze email omdat je email notificaties hebt ingeschakeld voor nieuwe leads.
Je kunt deze instelling aanpassen in je leadportaal.

WarmeLeads - De slimste manier om aan leads te komen
www.warmeleads.eu
      `
    };

    // Verstuur email via Resend
    console.log('📧 Sending email via Resend to:', customerEmail);
    console.log('📧 Email subject:', emailContent.subject);
    
    try {
      const { data, error } = await resend.emails.send({
        from: 'WarmeLeads <leads@warmeleads.eu>', // Geverifieerd domein
        to: customerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      console.log(`✅ Email successfully sent via Resend!`);
      console.log(`✅ Email ID:`, data?.id);
      console.log(`✅ Recipient: ${customerEmail} - Lead: ${lead.name}`);

      return NextResponse.json({
        success: true,
        emailSent: true,
        recipient: customerEmail,
        leadName: lead.name,
        emailId: data?.id
      });
    } catch (emailError) {
      console.error('❌ Failed to send email via Resend:', emailError);
      
      // Return error but don't throw - we still want to mark the lead as processed
      return NextResponse.json({
        success: false,
        emailSent: false,
        recipient: customerEmail,
        leadName: lead.name,
        error: emailError instanceof Error ? emailError.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error sending lead notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});

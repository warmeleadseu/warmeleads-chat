import { NextRequest, NextResponse } from 'next/server';
import { readCustomerLeads } from '@/lib/googleSheetsAPI';
import { WhatsAppConfig } from '@/lib/whatsappAPI';

// Deze API route wordt aangeroepen door een Vercel Cron Job
// om periodiek te checken op nieuwe leads en email notificaties te versturen

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Cron job started: Checking for new leads...');
    
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.error('❌ CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron job attempt');
      console.log('Expected:', `Bearer ${cronSecret}`);
      console.log('Received:', authHeader);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('✅ Cron secret verified');

    // Haal customer data op uit Blob Storage (niet uit localStorage!)
    let customers = [];
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu'}/api/customer-data`);
      if (response.ok) {
        const data = await response.json();
        customers = data.customers || [];
        console.log(`📋 Loaded ${customers.length} customers from Blob Storage`);
      } else {
        console.error('❌ Failed to load customers from Blob Storage');
        console.error('⚠️ No customers found - Blob Storage is required for cron jobs');
      }
    } catch (error) {
      console.error('❌ Error loading customers from Blob Storage:', error);
      console.error('⚠️ No customers found - Blob Storage is required for cron jobs');
    }
    
    const results = [];
    
    for (const customer of customers) {
      console.log(`🔍 Checking customer: ${customer.email}`);
      console.log(`  - Has googleSheetUrl: ${!!customer.googleSheetUrl}`);
      console.log(`  - Email notifications enabled: ${customer.emailNotifications?.enabled}`);
      console.log(`  - New leads enabled: ${customer.emailNotifications?.newLeads}`);
      
      // Skip customers without Google Sheets or without email notifications enabled
      if (!customer.googleSheetUrl || !customer.emailNotifications?.enabled) {
        console.log(`⏭️  Skipping ${customer.email} - missing requirements`);
        continue;
      }

      try {
        console.log(`📊 Checking leads for customer: ${customer.name || customer.email}`);
        
        // Google Sheet URL should already be in customer object from Supabase
        const googleSheetUrl = customer.googleSheetUrl;
        
        if (!googleSheetUrl) {
          console.log(`ℹ️ No Google Sheet URL configured for ${customer.email}`);
          continue;
        }

        // Lees leads uit Google Sheets
        const sheetLeads = await readCustomerLeads(googleSheetUrl, undefined, customer.branch_id);
        const existingLeads = customer.leadData || [];
        
        // Smart nieuwe leads detectie: combineer rijnummer en lead content
        const existingRowNumbers = new Set(existingLeads.map((lead: any) => lead.sheetRowNumber));
        
        // Maak een Set van bestaande leads voor content-based duplicate detection
        const existingLeadSignatures = new Set(
          existingLeads.map((lead: any) => 
            `${lead.name?.toLowerCase().trim()}|${lead.email?.toLowerCase().trim()}|${lead.phone?.trim()}`
          )
        );
        
        const newLeads = sheetLeads.filter(sheetLead => {
          // Skip als dit geen geldige lead data is
          if (!sheetLead.name || !sheetLead.email) return false;
          
          // Maak signature voor deze lead
          const signature = `${sheetLead.name.toLowerCase().trim()}|${sheetLead.email.toLowerCase().trim()}|${sheetLead.phone?.trim() || ''}`;
          
          // Check of dit een nieuwe rij nummer is (standaard methode)
          const isNewRowNumber = sheetLead.sheetRowNumber && !existingRowNumbers.has(sheetLead.sheetRowNumber);
          
          // Check of dit een nieuwe lead content is (voor deleted-middle scenarios)
          const isNewContent = !existingLeadSignatures.has(signature);
          
          // Een lead is nieuw als:
          // 1. Het een nieuwe rij nummer heeft (standaard geval)
          // 2. Het een andere content heeft dan bestaande leads (voor hergebruikte rijen)
          return isNewRowNumber || isNewContent;
        });
        
        console.log(`📊 Sheet leads found: ${sheetLeads.length}`);
        console.log(`📊 Existing leads in CRM: ${existingLeads.length}`);
        console.log(`📊 Existing row numbers: ${Array.from(existingRowNumbers).sort().join(', ')}`);
        console.log(`📊 New leads count: ${newLeads.length}`);
        
        if (newLeads.length > 0) {
          console.log(`🆕 Found ${newLeads.length} new leads for ${customer.email}`);
          
          let emailsSent = 0;
          let emailsFailed = 0;
          let whatsappSent = 0;
          let whatsappFailed = 0;
          
          // Check WhatsApp config for this customer
          let whatsappConfig: WhatsAppConfig | null = null;
          try {
            const whatsappResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu'}/api/whatsapp/config?customerId=${customer.email}`);
            if (whatsappResponse.ok) {
              const whatsappData = await whatsappResponse.json();
              whatsappConfig = whatsappData.config;
              console.log(`📱 WhatsApp config loaded for ${customer.email}: enabled=${whatsappConfig?.enabled}`);
            } else {
              console.log(`📱 No WhatsApp config found for ${customer.email}`);
            }
          } catch (error) {
            console.log(`📱 Error loading WhatsApp config for ${customer.email}:`, error);
          }
          
          // Voeg nieuwe leads toe aan CRM en verstuur aparte email per lead
          for (const leadData of newLeads) {
            console.log(`🔍 Processing new lead: ${leadData.name} (Row ${leadData.sheetRowNumber})`);
            
            const leadToAdd = {
              name: leadData.name,
              email: leadData.email,
              phone: leadData.phone,
              company: leadData.company,
              address: leadData.address,
              city: leadData.city,
              interest: leadData.interest,
              budget: leadData.budget,
              timeline: leadData.timeline,
              notes: leadData.notes,
              status: leadData.status,
              assignedTo: leadData.assignedTo,
              source: 'import' as const,
              sheetRowNumber: leadData.sheetRowNumber,
              branchData: leadData.branchData
            };
            
            // Voeg lead toe aan customer data
            customer.leadData = customer.leadData || [];
            customer.leadData.push(leadToAdd);
            
            console.log(`➕ Added lead ${leadData.name} to customer data (will be saved after all leads processed)`);
            
            // Verstuur aparte email voor deze specifieke lead
            if (customer.emailNotifications?.newLeads) {
              try {
                console.log(`📧 Sending individual email for lead: ${leadData.name}`);
                
                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu'}/api/send-lead-notification`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    customerEmail: customer.email,
                    customerName: customer.name,
                    lead: {
                      name: leadData.name,
                      email: leadData.email,
                      phone: leadData.phone,
                      interest: leadData.interest,
                      budget: leadData.budget,
                      company: leadData.company,
                      timeline: leadData.timeline,
                      notes: leadData.notes,
                      branchData: leadData.branchData
                    }
                  })
                });
                
                emailsSent++;
                console.log(`✅ Email sent for lead: ${leadData.name}`);
              } catch (emailError) {
                emailsFailed++;
                console.error(`❌ Failed to send email for lead ${leadData.name}:`, emailError);
              }
            }
            
            // Send WhatsApp message if enabled and phone number available
            if (whatsappConfig?.enabled && leadData.phone && leadData.phone.trim() !== '') {
              try {
                console.log(`📱 Sending WhatsApp message to ${leadData.phone} for lead: ${leadData.name}`);
                
                const whatsappResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu'}/api/whatsapp/send`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    customerId: customer.email,
                    leadId: `sheet_${leadData.sheetRowNumber}`,
                    phoneNumber: leadData.phone,
                    message: whatsappConfig.templates.newLead,
                    template: 'newLead',
                    leadName: leadData.name,
                    product: leadData.interest || 'Onze diensten'
                  })
                });
                
                if (whatsappResponse.ok) {
                  whatsappSent++;
                  console.log(`✅ WhatsApp message sent to ${leadData.phone} for lead: ${leadData.name}`);
                } else {
                  whatsappFailed++;
                  const errorData = await whatsappResponse.json().catch(() => ({ error: 'Unknown error' }));
                  console.error(`❌ Failed to send WhatsApp message to ${leadData.phone} for lead ${leadData.name}:`, errorData.error);
                }
              } catch (whatsappError) {
                whatsappFailed++;
                console.error(`❌ Error sending WhatsApp message to ${leadData.phone} for lead ${leadData.name}:`, whatsappError);
              }
            } else if (whatsappConfig?.enabled && (!leadData.phone || leadData.phone.trim() === '')) {
              console.log(`📱 WhatsApp enabled but no phone number for lead: ${leadData.name}`);
            }
          }
          
          // Update lastNotificationSent en sla customer data op in Blob Storage
          customer.emailNotifications = {
            ...customer.emailNotifications,
            lastNotificationSent: new Date()
          };
          
          // Sla bijgewerkte customer data op in Blob Storage
          try {
            console.log(`💾 Saving updated customer data to Blob Storage for ${customer.email}...`);
            const saveResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu'}/api/customer-data`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customerId: customer.id,
                customerData: customer
              })
            });
            
            if (saveResponse.ok) {
              console.log(`✅ Customer data saved to Blob Storage for ${customer.email}`);
            } else {
              console.error(`❌ Failed to save customer data to Blob Storage for ${customer.email}`);
            }
          } catch (saveError) {
            console.error(`❌ Error saving customer data to Blob Storage:`, saveError);
          }
          
          console.log(`✅ Processed ${newLeads.length} leads for ${customer.email}: ${emailsSent} emails sent, ${emailsFailed} failed, ${whatsappSent} WhatsApp messages sent, ${whatsappFailed} WhatsApp failed`);
          
          results.push({
            customerId: customer.id,
            customerEmail: customer.email,
            newLeadsCount: newLeads.length,
            emailsSent,
            emailsFailed,
            whatsappSent,
            whatsappFailed
          });
        } else {
          console.log(`ℹ️ No new leads for ${customer.email} - all sheet leads already exist in CRM`);
        }
      } catch (error) {
        console.error(`❌ Error checking leads for ${customer.email}:`, error);
        results.push({
          customerId: customer.id,
          customerEmail: customer.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const totalEmailsSent = results.reduce((sum, r) => sum + (r.emailsSent || 0), 0);
    const totalEmailsFailed = results.reduce((sum, r) => sum + (r.emailsFailed || 0), 0);
    const totalWhatsappSent = results.reduce((sum, r) => sum + (r.whatsappSent || 0), 0);
    const totalWhatsappFailed = results.reduce((sum, r) => sum + (r.whatsappFailed || 0), 0);
    
    console.log(`✅ Cron job completed. Processed ${customers.length} customers, found new leads for ${results.filter(r => r.newLeadsCount).length}`);
    console.log(`📧 Total emails: ${totalEmailsSent} sent, ${totalEmailsFailed} failed`);
    console.log(`📱 Total WhatsApp: ${totalWhatsappSent} sent, ${totalWhatsappFailed} failed`);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      customersChecked: customers.length,
      totalEmailsSent,
      totalEmailsFailed,
      totalWhatsappSent,
      totalWhatsappFailed,
      results
    });
  } catch (error) {
    console.error('❌ Error in cron job:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Ook beschikbaar als POST voor manuele triggers (development/testing)
export async function POST(request: NextRequest) {
  return GET(request);
}


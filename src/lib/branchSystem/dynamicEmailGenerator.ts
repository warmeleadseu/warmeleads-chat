/**
 * Dynamic Email Generator
 * Database-driven email template rendering for branch-specific notifications
 */

import { createClient } from '@supabase/supabase-js';
import Handlebars from 'handlebars';
import { type Lead, type Customer } from '../crmSystem';
import { type FieldMapping, type EmailTemplate, type EmailContext } from './types';

export interface EmailContent {
  subject: string;
  body: string;
  to: string;
}

export class DynamicEmailGenerator {
  /**
   * Get Supabase client
   */
  private getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    return createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Generate new lead notification email
   */
  async generateNewLeadEmail(
    customer: Customer,
    lead: Lead
  ): Promise<EmailContent> {
    if (!customer.branch_id) {
      throw new Error('Customer has no branch assigned');
    }

    // Get email template
    const template = await this.getEmailTemplate(customer.branch_id, 'new_lead');
    
    if (!template) {
      throw new Error('No email template found for this branch');
    }

    // Get notification fields
    const notificationFields = await this.getNotificationFields(customer.branch_id, lead);

    // Build context
    const context: EmailContext = {
      customerName: customer.name || 'Klant',
      leadName: lead.name,
      leadEmail: lead.email,
      leadPhone: lead.phone,
      notificationFields: notificationFields,
      portalLink: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.warmeleads.eu'}/portal/leads`,
      totalLeads: customer.leadData?.length || 0
    };

    // Render templates
    const subject = this.renderTemplate(template.subjectTemplate, context);
    const body = this.renderTemplate(template.bodyTemplate, context);

    return {
      subject,
      body,
      to: customer.email
    };
  }

  /**
   * Get email template from database
   */
  private async getEmailTemplate(
    branchId: string,
    templateType: string
  ): Promise<EmailTemplate | null> {
    const supabase = this.getSupabaseClient();

    const { data, error } = await supabase
      .from('branch_email_templates')
      .select('*')
      .eq('branch_id', branchId)
      .eq('template_type', templateType)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching email template:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      branchId: data.branch_id,
      templateType: data.template_type,
      subjectTemplate: data.subject_template,
      bodyTemplate: data.body_template,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Get notification fields for email
   * Returns ALL fields from the lead (not just those marked include_in_email)
   */
  private async getNotificationFields(
    branchId: string,
    lead: Lead
  ): Promise<Array<{ label: string; value: string; icon?: string }>> {
    const supabase = this.getSupabaseClient();

    // Get ALL field mappings for this branch (not filtered by include_in_email)
    const { data, error } = await supabase
      .from('branch_field_mappings')
      .select('field_key, field_label, field_type, email_priority')
      .eq('branch_id', branchId)
      .order('email_priority', { ascending: false })
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching notification fields:', error);
      return [];
    }

    // Build field list with ALL fields
    const fields: Array<{ label: string; value: string; icon?: string }> = [];

    // First add core fields (name, email, phone) if they exist
    if (lead.name) {
      fields.push({
        label: 'Naam',
        value: lead.name,
        icon: '👤'
      });
    }

    if (lead.email) {
      fields.push({
        label: 'E-mail',
        value: `<a href="mailto:${lead.email}">${lead.email}</a>`,
        icon: '📧'
      });
    }

    if (lead.phone) {
      fields.push({
        label: 'Telefoon',
        value: `<a href="tel:${lead.phone}">${lead.phone}</a>`,
        icon: '📞'
      });
    }

    // Then add all mapped fields from branchData
    (data || []).forEach(mapping => {
      // Skip core fields we already added
      if (['name', 'email', 'phone'].includes(mapping.field_key)) {
        return;
      }

      let value = lead.branchData?.[mapping.field_key];

      // Get from core fields if not in branchData
      if (value === undefined || value === null) {
        value = this.getValueFromCoreFields(lead, mapping.field_key);
      }

      // Skip empty values
      if (value === undefined || value === null || value === '') {
        return;
      }

      // Format value
      const formattedValue = this.formatFieldValue(value, mapping.field_type);

      if (formattedValue) {
        // Get icon based on field type or key
        const icon = this.getFieldIcon(mapping.field_key, mapping.field_type);

        fields.push({
          label: mapping.field_label,
          value: formattedValue,
          icon: icon
        });
      }
    });

    return fields;
  }

  /**
   * Get icon for field based on key or type
   */
  private getFieldIcon(fieldKey: string, fieldType: string): string {
    const iconMap: Record<string, string> = {
      name: '👤',
      email: '📧',
      phone: '📞',
      company: '🏢',
      address: '📍',
      postcode: '📍',
      city: '🏙️',
      interest: '💼',
      budget: '💰',
      timeline: '📅',
      notes: '📝',
      status: '📊',
      zonnepanelen: '☀️',
      stroomverbruik: '🔌',
      dynamischContract: '⚡',
    };

    return iconMap[fieldKey.toLowerCase()] || '📋';
  }

  /**
   * Get value from core Lead fields
   */
  private getValueFromCoreFields(lead: Lead, fieldKey: string): any {
    const coreFieldMap: Record<string, keyof Lead> = {
      customerName: 'name',
      email: 'email',
      phone: 'phone',
      city: 'city',
      company: 'company',
      address: 'address',
      budget: 'budget',
      notes: 'notes',
      status: 'status',
      dealValue: 'dealValue',
      profit: 'profit',
    };

    const coreField = coreFieldMap[fieldKey];
    return coreField ? lead[coreField] : '';
  }

  /**
   * Format field value for display in email
   */
  private formatFieldValue(value: any, fieldType: string): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    switch (fieldType) {
      case 'boolean':
        return value ? '✓ Ja' : '✗ Nee';

      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString('nl-NL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
        return value.toString();

      case 'currency':
        if (typeof value === 'number') {
          return new Intl.NumberFormat('nl-NL', {
            style: 'currency',
            currency: 'EUR'
          }).format(value);
        }
        return value.toString();

      case 'email':
        return `<a href="mailto:${value}">${value}</a>`;

      case 'phone':
        return `<a href="tel:${value}">${value}</a>`;

      case 'url':
        return `<a href="${value}" target="_blank">${value}</a>`;

      default:
        return value.toString();
    }
  }

  /**
   * Render template with Handlebars
   */
  private renderTemplate(template: string, context: any): string {
    try {
      // Register custom helpers
      Handlebars.registerHelper('each', function(context, options) {
        let ret = '';
        if (Array.isArray(context)) {
          for (let i = 0; i < context.length; i++) {
            ret += options.fn(context[i]);
          }
        }
        return ret;
      });

      // Helper for safe HTML rendering (triple braces {{{ }}})
      Handlebars.registerHelper('safe', function(str) {
        return new Handlebars.SafeString(str);
      });

      const compiledTemplate = Handlebars.compile(template);
      return compiledTemplate(context);
    } catch (error) {
      console.error('Error rendering template:', error);
      return template; // Return original if rendering fails
    }
  }

  /**
   * Send email using API
   */
  async sendEmail(emailContent: EmailContent): Promise<boolean> {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailContent)
      });

      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.statusText}`);
      }

      console.log(`✅ Email sent to ${emailContent.to}`);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Send new lead notification
   */
  async sendNewLeadNotification(
    customer: Customer,
    lead: Lead
  ): Promise<boolean> {
    try {
      const emailContent = await this.generateNewLeadEmail(customer, lead);
      return await this.sendEmail(emailContent);
    } catch (error) {
      console.error('Error sending new lead notification:', error);
      return false;
    }
  }
}

// Singleton instance
export const dynamicEmailGenerator = new DynamicEmailGenerator();


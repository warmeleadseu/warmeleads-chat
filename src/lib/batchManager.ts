/**
 * Batch Manager for Meta Campaign Fulfillment
 * Handles batch counting, completion, and lead distribution
 */

import { createServerClient } from './supabase';
import { readCustomerLeads, GoogleSheetsService, addLeadToSheet } from './googleSheetsAPI';
import { crmSystem } from './crmSystem';
import type { Lead } from './crmSystem';

export interface CampaignBatch {
  id: string;
  customerEmail: string;
  metaCampaignId: string;
  totalBatchSize: number;
  currentBatchCount: number;
  isBatchActive: boolean;
  branchId: string;
}

export interface DistributionResult {
  success: boolean;
  leadId?: string;
  error?: string;
  batchCompleted?: boolean;
}

export class BatchManager {
  /**
   * Process a qualified Meta lead
   */
  static async processQualifiedLead(
    metaLeadId: string,
    campaignId: string,
    leadData: any
  ): Promise<DistributionResult> {
    try {
      console.log(`🎯 Processing qualified lead ${metaLeadId} for campaign ${campaignId}`);

      // 1. Get campaign details
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // 2. Check batch capacity again (double-check)
      if (campaign.currentBatchCount >= campaign.totalBatchSize) {
        throw new Error(`Batch already full (${campaign.currentBatchCount}/${campaign.totalBatchSize})`);
      }

      // 3. Create lead in database
      const leadId = await this.createLead(leadData, campaign);
      console.log(`✅ Created lead ${leadId} in database`);

      // 4. Distribute to customer spreadsheet
      await this.distributeToSpreadsheet(leadId, campaign);
      console.log(`✅ Distributed lead to customer spreadsheet`);

      // 5. Update batch counter
      await this.incrementBatchCount(campaignId);
      console.log(`📊 Updated batch count to ${campaign.currentBatchCount + 1}/${campaign.totalBatchSize}`);

      // 6. Check if batch is now complete
      const batchCompleted = (campaign.currentBatchCount + 1) >= campaign.totalBatchSize;

      if (batchCompleted) {
        await this.completeBatch(campaignId);
        console.log(`🎉 Batch completed for campaign ${campaignId}`);

        // Send completion notification
        await this.sendBatchCompletionNotification(campaign.customerEmail, campaign);
      }

      return {
        success: true,
        leadId,
        batchCompleted
      };

    } catch (error) {
      console.error(`❌ Error processing qualified lead ${metaLeadId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get campaign details by Meta campaign ID
   */
  private static async getCampaign(metaCampaignId: string): Promise<CampaignBatch | null> {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('customer_meta_campaigns')
      .select('*')
      .eq('meta_campaign_id', metaCampaignId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error('Error fetching campaign:', error);
      return null;
    }

    return {
      id: data.id,
      customerEmail: data.customer_email,
      metaCampaignId: data.meta_campaign_id,
      totalBatchSize: data.total_batch_size,
      currentBatchCount: data.current_batch_count,
      isBatchActive: data.is_batch_active,
      branchId: data.branch_id
    };
  }

  /**
   * Create lead in the main leads table
   */
  private static async createLead(leadData: any, campaign: CampaignBatch): Promise<string> {
    const supabase = createServerClient();

    // Create lead object
    const lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> = {
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
      status: 'new',
      dealValue: undefined,
      profit: undefined,
      assignedTo: undefined,
      source: 'campaign',
      sheetRowNumber: undefined,
      branchData: {},
      metaLeadId: leadData.metaLeadId,
      metaCampaignId: campaign.metaCampaignId,
      qualificationScore: leadData.qualificationScore,
      territoryDistance: leadData.territoryDistance
    };

    // Insert into leads table
    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create lead: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Distribute lead to customer spreadsheet
   */
  private static async distributeToSpreadsheet(leadId: string, campaign: CampaignBatch): Promise<void> {
    try {
      // Get customer data to find spreadsheet URL
      const customer = await crmSystem.getCustomerById(campaign.customerEmail);
      if (!customer?.googleSheetUrl) {
        throw new Error(`No Google Sheet URL found for customer ${campaign.customerEmail}`);
      }

      // Get the lead data
      const supabase = createServerClient();
      const { data: lead, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error || !lead) {
        throw new Error(`Failed to fetch lead ${leadId}`);
      }

      // Add to Google Sheet
      await addLeadToSheet(customer.googleSheetUrl, lead);

      console.log(`📊 Lead ${leadId} added to Google Sheet for ${campaign.customerEmail}`);

    } catch (error) {
      console.error(`❌ Failed to distribute lead ${leadId} to spreadsheet:`, error);
      throw error;
    }
  }

  /**
   * Increment batch counter
   */
  private static async incrementBatchCount(campaignId: string): Promise<void> {
    const supabase = createServerClient();

    // First get current count
    const { data: currentCampaign, error: getError } = await supabase
      .from('customer_meta_campaigns')
      .select('current_batch_count')
      .eq('id', campaignId)
      .single();

    if (getError || !currentCampaign) {
      throw new Error(`Failed to get current batch count: ${getError?.message}`);
    }

    // Update with incremented count
    const { error } = await supabase
      .from('customer_meta_campaigns')
      .update({
        current_batch_count: currentCampaign.current_batch_count + 1,
        last_lead_received: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (error) {
      throw new Error(`Failed to increment batch count: ${error.message}`);
    }
  }

  /**
   * Mark batch as completed
   */
  private static async completeBatch(campaignId: string): Promise<void> {
    const supabase = createServerClient();

    const { error } = await supabase
      .from('customer_meta_campaigns')
      .update({
        is_batch_active: false,
        batch_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (error) {
      throw new Error(`Failed to complete batch: ${error.message}`);
    }
  }

  /**
   * Send batch completion notification
   */
  private static async sendBatchCompletionNotification(
    customerEmail: string,
    campaign: CampaignBatch
  ): Promise<void> {
    try {
      console.log(`📧 Sending batch completion notification to ${customerEmail}`);

      // In a real implementation, you'd send an email here
      // For now, we'll just log it
      console.log(`🎉 Batch compleet voor ${customerEmail}: ${campaign.totalBatchSize}/${campaign.totalBatchSize} leads ontvangen voor campagne ${campaign.metaCampaignId}`);

      // TODO: Implement actual email sending
      // await sendEmail({
      //   to: customerEmail,
      //   subject: `Batch compleet: ${campaign.totalBatchSize} leads ontvangen`,
      //   template: 'batch_completed',
      //   data: { campaign, customerEmail }
      // });

    } catch (error) {
      console.error('Failed to send batch completion notification:', error);
    }
  }

  /**
   * Get batch status for a campaign
   */
  static async getBatchStatus(metaCampaignId: string): Promise<{
    currentCount: number;
    totalSize: number;
    isActive: boolean;
    isComplete: boolean;
  } | null> {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('customer_meta_campaigns')
      .select('current_batch_count, total_batch_size, is_batch_active, batch_completed_at')
      .eq('meta_campaign_id', metaCampaignId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      currentCount: data.current_batch_count,
      totalSize: data.total_batch_size,
      isActive: data.is_batch_active,
      isComplete: !!data.batch_completed_at
    };
  }

  /**
   * Reset batch for a campaign (admin function)
   */
  static async resetBatch(campaignId: string): Promise<void> {
    const supabase = createServerClient();

    const { error } = await supabase
      .from('customer_meta_campaigns')
      .update({
        current_batch_count: 0,
        is_batch_active: true,
        batch_completed_at: null,
        last_lead_received: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (error) {
      throw new Error(`Failed to reset batch: ${error.message}`);
    }
  }
}

/**
 * Meta Lead Qualifier Engine
 * Intelligently qualifies Meta/Facebook leads based on campaign criteria
 */

import { GeographicUtils, TerritoryConfig } from './geographicUtils';

export interface CampaignConfig {
  id: string;
  customerEmail: string;
  metaCampaignId: string;
  metaFormId: string;
  branchId: string;
  totalBatchSize: number;
  currentBatchCount: number;
  isBatchActive: boolean;
  territoryType: 'radius' | 'full_country' | 'regions';
  centerPostcode?: string;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  allowedRegions?: string[];
  isActive: boolean;
}

export interface MetaLeadData {
  id: string; // Facebook lead ID
  campaign_id: string; // Facebook campaign ID
  form_id: string; // Facebook form ID
  created_time: string;
  field_data: Array<{
    name: string;
    values: string[];
  }>;
}

export interface QualifyingResult {
  isQualified: boolean;
  branchMatch: boolean;
  territoryMatch: boolean;
  batchCapacity: boolean;
  score: number; // 0-100 qualification score
  reasons: string[];
  territoryDistance?: number;
  coordinates?: { lat: number; lng: number };
}

export interface ProcessedLeadData {
  name: string;
  email: string;
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  postcode?: string;
  interest: string;
  budget?: string;
  timeline?: string;
  notes?: string;
}

export class MetaLeadQualifier {
  /**
   * Main qualifying function for Meta leads
   */
  static async qualifyLead(
    metaLeadData: MetaLeadData,
    campaign: CampaignConfig
  ): Promise<QualifyingResult> {
    // Extract lead data from Meta format
    const processedData = this.extractLeadData(metaLeadData);

    // 1. Check if campaign is active
    if (!campaign.isActive || !campaign.isBatchActive) {
      return {
        isQualified: false,
        branchMatch: false,
        territoryMatch: false,
        batchCapacity: false,
        score: 0,
        reasons: ['Campagne is niet actief']
      };
    }

    // 2. Branch matching (interest/service type)
    const branchMatch = this.checkBranchMatch(processedData, campaign.branchId);

    // 3. Territory matching (geographic)
    const territoryResult = await this.checkTerritoryMatch(processedData, campaign);

    // 4. Batch capacity check
    const batchCapacity = campaign.currentBatchCount < campaign.totalBatchSize;

    // 5. Calculate overall qualification score
    const score = this.calculateQualificationScore({
      branchMatch,
      territoryMatch: territoryResult.matches,
      batchCapacity,
      hasRequiredFields: this.hasRequiredFields(processedData)
    });

    // 6. Determine if lead is qualified
    const isQualified = branchMatch && territoryResult.matches && batchCapacity;

    // 7. Generate reasons for qualification result
    const reasons = this.generateQualificationReasons({
      branchMatch,
      territoryMatch: territoryResult.matches,
      batchCapacity,
      campaign
    });

    return {
      isQualified,
      branchMatch,
      territoryMatch: territoryResult.matches,
      batchCapacity,
      score,
      reasons,
      territoryDistance: territoryResult.distance,
      coordinates: territoryResult.coordinates
    };
  }

  /**
   * Extract clean lead data from Meta webhook format
   */
  private static extractLeadData(metaLead: MetaLeadData): ProcessedLeadData {
    const fieldMap: Record<string, string> = {};

    // Map Meta field names to our field names
    metaLead.field_data.forEach(field => {
      const name = field.name.toLowerCase();
      const value = field.values[0] || '';

      // Meta field name mapping
      switch (name) {
        case 'full_name':
        case 'name':
          fieldMap.name = value;
          break;
        case 'email':
          fieldMap.email = value;
          break;
        case 'phone':
        case 'phone_number':
          fieldMap.phone = value;
          break;
        case 'company':
        case 'company_name':
        case 'business_name':
          fieldMap.company = value;
          break;
        case 'address':
        case 'street_address':
          fieldMap.address = value;
          break;
        case 'city':
          fieldMap.city = value;
          break;
        case 'postcode':
        case 'zip_code':
        case 'postal_code':
          fieldMap.postcode = value;
          break;
        case 'service':
        case 'interest':
        case 'service_type':
        case 'what_are_you_interested_in':
          fieldMap.interest = value;
          break;
        case 'budget':
        case 'monthly_budget':
        case 'budget_range':
          fieldMap.budget = value;
          break;
        case 'timeline':
        case 'when_do_you_need_this':
        case 'project_timeline':
          fieldMap.timeline = value;
          break;
        case 'message':
        case 'additional_info':
        case 'notes':
        case 'comments':
          fieldMap.notes = value;
          break;
      }
    });

    return {
      name: fieldMap.name || 'Onbekend',
      email: fieldMap.email || '',
      phone: fieldMap.phone || '',
      company: fieldMap.company,
      address: fieldMap.address,
      city: fieldMap.city,
      postcode: fieldMap.postcode,
      interest: fieldMap.interest || 'Niet gespecificeerd',
      budget: fieldMap.budget,
      timeline: fieldMap.timeline,
      notes: fieldMap.notes
    };
  }

  /**
   * Check if lead interest matches campaign branch
   */
  private static checkBranchMatch(leadData: ProcessedLeadData, campaignBranchId: string): boolean {
    const leadInterest = leadData.interest?.toLowerCase() || '';
    const campaignBranch = campaignBranchId.toLowerCase();

    // Branch matching logic - customize based on your branch categories
    const branchKeywords: Record<string, string[]> = {
      'thuisbatterijen': [
        'thuisbatterij', 'home battery', 'huisbatterij', 'batterij',
        'zonne-energie', 'solar battery', 'energieopslag', 'battery storage'
      ],
      'kozijnen': [
        'kozijn', 'window', 'raam', 'deur', 'kozijnen',
        'houtwerk', 'carpentry', 'windows', 'doors'
      ],
      'warmtepompen': [
        'warmtepomp', 'heat pump', 'warmte pomp', 'verwarming',
        'duurzaam verwarmen', 'warmtepomp', 'heatpump'
      ],
      'financial-lease': [
        'financial lease', 'financiële lease', 'lease', 'financial',
        'bedrijfswagen', 'bestelwagen', 'auto lease', 'financiering'
      ],
      'zonnepanelen': [
        'zonnepaneel', 'zonnepanelen', 'solar panel', 'zonne-energie',
        'photovoltaic', 'pv-panelen', 'zonne-installatie'
      ],
      'airco': [
        'airco', 'airconditioning', 'air conditioning', 'klimaatbeheersing',
        'koeling', 'verwarming', 'climate control'
      ]
    };

    const keywords = branchKeywords[campaignBranch] || [];
    return keywords.some(keyword => leadInterest.includes(keyword));
  }

  /**
   * Check if lead falls within campaign territory
   */
  private static async checkTerritoryMatch(
    leadData: ProcessedLeadData,
    campaign: CampaignConfig
  ): Promise<{ matches: boolean; distance?: number; coordinates?: { lat: number; lng: number } }> {
    if (!leadData.postcode) {
      return { matches: false };
    }

    const territoryConfig: TerritoryConfig = {
      type: campaign.territoryType,
      centerPostcode: campaign.centerPostcode,
      centerLat: campaign.centerLat,
      centerLng: campaign.centerLng,
      radiusKm: campaign.radiusKm,
      allowedRegions: campaign.allowedRegions
    };

    const result = await GeographicUtils.postcodeInTerritory(leadData.postcode, territoryConfig);

    return {
      matches: result.matches,
      distance: result.distance,
      coordinates: result.coordinates
    };
  }

  /**
   * Check if lead has required fields for processing
   */
  private static hasRequiredFields(leadData: ProcessedLeadData): boolean {
    // At minimum we need name, email/phone, and postcode for geographic matching
    const hasContact = (leadData.email && leadData.email.includes('@')) ||
                      (leadData.phone && leadData.phone.length > 6);

    return !!(leadData.name && hasContact && leadData.postcode);
  }

  /**
   * Calculate qualification score (0-100)
   */
  private static calculateQualificationScore(factors: {
    branchMatch: boolean;
    territoryMatch: boolean;
    batchCapacity: boolean;
    hasRequiredFields: boolean;
  }): number {
    let score = 0;

    // Base requirements (must-haves)
    if (factors.branchMatch) score += 30;
    if (factors.territoryMatch) score += 30;
    if (factors.batchCapacity) score += 20;
    if (factors.hasRequiredFields) score += 20;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate human-readable reasons for qualification result
   */
  private static generateQualificationReasons(context: {
    branchMatch: boolean;
    territoryMatch: boolean;
    batchCapacity: boolean;
    campaign: CampaignConfig;
  }): string[] {
    const reasons: string[] = [];

    if (!context.branchMatch) {
      reasons.push(`Branche komt niet overeen met campagne (${context.campaign.branchId})`);
    }

    if (!context.territoryMatch) {
      const territoryDesc = GeographicUtils.getTerritoryDescription({
        type: context.campaign.territoryType,
        centerPostcode: context.campaign.centerPostcode,
        centerLat: context.campaign.centerLat,
        centerLng: context.campaign.centerLng,
        radiusKm: context.campaign.radiusKm,
        allowedRegions: context.campaign.allowedRegions
      });
      reasons.push(`Buiten campagnegebied (${territoryDesc})`);
    }

    if (!context.batchCapacity) {
      reasons.push(`Batch is vol (${context.campaign.currentBatchCount}/${context.campaign.totalBatchSize})`);
    }

    if (context.branchMatch && context.territoryMatch && context.batchCapacity) {
      reasons.push('Lead gekwalificeerd voor distributie');
    }

    return reasons;
  }

  /**
   * Convert Meta lead to our Lead format
   */
  static metaLeadToLeadFormat(
    metaLead: MetaLeadData,
    qualifyingResult: QualifyingResult,
    campaign: CampaignConfig
  ): ProcessedLeadData & {
    metaLeadId: string;
    metaCampaignId: string;
    qualificationScore: number;
    territoryDistance?: number;
  } {
    const processedData = this.extractLeadData(metaLead);

    return {
      ...processedData,
      metaLeadId: metaLead.id,
      metaCampaignId: metaLead.campaign_id,
      qualificationScore: qualifyingResult.score,
      territoryDistance: qualifyingResult.territoryDistance
    };
  }
}

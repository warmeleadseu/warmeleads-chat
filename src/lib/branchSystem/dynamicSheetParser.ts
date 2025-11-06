/**
 * Dynamic Sheet Parser
 * Database-driven spreadsheet parsing for any branch configuration
 * 
 * NOTE: This runs client-side, so it uses API endpoints instead of direct Supabase calls
 */

import { GoogleSheetsService } from '../googleSheetsAPI';
import { type Lead } from '../crmSystem';
import { type FieldMapping, type FieldType } from './types';

export class DynamicSheetParser {
  private sheetsService: GoogleSheetsService;

  constructor() {
    this.sheetsService = new GoogleSheetsService();
  }

  /**
   * Get branch field mappings from API (server-side)
   */
  async getBranchMappings(branchId: string): Promise<FieldMapping[]> {
    // Fetch from API endpoint (server-side) instead of direct Supabase call
    // Use relative URL for client-side compatibility
    const response = await fetch(`/api/branches/${branchId}/mappings`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching branch mappings:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Failed to fetch branch mappings: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const mappings = data.mappings || [];

    return mappings.map((row: any) => ({
      id: row.id,
      branchId: row.branchId,
      columnLetter: row.columnLetter,
      columnIndex: row.columnIndex,
      headerName: row.headerName,
      fieldKey: row.fieldKey,
      fieldLabel: row.fieldLabel,
      fieldType: row.fieldType as FieldType,
      isRequired: row.isRequired,
      isUnique: row.isUnique,
      validationRegex: row.validationRegex,
      showInList: row.showInList,
      showInDetail: row.showInDetail,
      includeInEmail: row.includeInEmail,
      emailPriority: row.emailPriority,
      helpText: row.helpText,
      placeholder: row.placeholder,
      sortOrder: row.sortOrder,
      createdAt: new Date(row.createdAt)
    }));
  }

  /**
   * Parse leads from spreadsheet using branch configuration
   */
  async parseLeadsForBranch(
    spreadsheetUrl: string,
    branchId: string
  ): Promise<Lead[]> {
    console.log(`📊 Parsing leads for branch: ${branchId}`);
    
    // Get branch mappings
    const mappings = await this.getBranchMappings(branchId);
    
    if (mappings.length === 0) {
      throw new Error('No field mappings found for this branch');
    }

    // Determine sheet range based on mappings
    const maxColumn = mappings[mappings.length - 1].columnLetter;
    const range = `A:${maxColumn}`;

    console.log(`📋 Reading sheet range: ${range}`);

    // Read spreadsheet
    const spreadsheetId = GoogleSheetsService.extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      throw new Error('Invalid spreadsheet URL');
    }

    const rows = await this.sheetsService.readSheet(spreadsheetId, range);
    
    if (rows.length === 0) {
      return [];
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    console.log(`📊 Found ${dataRows.length} data rows`);

    // Parse each row using mappings
    const leads: Lead[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      // Skip empty rows
      if (!row || row.length === 0 || !row[0]) {
        continue;
      }

      try {
        const lead = this.parseRowToLead(row, mappings, i + 2); // +2 for header and 1-indexed
        
        // Only add if we have at least name and email
        if (lead.name && lead.email) {
          leads.push(lead);
        }
      } catch (error) {
        console.error(`Error parsing row ${i + 2}:`, error);
      }
    }

    console.log(`✅ Successfully parsed ${leads.length} leads`);
    
    return leads;
  }

  /**
   * Parse a single row to Lead object
   */
  private parseRowToLead(
    row: any[],
    mappings: FieldMapping[],
    rowNumber: number
  ): Lead {
    const lead: Lead = {
      id: `sheet_${rowNumber}`,
      name: '',
      email: '',
      phone: '',
      interest: '',
      status: 'new',
      createdAt: new Date(),
      updatedAt: new Date(),
      source: 'import',
      sheetRowNumber: rowNumber,
      branchData: {}
    };

    // Process each mapping
    mappings.forEach(mapping => {
      const cellValue = row[mapping.columnIndex];
      const parsedValue = this.parseValue(cellValue, mapping.fieldType);

      // Store in branchData using fieldKey (ALWAYS store in branchData first)
      if (mapping.fieldKey) {
        lead.branchData![mapping.fieldKey] = parsedValue;
        console.log(`  ✅ Stored ${mapping.fieldLabel} (${mapping.fieldKey}) = ${parsedValue}`);
      } else {
        console.warn(`  ⚠️ No fieldKey for mapping: ${mapping.headerName}`);
      }

      // Map to core Lead fields ONLY if this is actually a core field
      // Don't map branch-specific fields that happen to have the same fieldKey as core fields
      // CRITICAL: Only map if headerName matches expected core field names to avoid false positives
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
      
      // Only map if:
      // 1. The fieldKey exists in coreFieldMap
      // 2. AND the headerName matches the expected core field name (to avoid false positives)
      // Example: "Datum interesse klant" should NOT map to 'name' even if fieldKey is 'customerName'
      const coreField = coreFieldMap[mapping.fieldKey];
      if (coreField && this.isCoreField(mapping.headerName, coreField)) {
        (lead as any)[coreField] = parsedValue;
        console.log(`  🔄 Mapped ${mapping.fieldLabel} to core field: ${coreField}`);
      } else if (coreField) {
        console.log(`  ⚠️ Skipped mapping ${mapping.fieldLabel} (fieldKey: ${mapping.fieldKey}) - headerName "${mapping.headerName}" doesn't match core field "${coreField}"`);
      }
    });
    
    console.log(`  🔧 Lead ${lead.name} branchData:`, lead.branchData);

    return lead;
  }

  /**
   * Check if a header name matches a core field (to avoid false positives)
   */
  private isCoreField(headerName: string, coreField: keyof Lead): boolean {
    const headerLower = headerName.toLowerCase();
    
    // Map core fields to their expected header names
    const expectedHeadersMap: Partial<Record<keyof Lead, string[]>> = {
      name: ['naam', 'name', 'klant', 'customer', 'naam klant'],
      email: ['e-mail', 'email', 'mail'],
      phone: ['telefoon', 'phone', 'telefoonnummer'],
      city: ['plaats', 'city', 'plaatsnaam', 'stad'],
      company: ['bedrijf', 'company', 'organisatie'],
      address: ['adres', 'address', 'straat'],
      budget: ['budget', 'prijs', 'investering'],
      notes: ['notities', 'notes', 'opmerkingen'],
      status: ['status', 'staat'],
      dealValue: ['dealvalue', 'deal value', 'omzet'],
      profit: ['profit', 'winst'],
      interest: ['interesse'],
      timeline: ['timeline', 'wanneer', 'termijn'],
      assignedTo: ['toegewezen', 'assigned', 'verkoper'],
    };
    
    const expected = expectedHeadersMap[coreField];
    if (!expected || !Array.isArray(expected)) return false;
    
    return expected.some(expectedHeader => headerLower.includes(expectedHeader));
  }

  /**
   * Parse cell value based on field type
   */
  private parseValue(value: any, fieldType: FieldType): any {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const strValue = value.toString().trim();

    switch (fieldType) {
      case 'number':
        const num = parseFloat(strValue.replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? 0 : num;

      case 'currency':
        const currency = parseFloat(strValue.replace(/[^0-9.-]/g, ''));
        return isNaN(currency) ? 0 : currency;

      case 'boolean':
        return strValue.toLowerCase() === 'ja' ||
               strValue.toLowerCase() === 'yes' ||
               strValue.toLowerCase() === 'true' ||
               strValue === '1';

      case 'date':
        return this.parseDate(strValue);

      case 'email':
        return strValue.toLowerCase();

      case 'phone':
        return strValue.replace(/\s+/g, '');

      default:
        return strValue;
    }
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateText: string): Date {
    if (!dateText) return new Date();

    try {
      // Try DD-MM-YYYY format
      const parts = dateText.split(/[-\/]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);

        if (year > 1900 && month >= 0 && month < 12 && day > 0 && day <= 31) {
          return new Date(year, month, day);
        }
      }

      // Fallback to native parsing
      const parsed = new Date(dateText);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    } catch (error) {
      console.error('Error parsing date:', dateText, error);
    }

    return new Date();
  }

  /**
   * Update lead in sheet using branch configuration
   */
  async updateLeadInSheet(
    lead: Lead,
    spreadsheetUrl: string,
    branchId: string
  ): Promise<boolean> {
    console.log(`🔄 Updating lead ${lead.name} in sheet`);

    // Get branch mappings
    const mappings = await this.getBranchMappings(branchId);

    if (!lead.sheetRowNumber) {
      throw new Error('Lead has no sheet row number');
    }

    // Build row data according to mappings
    const rowData: any[] = [];
    
    mappings.forEach(mapping => {
      let value = lead.branchData?.[mapping.fieldKey];

      // Get from core fields if not in branchData
      if (value === undefined || value === null) {
        value = this.getValueFromCoreFields(lead, mapping.fieldKey);
      }

      // Format value
      rowData[mapping.columnIndex] = this.formatValue(value, mapping.fieldType);
    });

    // Update in sheet
    const spreadsheetId = GoogleSheetsService.extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      throw new Error('Invalid spreadsheet URL');
    }

    const maxColumn = mappings[mappings.length - 1].columnLetter;
    const range = `A${lead.sheetRowNumber}:${maxColumn}${lead.sheetRowNumber}`;

    try {
      await this.sheetsService.updateSheet(spreadsheetId, range, [rowData]);
      console.log(`✅ Successfully updated lead in sheet`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update lead in sheet:`, error);
      throw error;
    }
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
   * Format value for writing to sheet
   */
  private formatValue(value: any, fieldType: FieldType): string {
    if (value === null || value === undefined) {
      return '';
    }

    switch (fieldType) {
      case 'boolean':
        return value ? 'Ja' : 'Nee';

      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString('nl-NL');
        }
        return value.toString();

      case 'currency':
        if (typeof value === 'number') {
          return `€ ${value.toFixed(2)}`;
        }
        return value.toString();

      default:
        return value.toString();
    }
  }

  /**
   * Add new lead to sheet
   */
  async addLeadToSheet(
    lead: Lead,
    spreadsheetUrl: string,
    branchId: string
  ): Promise<boolean> {
    console.log(`➕ Adding new lead ${lead.name} to sheet`);

    const mappings = await this.getBranchMappings(branchId);
    const spreadsheetId = GoogleSheetsService.extractSpreadsheetId(spreadsheetUrl);
    
    if (!spreadsheetId) {
      throw new Error('Invalid spreadsheet URL');
    }

    // Read current data to find next row
    const maxColumn = mappings[mappings.length - 1].columnLetter;
    const currentData = await this.sheetsService.readSheet(spreadsheetId, `A:${maxColumn}`);
    const nextRowIndex = currentData.length + 1;

    // Build row data
    const rowData: any[] = [];
    mappings.forEach(mapping => {
      let value = lead.branchData?.[mapping.fieldKey];
      if (value === undefined || value === null) {
        value = this.getValueFromCoreFields(lead, mapping.fieldKey);
      }
      rowData[mapping.columnIndex] = this.formatValue(value, mapping.fieldType);
    });

    // Write to sheet
    const range = `A${nextRowIndex}:${maxColumn}${nextRowIndex}`;
    
    try {
      await this.sheetsService.updateSheet(spreadsheetId, range, [rowData]);
      console.log(`✅ Successfully added lead to row ${nextRowIndex}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to add lead to sheet:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const dynamicSheetParser = new DynamicSheetParser();

// Real Google Sheets API Integration
import { type Lead } from './crmSystem';

// Simple in-memory cache for Google Sheets data
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Cache TTL: 5 minutes for fast loading
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  range: string; // e.g., 'Leads!A1:K1000'
  apiKey?: string;
}

export interface SheetRow {
  [key: string]: string | number;
}

// Google Sheets API service
export class GoogleSheetsService {
  private apiKey: string;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ Google Sheets API key not configured. Set NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY environment variable.');
    }
  }

  // Read data from Google Sheets using Service Account (primary) or API key (fallback)
  async readSheet(spreadsheetId: string, range: string = 'Sheet1!A1:K1000'): Promise<any[][]> {
    // Check cache first
    const cacheKey = `${spreadsheetId}:${range}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log('✅ Using cached Google Sheets data:', cacheKey);
      return cached.data;
    }
    
    try {
      console.log('🔄 Reading Google Sheet with Service Account:', { 
        spreadsheetId: spreadsheetId.substring(0, 10) + '...', 
        range
      });
      
      // Try Service Account first (more reliable, no restrictions)
      try {
        const tokenResponse = await fetch('/api/sheets-auth');
        if (tokenResponse.ok) {
          const { access_token } = await tokenResponse.json();
          
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Accept': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            
            console.log('✅ Google Sheets data loaded via Service Account:', {
              rows: data.values?.length || 0,
              columns: data.values?.[0]?.length || 0,
              firstRow: data.values?.[0] || 'No data'
            });

            const result = data.values || [];
            
            // Cache the result
            cache.set(cacheKey, {
              data: result,
              timestamp: Date.now(),
              ttl: CACHE_TTL
            });
            
            return result;
          }
          
          console.warn('⚠️ Service Account read failed, trying API key fallback...');
        }
      } catch (serviceAccountError) {
        console.warn('⚠️ Service Account not available, trying API key fallback:', serviceAccountError);
      }

      // Fallback to API key (for backward compatibility)
      if (!this.apiKey) {
        throw new Error('Google Sheets API key not configured and Service Account unavailable');
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${this.apiKey}`;
      
      console.log('🔄 Reading Google Sheet with API key fallback');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Sheets API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          url: url.substring(0, 100) + '...'
        });
        
        if (response.status === 400) {
          throw new Error('Ongeldige API key of spreadsheet configuratie. Controleer de Google Sheets API key en spreadsheet toegang.');
        } else if (response.status === 403) {
          throw new Error('Geen toegang tot spreadsheet. Zorg dat de sheet publiek toegankelijk is of deel met warmeleads-sheets-reader@warmeleads-spreadsheet-api.iam.gserviceaccount.com');
        } else if (response.status === 404) {
          throw new Error('Spreadsheet niet gevonden. Controleer de URL.');
        } else {
          throw new Error(`Google Sheets API error: ${response.status} - ${response.statusText}`);
        }
      }

      const data = await response.json();
      
      console.log('✅ Google Sheets data loaded via API key fallback:', {
        rows: data.values?.length || 0,
        columns: data.values?.[0]?.length || 0,
        firstRow: data.values?.[0] || 'No data'
      });

      const result = data.values || [];
      
      // Cache the result
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        ttl: CACHE_TTL
      });
      
      return result;
    } catch (error) {
      console.error('Error reading Google Sheet:', error);
      throw error;
    }
  }

  // Convert sheet rows to Lead objects with branch-specific mapping
  parseLeadsFromSheet(rows: any[][], headerRow: number = 0): Lead[] {
    if (rows.length <= headerRow) {
      return [];
    }

    const headers = rows[headerRow].map(h => h.toString().toLowerCase().trim());
    const dataRows = rows.slice(headerRow + 1);
    
    console.log('📋 Sheet headers found:', headers);
    console.log('📋 Total columns in sheet:', headers.length);
    console.log('📋 Headers with index:', headers.map((h, i) => `${i}: "${h}"`));
    
    const leads: Lead[] = [];

    dataRows.forEach((row, index) => {
      if (row.length === 0 || !row[0]) return; // Skip empty rows
      
      try {
        console.log(`\n🔍 Parsing row ${index + headerRow + 2}:`, row);
        
        // Get all branch-specific values first
        const zonnepanelen = this.getCellValue(row, headers, ['zonnepanelen']);
        const dynamischContract = this.getCellValue(row, headers, ['dynamisch contract']);
        const stroomverbruik = this.getCellValue(row, headers, ['stroomverbruik']);
        const nieuwsbrief = this.getCellValue(row, headers, ['nieuwsbrief']);
        const redenThuisbatterij = this.getCellValue(row, headers, ['reden thuisbatterij']);
        const koopintentie = this.getCellValue(row, headers, ['koopintentie?', 'koopintentie']);
        
        // Get "Resultaat gesprek" from column O (index 14)
        const resultaatGesprek = this.getCellValue(row, headers, ['resultaat gesprek', 'resultaat', 'gesprek resultaat', 'notities', 'notes']);
        const notes = resultaatGesprek || '';
        
        // Get Status from column P (index 15)
        const statusValue = this.getCellValue(row, headers, ['status', 'staat']);
        
        // Get DealValue from column Q (index 16)
        const dealValueStr = this.getCellValue(row, headers, ['dealvalue', 'deal value', 'omzet']);
        const dealValue = dealValueStr ? parseFloat(dealValueStr.replace(/[^0-9.-]/g, '')) : undefined;
        
        // Get Profit from column R (index 17)
        const profitStr = this.getCellValue(row, headers, ['profit', 'winst']);
        const profit = profitStr ? parseFloat(profitStr.replace(/[^0-9.-]/g, '')) : undefined;

        // Basic lead data
        const lead: Lead = {
          id: `sheet_${index + headerRow + 1}`,
          name: this.getCellValue(row, headers, ['naam klant', 'naam', 'name', 'klant']) || 'Onbekend',
          email: this.getCellValue(row, headers, ['e-mail', 'email', 'mail']) || '',
          phone: this.getCellValue(row, headers, ['telefoonnummer', 'telefoon', 'phone', 'tel', 'mobiel']) || '',
          company: this.getCellValue(row, headers, ['bedrijf', 'company', 'organisatie']) || '',
          address: this.getCellValue(row, headers, ['adres', 'address', 'straat']) || '',
          city: this.getCellValue(row, headers, ['stad', 'city', 'plaats', 'woonplaats']) || '',
          interest: redenThuisbatterij || this.getCellValue(row, headers, ['interesse', 'interest', 'product', 'behoefte']) || 'Thuisbatterij',
          budget: this.getCellValue(row, headers, ['budget', 'prijs', 'investering']) || '',
          timeline: this.getCellValue(row, headers, ['timeline', 'wanneer', 'termijn', 'planning']) || '',
          notes: notes,
          status: statusValue ? this.parseStatus(statusValue) : 'new',
          dealValue: dealValue,
          profit: profit,
          assignedTo: this.getCellValue(row, headers, ['toegewezen', 'assigned', 'verkoper']) || '',
          createdAt: (() => {
            const dateStr = this.getCellValue(row, headers, ['datum interesse klant', 'datum', 'date', 'created']);
            const parsedDate = this.parseDate(dateStr);
            if (!parsedDate && dateStr) {
              console.warn(`⚠️ Could not parse date "${dateStr}" for lead ${name}, using current date as fallback`);
            }
            return parsedDate || new Date();
          })(),
          updatedAt: new Date(),
          source: 'import',
          sheetRowNumber: index + headerRow + 2, // +2 because sheets are 1-indexed and we skip header
          
          // Branch-specific data for Thuisbatterijen
          branchData: {
            datumInteresse: this.getCellValue(row, headers, ['datum interesse klant']),
            postcode: this.getCellValue(row, headers, ['postcode']),
            huisnummer: this.getCellValue(row, headers, ['huisnummer']),
            zonnepanelen: zonnepanelen,
            dynamischContract: dynamischContract,
            stroomverbruik: stroomverbruik,
            nieuwsbrief: nieuwsbrief,
            redenThuisbatterij: redenThuisbatterij,
            koopintentie: koopintentie
          }
        };
        
        console.log(`🔧 Lead ${lead.name} branch data:`, lead.branchData);
        console.log(`🔧 Raw values for ${lead.name}:`, {
          zonnepanelen: zonnepanelen,
          dynamischContract: dynamischContract,
          stroomverbruik: stroomverbruik,
          redenThuisbatterij: redenThuisbatterij,
          koopintentie: koopintentie,
          notes: notes
        });
        console.log(`🔧 Lead object has branchData:`, !!lead.branchData);
        console.log(`🔧 Full lead object for ${lead.name}:`, JSON.stringify(lead, null, 2));

        // Only add if we have at least name and email
        if (lead.name !== 'Onbekend' && lead.email) {
          leads.push(lead);
        }
      } catch (error) {
        console.error(`Error parsing row ${index + headerRow + 1}:`, error);
      }
    });

    console.log(`📊 Parsed ${leads.length} leads from ${dataRows.length} rows with branch-specific data`);
    return leads;
  }

  // Helper: Get cell value by column name variants
  private getCellValue(row: any[], headers: string[], columnNames: string[]): string {
    for (const columnName of columnNames) {
      // Try exact match first
      let index = headers.findIndex(h => h === columnName);
      
      // If no exact match, try includes (partial match)
      if (index === -1) {
        index = headers.findIndex(h => h.includes(columnName));
      }
      
      if (index !== -1 && row[index] !== undefined) {
        const value = row[index].toString().trim();
        if (value) {
          console.log(`✅ Found "${columnName}" in column ${index}: "${value}"`);
          return value;
        }
      }
    }
    
    // Debug: Log which columns we tried to find
    console.log(`❌ Could not find any of [${columnNames.join(', ')}] in headers:`, headers);
    return '';
  }

  // Helper: Parse status from sheet
  private parseStatus(statusText: string): Lead['status'] {
    const status = statusText.toLowerCase().trim();
    
    if (status.includes('nieuw') || status.includes('new')) return 'new';
    if (status.includes('contact') || status.includes('gebeld')) return 'contacted';
    if (status.includes('gekwalificeerd') || status.includes('qualified') || status.includes('interesse')) return 'qualified';
    if (status.includes('voorstel') || status.includes('proposal') || status.includes('offerte')) return 'proposal';
    if (status.includes('onderhandel') || status.includes('negotiation')) return 'negotiation';
    if (status.includes('geconverteerd') || status.includes('converted') || status.includes('verkocht') || status.includes('klant')) return 'converted';
    if (status.includes('deal') || status.includes('gesloten') || status.includes('afgerond') || status.includes('gewonnen')) return 'deal_closed';
    if (status.includes('verloren') || status.includes('lost') || status.includes('afgewezen')) return 'lost';
    
    return 'new'; // Default
  }

  // Helper: Parse deal value from sheet
  private parseDealValue(valueText: string): number | undefined {
    if (!valueText) return undefined;
    
    try {
      // Remove currency symbols and spaces
      const cleanValue = valueText.replace(/[€$£¥,\s]/g, '').replace(/\./g, '');
      const value = parseFloat(cleanValue);
      
      if (!isNaN(value) && value > 0) {
        return value;
      }
    } catch (error) {
      console.error('Error parsing deal value:', valueText, error);
    }
    
    return undefined;
  }

  // Helper: Parse date from sheet (mobile-friendly)
  private parseDate(dateText: string): Date | null {
    if (!dateText) return null;
    
    try {
      // Trim whitespace
      dateText = dateText.trim();
      
      // Try DD-MM-YYYY or DD/MM/YYYY format first (most common in NL sheets)
      const parts = dateText.split(/[-\/]/);
      if (parts.length === 3) {
        let day: number, month: number, year: number;
        
        // Check if first part is likely a day (1-31) - DD-MM-YYYY format
        const firstNum = parseInt(parts[0]);
        if (firstNum >= 1 && firstNum <= 31) {
          day = firstNum;
          month = parseInt(parts[1]) - 1; // Month is 0-indexed
          year = parseInt(parts[2]);
          
          // Handle 2-digit years
          if (year < 100) {
            year += year < 50 ? 2000 : 1900;
          }
        } 
        // Otherwise assume YYYY-MM-DD or MM-DD-YYYY
        else {
          const secondNum = parseInt(parts[1]);
          const thirdNum = parseInt(parts[2]);
          
          // YYYY-MM-DD format
          if (firstNum > 31) {
            year = firstNum;
            month = secondNum - 1;
            day = thirdNum;
          }
          // MM-DD-YYYY format
          else {
            month = firstNum - 1;
            day = secondNum;
            year = thirdNum;
            if (year < 100) {
              year += year < 50 ? 2000 : 1900;
            }
          }
        }
        
        // Validate and create date
        if (year > 1900 && year < 2100 && month >= 0 && month < 12 && day > 0 && day <= 31) {
          const parsedDate = new Date(year, month, day);
          // Verify the date is valid (handles invalid dates like 31 Feb)
          if (parsedDate.getFullYear() === year && 
              parsedDate.getMonth() === month && 
              parsedDate.getDate() === day) {
            return parsedDate;
          }
        }
      }
      
      // Try ISO 8601 format (YYYY-MM-DDTHH:mm:ss)
      if (dateText.includes('T') || dateText.includes(':')) {
        const date = new Date(dateText);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Last resort: try native Date parsing (but this is unreliable on mobile)
      const date = new Date(dateText);
      if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
        return date;
      }
      
    } catch (error) {
      console.error('Error parsing date:', dateText, error);
    }
    
    return null;
  }

  // Write data back to Google Sheets using Service Account (primary) or API key (fallback)
  async updateSheet(spreadsheetId: string, range: string, values: any[][]): Promise<boolean> {
    try {
      console.log('📝 Updating Google Sheet with Service Account:', {
        spreadsheetId: spreadsheetId.substring(0, 10) + '...',
        range,
        rowsToUpdate: values.length,
        firstRowData: values[0]
      });

      // Try Service Account first (has write access)
      try {
        const tokenResponse = await fetch('/api/sheets-auth');
        if (tokenResponse.ok) {
          const { access_token } = await tokenResponse.json();
          
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
          
          const response = await fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              values: values,
              majorDimension: 'ROWS'
            }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Google Sheets update successful via Service Account:', data);
            return true;
          }
          
          const errorText = await response.text();
          console.warn('⚠️ Service Account write failed:', errorText);
        }
      } catch (serviceAccountError) {
        console.warn('⚠️ Service Account not available for write, trying API key fallback:', serviceAccountError);
      }

      // Fallback to API key (will likely fail for write, but try anyway)
      if (!this.apiKey) {
        throw new Error('❌ WRITE TOEGANG VEREIST: Share de spreadsheet met warmeleads-sheets-reader@warmeleads-spreadsheet-api.iam.gserviceaccount.com als Editor');
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED&key=${this.apiKey}`;
      
      console.log('🔄 Trying Google Sheet update with API key fallback');
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          values: values,
          majorDimension: 'ROWS'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Sheets update error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        if (response.status === 401 || response.status === 403) {
          throw new Error('❌ WRITE TOEGANG VEREIST: Share de spreadsheet met warmeleads-sheets-reader@warmeleads-spreadsheet-api.iam.gserviceaccount.com als Editor');
        } else if (response.status === 404) {
          throw new Error('❌ NIET GEVONDEN: Spreadsheet of range niet gevonden.');
        } else {
          throw new Error(`❌ API ERROR: ${response.status} - ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('✅ Google Sheets update successful via API key fallback:', data);
      return true;
      
    } catch (error) {
      console.error('Error updating Google Sheet:', error);
      throw error;
    }
  }

  // Append data to Google Sheets using Service Account (primary) or API key (fallback)
  async appendToSheet(spreadsheetId: string, range: string, values: any[][]): Promise<boolean> {
    try {
      console.log('📝 Appending to Google Sheet with Service Account:', {
        spreadsheetId: spreadsheetId.substring(0, 10) + '...',
        range,
        rowsToAppend: values.length,
        firstRowData: values[0]
      });

      // Try Service Account first (has write access)
      try {
        const tokenResponse = await fetch('/api/sheets-auth');
        if (tokenResponse.ok) {
          const { access_token } = await tokenResponse.json();
          
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              values: values,
              majorDimension: 'ROWS'
            }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Google Sheets append successful via Service Account:', data);
            return true;
          }
          
          const errorText = await response.text();
          console.warn('⚠️ Service Account append failed:', errorText);
        }
      } catch (serviceAccountError) {
        console.warn('⚠️ Service Account not available for append, trying API key fallback:', serviceAccountError);
      }

      // Fallback to API key (will likely fail for write, but try anyway)
      if (!this.apiKey) {
        throw new Error('❌ WRITE TOEGANG VEREIST: Share de spreadsheet met warmeleads-sheets-reader@warmeleads-spreadsheet-api.iam.gserviceaccount.com als Editor');
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&key=${this.apiKey}`;
      
      console.log('🔄 Trying Google Sheet append with API key fallback');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          values: values,
          majorDimension: 'ROWS'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Sheets append error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        if (response.status === 401 || response.status === 403) {
          throw new Error('❌ WRITE TOEGANG VEREIST: Share de spreadsheet met warmeleads-sheets-reader@warmeleads-spreadsheet-api.iam.gserviceaccount.com als Editor');
        } else if (response.status === 404) {
          throw new Error('❌ NIET GEVONDEN: Spreadsheet of range niet gevonden.');
        } else {
          throw new Error(`❌ API ERROR: ${response.status} - ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('✅ Google Sheets append successful via API key fallback:', data);
      return true;
      
    } catch (error) {
      console.error('Error appending to Google Sheet:', error);
      throw error;
    }
  }

  // Extract spreadsheet ID from URL
  static extractSpreadsheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  // Validate if URL is a valid Google Sheets URL
  static isValidSheetsUrl(url: string): boolean {
    return url.includes('docs.google.com/spreadsheets') && this.extractSpreadsheetId(url) !== null;
  }
}

// Helper functions for easy use
export const readCustomerLeads = async (
  spreadsheetUrl: string, 
  apiKey?: string,
  branchId?: string
): Promise<Lead[]> => {
  const spreadsheetId = GoogleSheetsService.extractSpreadsheetId(spreadsheetUrl);
  
  if (!spreadsheetId) {
    throw new Error('Invalid Google Sheets URL');
  }

  console.log('📊 Reading customer leads from spreadsheet:', spreadsheetId.substring(0, 10) + '...');
  
  // If branchId is provided, use DynamicSheetParser (database-driven)
  if (branchId) {
    console.log(`🔧 Using DynamicSheetParser for branch: ${branchId}`);
    try {
      const { dynamicSheetParser } = await import('./branchSystem/dynamicSheetParser');
      const leads = await dynamicSheetParser.parseLeadsForBranch(spreadsheetUrl, branchId);
      console.log(`✅ Successfully parsed ${leads.length} leads using branch configuration`);
      return leads;
    } catch (error) {
      console.error('❌ Error using DynamicSheetParser, falling back to default parser:', error);
      // Fall through to default parser
    }
  }

  // Fallback to hardcoded parser (for backward compatibility with Thuisbatterijen)
  console.log('🔧 Using default parser (Thuisbatterijen hardcoded mapping)');
  const service = new GoogleSheetsService(apiKey);

  // Try different sheet names and ranges - 18 columns (A-R) for Thuisbatterijen
  const possibleRanges = [
    'Sheet1!A1:R1000', // Column A-R (18 columns)
    'Leads!A1:R1000', 
    'A1:R1000',
    'Sheet1!A:R',
    'Leads!A:R'
  ];

  let rows: any[][] = [];
  let usedRange = '';

  for (const range of possibleRanges) {
    try {
      console.log(`🔍 Trying range: ${range}`);
      rows = await service.readSheet(spreadsheetId, range);
      if (rows.length > 0) {
        usedRange = range;
        console.log(`✅ Found data with range: ${range}`);
        break;
      }
    } catch (error) {
      console.log(`❌ Range ${range} failed:`, error instanceof Error ? error.message : 'Unknown error');
      
      // If it's a 400 error (API key issue), don't try other ranges
      if (error instanceof Error && error.message.includes('400')) {
        console.error('🚫 Google Sheets API key issue detected, stopping range attempts');
        throw error;
      }
      continue;
    }
  }

  if (rows.length === 0) {
    throw new Error('Geen data gevonden in spreadsheet. Controleer of de sheet data bevat en publiek toegankelijk is.');
  }
  
  // Parse to Lead objects using hardcoded Thuisbatterijen mapping
  const leads = service.parseLeadsFromSheet(rows);
  console.log(`📊 Successfully parsed ${leads.length} leads from range ${usedRange}`);
  
  return leads;
};

export const updateLeadInSheet = async (
  spreadsheetUrl: string, 
  lead: Lead, 
  apiKey?: string
): Promise<boolean> => {
  const service = new GoogleSheetsService(apiKey);
  const spreadsheetId = GoogleSheetsService.extractSpreadsheetId(spreadsheetUrl);
  
  if (!spreadsheetId || !lead.sheetRowNumber) {
    throw new Error('Invalid spreadsheet URL or missing row number');
  }

  console.log(`🔄 Updating lead ${lead.name} in Google Sheets row ${lead.sheetRowNumber}`);
  console.log(`📊 Lead object before mapping:`, {
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    budget: lead.budget,
    notes: lead.notes,
    status: lead.status,
    branchData: lead.branchData
  });

  // Convert lead back to row format matching your spreadsheet columns:
  // 0: Naam Klant, 1: Datum Interesse Klant, 2: Postcode, 3: Huisnummer, 
  // 4: Plaatsnaam, 5: Telefoonnummer, 6: E-mail, 7: Zonnepanelen, 8: Dynamisch contract,
  // 9: Stroomverbruik, 10: Budget, 11: Nieuwsbrief, 12: Reden Thuisbatterij, 13: Koopintentie?, 
  // 14: Notities, 15: Status, 16: DealValue, 17: Profit
  const rowData = [
    lead.name, // A - Naam Klant
    lead.branchData?.datumInteresse || '', // B - Datum Interesse Klant
    lead.branchData?.postcode || '', // C - Postcode
    lead.branchData?.huisnummer || '', // D - Huisnummer
    lead.city || '', // E - Plaatsnaam
    lead.phone || '', // F - Telefoonnummer
    lead.email || '', // G - E-mail
    lead.branchData?.zonnepanelen || '', // H - Zonnepanelen
    lead.branchData?.dynamischContract || '', // I - Dynamisch contract
    lead.branchData?.stroomverbruik || '', // J - Stroomverbruik
    lead.budget || '', // K - Budget
    lead.branchData?.nieuwsbrief || '', // L - Nieuwsbrief
    lead.branchData?.redenThuisbatterij || '', // M - Reden Thuisbatterij
    lead.branchData?.koopintentie || '', // N - Koopintentie?
    lead.notes || '', // O - Notities
    lead.status || 'new', // P - Status
    lead.dealValue ? lead.dealValue.toString() : '', // Q - DealValue (omzet)
    lead.profit ? lead.profit.toString() : '' // R - Profit (winst)
  ];

  console.log(`🔄 Row data for ${lead.name}:`, rowData);

  // Update the specific row - range A to R (18 columns total)
  const range = `A${lead.sheetRowNumber}:R${lead.sheetRowNumber}`;
  
  try {
    const result = await service.updateSheet(spreadsheetId, range, [rowData]);
    console.log(`✅ Successfully updated ${lead.name} in Google Sheets`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update ${lead.name} in Google Sheets:`, error);
    throw error;
  }
};

// Add new lead to Google Sheets using update method (works with read-only API key)
export const addLeadToSheet = async (
  spreadsheetUrl: string, 
  lead: Lead, 
  apiKey?: string
): Promise<boolean> => {
  const service = new GoogleSheetsService(apiKey);
  const spreadsheetId = GoogleSheetsService.extractSpreadsheetId(spreadsheetUrl);
  
  if (!spreadsheetId) {
    throw new Error('Invalid spreadsheet URL');
  }

  console.log(`🔄 Adding new lead ${lead.name} to Google Sheets using update method`);

  try {
    // First, read the current data to find the next available row
    const currentData = await service.readSheet(spreadsheetId, 'A:R');
    
    if (currentData.length === 0) {
      throw new Error('Could not read current spreadsheet data');
    }

    // Find the next available row (after headers and existing data)
    const nextRowIndex = currentData.length + 1;
    const range = `A${nextRowIndex}:R${nextRowIndex}`;

    // Convert lead to row format matching your spreadsheet columns:
    // 0: Naam Klant, 1: Datum Interesse Klant, 2: Postcode, 3: Huisnummer, 
    // 4: Plaatsnaam, 5: Telefoonnummer, 6: E-mail, 7: Zonnepanelen, 8: Dynamisch contract,
    // 9: Stroomverbruik, 10: Budget, 11: Nieuwsbrief, 12: Reden Thuisbatterij, 13: Koopintentie?, 
    // 14: Notities, 15: Status, 16: DealValue, 17: Profit
    const rowData = [
      lead.name, // A - Naam Klant
      new Date().toLocaleDateString('nl-NL'), // B - Datum Interesse Klant (huidige datum)
      lead.branchData?.postcode || '', // C - Postcode
      lead.branchData?.huisnummer || '', // D - Huisnummer
      lead.city || '', // E - Plaatsnaam
      lead.phone, // F - Telefoonnummer
      lead.email, // G - E-mail
      lead.branchData?.zonnepanelen || '', // H - Zonnepanelen
      lead.branchData?.dynamischContract || '', // I - Dynamisch contract
      lead.branchData?.stroomverbruik || '', // J - Stroomverbruik
      lead.budget || '', // K - Budget
      lead.branchData?.nieuwsbrief || '', // L - Nieuwsbrief
      lead.branchData?.redenThuisbatterij || '', // M - Reden Thuisbatterij
      lead.branchData?.koopintentie || '', // N - Koopintentie?
      lead.notes || '', // O - Notities
      lead.status || 'new', // P - Status
      lead.dealValue ? lead.dealValue.toString() : '', // Q - DealValue (omzet)
      lead.profit ? lead.profit.toString() : '' // R - Profit (winst)
    ];

    console.log(`🔄 Adding lead ${lead.name} to row ${nextRowIndex}:`, rowData);

    // Use update method instead of append (works with read-only API key)
    const result = await service.updateSheet(spreadsheetId, range, [rowData]);
    console.log(`✅ Successfully added ${lead.name} to Google Sheets at row ${nextRowIndex}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to add ${lead.name} to Google Sheets:`, error);
    throw error;
  }
};

/**
 * Add a row to Google Sheets using dynamic column mapping
 * Used by the central lead distribution system
 * 
 * @param spreadsheetUrl - Full URL to the Google Sheet
 * @param rowData - Object with column names as keys and values as strings
 * @param sheetName - Name of the sheet tab (default: 'Leads')
 * @param apiKey - Optional API key (falls back to env variable)
 */
export const addRowToSheet = async (
  spreadsheetUrl: string,
  rowData: Record<string, string>,
  sheetName: string = 'Leads',
  apiKey?: string
): Promise<boolean> => {
  const service = new GoogleSheetsService(apiKey);
  const spreadsheetId = GoogleSheetsService.extractSpreadsheetId(spreadsheetUrl);
  
  if (!spreadsheetId) {
    throw new Error('Invalid spreadsheet URL');
  }

  console.log(`🔄 Adding new row to Google Sheets (${sheetName})`);
  console.log(`📊 Row data:`, rowData);

  try {
    // 1. Read headers from first row
    const headerRange = `${sheetName}!A1:ZZ1`;
    const headerData = await service.readSheet(spreadsheetId, headerRange);
    
    if (headerData.length === 0 || headerData[0].length === 0) {
      throw new Error('Could not read spreadsheet headers');
    }

    const headers = headerData[0];
    console.log(`📋 Found ${headers.length} columns:`, headers);

    // 2. Read all current data to find next available row
    const dataRange = `${sheetName}!A:A`;
    const currentData = await service.readSheet(spreadsheetId, dataRange);
    const nextRowIndex = currentData.length + 1;

    console.log(`➕ Next available row: ${nextRowIndex}`);

    // 3. Build row array in correct column order
    const rowArray: string[] = [];
    
    for (let i = 0; i < headers.length; i++) {
      const columnName = headers[i];
      const value = rowData[columnName];
      
      // Use provided value or empty string
      rowArray.push(value !== undefined ? value : '');
    }

    console.log(`✏️ Writing ${rowArray.length} values to row ${nextRowIndex}`);

    // 4. Write row to sheet
    const writeRange = `${sheetName}!A${nextRowIndex}`;
    await service.updateSheet(spreadsheetId, writeRange, [rowArray]);
    
    console.log(`✅ Successfully added row ${nextRowIndex} to ${sheetName}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to add row to Google Sheets:`, error);
    throw error;
  }
};

// GoogleSheetsService is already exported above

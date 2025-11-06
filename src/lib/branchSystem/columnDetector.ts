/**
 * Column Detector
 * Intelligently detects spreadsheet column types and suggests mappings
 * IMPROVED: Better pattern matching to avoid false positives (e.g., "Datum interesse klant" should map to datumInteresse, not customerName)
 */

import { type FieldType, type DetectedMapping } from './types';

export class ColumnDetector {
  // Known patterns for common fields
  // IMPORTANT: More specific patterns MUST come first to avoid false matches
  // Example: "datum interesse klant" should match datumInteresse, NOT customerName
  private knownPatterns: Record<string, string[]> = {
    // Date fields - MUST come before customerName to avoid false matches
    datumInteresse: ['datum interesse klant', 'datum interesse', 'interesse datum', 'datum van interesse'],
    date: ['datum', 'date', 'created', 'aangemaakt', 'aangemeld'],
    
    // Name fields - specific patterns first
    customerName: ['naam klant', 'naam', 'name', 'klant', 'customer', 'contact', 'persoon'],
    
    // Phone fields - specific patterns first
    phone: ['telefoonnummer', 'telefoon', 'phone', 'tel', 'mobiel', 'gsm', 'nummer'],
    
    // Location fields
    postalCode: ['postcode', 'postal', 'zip', 'zipcode'],
    houseNumber: ['huisnummer', 'house', 'nummer', 'huis'],
    city: ['plaatsnaam', 'plaats', 'stad', 'city', 'woonplaats', 'gemeente'],
    address: ['adres', 'address', 'straat', 'street'],
    
    // Contact fields
    email: ['e-mail', 'email', 'mail', 'emailadres'],
    
    // Business fields
    company: ['bedrijf', 'company', 'organisatie', 'firma'],
    budget: ['budget', 'prijs', 'investering', 'kosten'],
    dealValue: ['dealvalue', 'deal', 'omzet', 'waarde', 'value'],
    profit: ['profit', 'winst', 'marge', 'verdienste'],
    
    // Status and notes
    status: ['status', 'staat', 'fase', 'state'],
    notes: ['opmerkingenveld', 'opmerkingen', 'notities', 'notes', 'resultaat', 'gesprek'],
  };

  // Type detection patterns
  private typePatterns: Record<string, RegExp[]> = {
    email: [/@/, /email/i, /mail/i],
    phone: [/\d{10}/, /telefoon/i, /phone/i, /mobiel/i],
    date: [/datum/i, /date/i, /\d{2}-\d{2}-\d{4}/, /\d{4}-\d{2}-\d{2}/],
    currency: [/€/, /\d+[.,]\d{2}/, /budget/i, /prijs/i, /bedrag/i, /waarde/i, /profit/i],
    boolean: [/ja\/nee/i, /yes\/no/i, /true\/false/i, /waar\/onwaar/i],
    url: [/https?:\/\//, /www\./, /\.com/, /\.nl/],
  };

  /**
   * Detect column mappings from spreadsheet headers
   * IMPROVED: Uses best-match algorithm to find the most specific pattern first
   */
  async detectColumnMappings(headers: string[]): Promise<DetectedMapping[]> {
    const mappings: DetectedMapping[] = [];

    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().trim();
      
      // Find the BEST matching field (most specific first)
      let bestMatch: { fieldKey: string; confidence: number } | null = null;
      
      for (const [fieldKey, patterns] of Object.entries(this.knownPatterns)) {
        for (const pattern of patterns) {
          const patternLower = pattern.toLowerCase();
          
          // Exact match gets highest priority (100%)
          if (normalized === patternLower) {
            bestMatch = { fieldKey, confidence: 100 };
            break; // Stop searching, we found perfect match
          }
          
          // Starts with gets high priority (80%)
          if (normalized.startsWith(patternLower)) {
            const currentConfidence = bestMatch ? bestMatch.confidence : 0;
            if (80 > currentConfidence) {
              bestMatch = { fieldKey, confidence: 80 };
            }
          }
          
          // Contains gets lower priority (60%) - only if no better match found
          if (normalized.includes(patternLower)) {
            const currentConfidence = bestMatch ? bestMatch.confidence : 0;
            if (60 > currentConfidence) {
              bestMatch = { fieldKey, confidence: 60 };
            }
          }
        }
        
        // If we found an exact match, stop searching other fields
        if (bestMatch && bestMatch.confidence === 100) {
          break;
        }
      }

      const detectedField = bestMatch ? bestMatch.fieldKey : null;
      const confidence = bestMatch ? bestMatch.confidence : 0;

      // Detect field type
      const detectedType = this.detectFieldType(header, normalized);

      // Generate mapping - use sanitized header as fieldKey if no match found
      const fieldKey = detectedField || this.sanitizeKey(header);
      
      mappings.push({
        columnIndex: index,
        columnLetter: this.indexToLetter(index),
        headerName: header,
        detectedFieldKey: fieldKey,
        detectedFieldLabel: header,
        detectedFieldType: detectedType,
        confidence: confidence,
        suggestion: this.generateSuggestion(header, detectedField, detectedType, confidence)
      });
    });

    return mappings;
  }

  /**
   * Detect field type from header and sample data
   */
  private detectFieldType(header: string, normalized: string): FieldType {
    // Check type patterns
    for (const [type, patterns] of Object.entries(this.typePatterns)) {
      if (patterns.some(pattern => pattern.test(normalized) || pattern.test(header))) {
        return type as FieldType;
      }
    }

    // Default to text
    return 'text';
  }

  /**
   * Convert column index to letter (0 = A, 25 = Z, 26 = AA, etc.)
   */
  private indexToLetter(index: number): string {
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode(65 + (index % 26)) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  }

  /**
   * Sanitize header text to valid field key
   * Example: "Datum interesse klant" → "datum_interesse_klant"
   */
  private sanitizeKey(header: string): string {
    return header
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  /**
   * Generate human-readable suggestion
   */
  private generateSuggestion(
    header: string,
    detectedField: string | null,
    detectedType: FieldType,
    confidence: number
  ): string {
    if (!detectedField) {
      return `Nieuw custom veld (${detectedType})`;
    }

    if (confidence === 100) {
      return `✓ Perfect match: ${detectedField}`;
    } else if (confidence >= 80) {
      return `~ Waarschijnlijk: ${detectedField}`;
    } else {
      return `? Mogelijk: ${detectedField}`;
    }
  }

  /**
   * Get email priority for field
   */
  getEmailPriority(fieldKey: string): number {
    const priorities: Record<string, number> = {
      customerName: 10,
      datumInteresse: 9,
      date: 9,
      phone: 8,
      email: 7,
      status: 1,
    };

    return priorities[fieldKey] || 0;
  }

  /**
   * Check if field should be required
   */
  isFieldRequired(fieldKey: string): boolean {
    return ['customerName', 'email', 'phone'].includes(fieldKey);
  }

  /**
   * Check if field should be unique
   */
  isFieldUnique(fieldKey: string): boolean {
    return ['email'].includes(fieldKey);
  }

  /**
   * Check if field should be shown in list view
   */
  shouldShowInList(fieldKey: string, index: number): boolean {
    // First 7 columns or important fields
    return index < 7 || ['customerName', 'email', 'phone', 'status', 'datumInteresse', 'date'].includes(fieldKey);
  }

  /**
   * Check if field should be included in email
   */
  shouldIncludeInEmail(fieldKey: string): boolean {
    const emailFields = [
      'customerName', 'email', 'phone', 'date', 'datumInteresse',
      'city', 'status', 'budget', 'postalCode', 'houseNumber'
    ];
    return emailFields.includes(fieldKey);
  }
}

// Singleton instance
export const columnDetector = new ColumnDetector();


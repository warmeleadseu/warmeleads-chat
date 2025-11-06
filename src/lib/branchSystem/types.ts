/**
 * Branch Configuration System Types
 * Enterprise-grade multi-branch lead management
 */

export type FieldType = 
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'email'
  | 'phone'
  | 'currency'
  | 'url'
  | 'custom';

export type EmailTemplateType = 
  | 'new_lead'
  | 'status_change'
  | 'weekly_summary'
  | 'lead_reminder';

export interface BranchDefinition {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  icon: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FieldMapping {
  id: string;
  branchId: string;
  
  // Spreadsheet mapping
  columnLetter: string;
  columnIndex: number;
  headerName: string;
  
  // System field mapping
  fieldKey: string;
  fieldLabel: string;
  fieldType: FieldType;
  
  // Validation
  isRequired: boolean;
  isUnique: boolean;
  validationRegex?: string;
  
  // Display settings
  showInList: boolean;
  showInDetail: boolean;
  includeInEmail: boolean;
  emailPriority: number;
  
  // Metadata
  helpText?: string;
  placeholder?: string;
  sortOrder: number;
  
  createdAt: Date;
}

export interface EmailTemplate {
  id: string;
  branchId: string;
  templateType: EmailTemplateType;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BranchWithMappings extends BranchDefinition {
  fieldMappings: FieldMapping[];
  emailTemplates: EmailTemplate[];
}

// Auto-detection result
export interface DetectedMapping {
  columnIndex: number;
  columnLetter: string;
  headerName: string;
  detectedFieldKey: string;
  detectedFieldLabel: string;
  detectedFieldType: FieldType;
  confidence: number; // 0-100
  suggestion: string;
}

// Spreadsheet data for upload
export interface SpreadsheetData {
  headers: string[];
  rows: any[][];
  totalRows: number;
  totalColumns: number;
}

// Email rendering context
export interface EmailContext {
  customerName: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  notificationFields: Array<{
    label: string;
    value: string;
  }>;
  portalLink: string;
  totalLeads: number;
}



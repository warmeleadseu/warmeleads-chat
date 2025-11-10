/**
 * Branch Configuration Detail Page
 * Multi-step wizard for configuring branch spreadsheet mappings and email templates
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  DocumentArrowUpIcon,
  TableCellsIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { DEFAULT_EMAIL_TEMPLATE } from '@/lib/branchSystem/defaultEmailTemplate';

interface Branch {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  is_active: boolean;
  created_at: string;
  fieldMappings: FieldMapping[];
  emailTemplates: EmailTemplate[];
}

interface FieldMapping {
  id?: string;
  columnIndex: number;
  columnLetter: string;
  headerName: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  isRequired: boolean;
  isUnique: boolean;
  showInList: boolean;
  showInDetail: boolean;
  includeInEmail: boolean;
  emailPriority: number;
  confidence?: number;
  suggestion?: string;
}

interface EmailTemplate {
  id?: string;
  template_type: string;
  subject_template: string;
  body_template: string;
  is_active: boolean;
}

interface SpreadsheetData {
  headers: string[];
  totalRows: number;
  totalColumns: number;
  sampleRows: any[][];
}

type Step = 'info' | 'upload' | 'mapping' | 'email' | 'complete';

export default function BranchConfigPage({ params }: { params: { branchId: string } }) {
  const router = useRouter();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [isLoadingBranch, setIsLoadingBranch] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('info');
  
  // Spreadsheet load state
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null);
  const [detectedMappings, setDetectedMappings] = useState<FieldMapping[]>([]);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  
  // Mapping state
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [isSavingMappings, setIsSavingMappings] = useState(false);
  
  // Email template state
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>({
    template_type: 'new_lead',
    subject_template: '🎉 Nieuwe lead: {{leadName}}',
    body_template: DEFAULT_EMAIL_TEMPLATE,
    is_active: true
  });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Load branch data
  useEffect(() => {
    loadBranch();
  }, [params.branchId]);

  const loadBranch = async () => {
    try {
      setIsLoadingBranch(true);
      const response = await fetch(`/api/admin/branches/${params.branchId}`, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load branch');
      }

      const data = await response.json();
      setBranch(data.branch);
      
      // Set initial mappings if they exist
      if (data.branch.fieldMappings && data.branch.fieldMappings.length > 0) {
        setMappings(data.branch.fieldMappings);
        setCurrentStep('mapping');
      }
      
      // Set initial email template if it exists
      if (data.branch.emailTemplates && data.branch.emailTemplates.length > 0) {
        setEmailTemplate(data.branch.emailTemplates[0]);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading branch:', err);
    } finally {
      setIsLoadingBranch(false);
    }
  };

  const handleLoadSpreadsheet = async (url: string) => {
    try {
      setIsLoadingSheet(true);
      setError(null);

      const response = await fetch('/api/admin/branches/detect-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetUrl: url })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load spreadsheet');
      }

      const data = await response.json();
      setSpreadsheetUrl(url);
      setSpreadsheetData(data.spreadsheetData);
      setDetectedMappings(data.detectedMappings);
      setMappings(data.detectedMappings);
      setCurrentStep('mapping');
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading spreadsheet:', err);
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const handleSaveMappings = async () => {
    try {
      setIsSavingMappings(true);
      setError(null);

      const response = await fetch(`/api/admin/branches/${params.branchId}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save mappings');
      }

      setCurrentStep('email');
    } catch (err: any) {
      setError(err.message);
      console.error('Error saving mappings:', err);
    } finally {
      setIsSavingMappings(false);
    }
  };

  const handleSaveEmailTemplate = async () => {
    try {
      setIsSavingTemplate(true);
      setError(null);

      const requestBody = {
        templateType: emailTemplate.template_type,
        subjectTemplate: emailTemplate.subject_template,
        bodyTemplate: emailTemplate.body_template,
        isActive: emailTemplate.is_active
      };

      const response = await fetch(`/api/admin/branches/${params.branchId}/email-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save email template');
      }

      setCurrentStep('complete');
    } catch (err: any) {
      setError(err.message);
      console.error('Error saving email template:', err);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    setMappings(newMappings);
  };

  if (isLoadingBranch) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Branch niet gevonden</h1>
          <button
            onClick={() => router.push('/admin/branches')}
            className="px-6 py-3 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors"
          >
            Terug naar overzicht
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/admin/branches')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Terug naar branches
        </button>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-r from-brand-purple to-brand-pink rounded-xl flex items-center justify-center text-3xl">
            {branch.icon}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {branch.display_name}
            </h1>
            <p className="text-gray-600">
              {branch.description || 'Configureer spreadsheet mapping en email templates'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {[
            { key: 'info', label: 'Info', icon: CheckCircleIcon },
            { key: 'upload', label: 'Upload', icon: DocumentArrowUpIcon },
            { key: 'mapping', label: 'Mapping', icon: TableCellsIcon },
            { key: 'email', label: 'Email', icon: EnvelopeIcon },
            { key: 'complete', label: 'Klaar', icon: SparklesIcon }
          ].map((step, index) => {
            const stepKeys: Step[] = ['info', 'upload', 'mapping', 'email', 'complete'];
            const currentIndex = stepKeys.indexOf(currentStep);
            const stepIndex = stepKeys.indexOf(step.key as Step);
            const isCompleted = stepIndex < currentIndex;
            const isCurrent = step.key === currentStep;
            const Icon = step.icon;

            return (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                        ? 'bg-brand-purple text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className={`text-xs sm:text-sm mt-2 ${isCurrent ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                </div>
                {index < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all ${
                      stepIndex < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <ExclamationCircleIcon className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Er is een fout opgetreden:</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {currentStep === 'info' && (
          <StepInfo branch={branch} onNext={() => setCurrentStep('upload')} />
        )}
        
        {currentStep === 'upload' && (
          <StepUpload
            onLoadSpreadsheet={handleLoadSpreadsheet}
            isLoading={isLoadingSheet}
            spreadsheetData={spreadsheetData}
            spreadsheetUrl={spreadsheetUrl}
          />
        )}
        
        {currentStep === 'mapping' && (
          <StepMapping
            spreadsheetData={spreadsheetData}
            mappings={mappings}
            onUpdateMapping={updateMapping}
            onSave={handleSaveMappings}
            isSaving={isSavingMappings}
          />
        )}
        
        {currentStep === 'email' && (
          <StepEmail
            template={emailTemplate}
            onUpdate={setEmailTemplate}
            onSave={handleSaveEmailTemplate}
            isSaving={isSavingTemplate}
            mappings={mappings}
          />
        )}
        
        {currentStep === 'complete' && (
          <StepComplete branch={branch} onFinish={() => router.push('/admin/branches')} />
        )}
      </AnimatePresence>
    </div>
  );
}

// Step Components

function StepInfo({ branch, onNext }: { branch: Branch; onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-lg shadow p-6 sm:p-8"
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Branch informatie</h2>
      
      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Interne naam</label>
          <p className="text-gray-900 text-lg">{branch.name}</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Weergave naam</label>
          <p className="text-gray-900 text-lg">{branch.display_name}</p>
        </div>
        
        {branch.description && (
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Omschrijving</label>
            <p className="text-gray-900">{branch.description}</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <h3 className="font-medium text-blue-900 mb-2">📋 Wat gaat er gebeuren?</h3>
        <ol className="text-blue-800 text-sm space-y-2 ml-4 list-decimal">
          <li>Plak de Google Spreadsheet URL van een voorbeeld spreadsheet</li>
          <li>Het systeem leest de spreadsheet en detecteert automatisch de kolommen</li>
          <li>Je configureert welke kolommen welke velden zijn</li>
          <li>Je stelt een email template in voor notificaties</li>
          <li>Klaar! De branch is geconfigureerd</li>
        </ol>
      </div>

      <button
        onClick={onNext}
        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
      >
        Start configuratie
      </button>
    </motion.div>
  );
}

function StepUpload({
  onLoadSpreadsheet,
  isLoading,
  spreadsheetData,
  spreadsheetUrl
}: {
  onLoadSpreadsheet: (url: string) => void;
  isLoading: boolean;
  spreadsheetData: SpreadsheetData | null;
  spreadsheetUrl: string;
}) {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  const validateAndLoad = () => {
    setUrlError('');
    
    if (!url.trim()) {
      setUrlError('Vul een Google Spreadsheet URL in');
      return;
    }

    if (!url.includes('docs.google.com/spreadsheets')) {
      setUrlError('Dit lijkt geen geldige Google Spreadsheet URL te zijn');
      return;
    }

    onLoadSpreadsheet(url.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-lg shadow p-6 sm:p-8"
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Google Spreadsheet inladen</h2>

      {!spreadsheetData ? (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">📊 Hoe werkt het?</h3>
            <ol className="text-blue-800 text-sm space-y-1 ml-4 list-decimal">
              <li>Open de Google Spreadsheet met voorbeeld lead data</li>
              <li>Zorg dat de spreadsheet "Iedereen met de link kan bekijken" heeft</li>
              <li>Kopieer de volledige URL uit de adresbalk</li>
              <li>Plak de URL hieronder</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Spreadsheet URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setUrlError('');
              }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
              disabled={isLoading}
            />
            {urlError && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-2">
                <ExclamationCircleIcon className="w-4 h-4" />
                {urlError}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Voorbeeld: https://docs.google.com/spreadsheets/d/1ABC.../edit#gid=0
            </p>
          </div>

          <button
            onClick={validateAndLoad}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Spreadsheet inladen...
              </span>
            ) : (
              'Spreadsheet inladen'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-green-900 mb-1">Spreadsheet succesvol ingelezen!</h3>
                <p className="text-sm text-green-800 mb-2">
                  {spreadsheetData.totalRows} rijen × {spreadsheetData.totalColumns} kolommen
                </p>
                <p className="text-xs text-green-700 break-all">
                  📄 {spreadsheetUrl}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Gedetecteerde kolommen:</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto">
              {spreadsheetData.headers.map((header, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 text-gray-700"
                >
                  <span className="w-8 h-8 rounded bg-brand-purple text-white flex items-center justify-center text-sm font-medium">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{header || '(Lege kop)'}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-gray-600 text-sm">
            ✅ De kolommen zijn automatisch gedetecteerd en de spreadsheet is gekoppeld. Klik op "Volgende" om de mapping te configureren.
          </p>
        </div>
      )}
    </motion.div>
  );
}

function StepMapping({
  spreadsheetData,
  mappings,
  onUpdateMapping,
  onSave,
  isSaving
}: {
  spreadsheetData: SpreadsheetData | null;
  mappings: FieldMapping[];
  onUpdateMapping: (index: number, updates: Partial<FieldMapping>) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  if (!spreadsheetData) return null;

  const fieldTypes = ['text', 'email', 'phone', 'number', 'date', 'url', 'boolean'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-lg shadow p-6 sm:p-8"
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Configureer veld mapping</h2>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-900 text-sm flex items-center gap-2">
          <SparklesIcon className="w-5 h-5" />
          Kolommen zijn automatisch gedetecteerd. Pas de mapping aan indien nodig.
        </p>
      </div>

      <div className="space-y-4 mb-8 max-h-[600px] overflow-y-auto">
        {mappings.map((mapping, index) => (
          <div
            key={index}
            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Column Info */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Kolom
                </label>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded bg-brand-purple text-white flex items-center justify-center text-sm font-medium">
                    {mapping.columnLetter}
                  </span>
                  <span className="text-gray-700 text-sm">{mapping.headerName}</span>
                </div>
                {mapping.confidence && mapping.confidence > 0.7 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                    <CheckCircleIcon className="w-4 h-4" />
                    {Math.round(mapping.confidence * 100)}% zekerheid
                  </div>
                )}
              </div>

              {/* Field Label */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Veld label
                </label>
                <input
                  type="text"
                  value={mapping.fieldLabel}
                  onChange={(e) => onUpdateMapping(index, { fieldLabel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                  placeholder="bijv. Naam"
                />
              </div>

              {/* Field Type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Type
                </label>
                <select
                  value={mapping.fieldType}
                  onChange={(e) => onUpdateMapping(index, { fieldType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                >
                  {fieldTypes.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Checkboxes */}
              <div className="md:col-span-2 lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mapping.isRequired}
                    onChange={(e) => onUpdateMapping(index, { isRequired: e.target.checked })}
                    className="rounded text-brand-purple focus:ring-brand-purple"
                  />
                  Verplicht
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mapping.showInList}
                    onChange={(e) => onUpdateMapping(index, { showInList: e.target.checked })}
                    className="rounded text-brand-purple focus:ring-brand-purple"
                  />
                  In lijst
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mapping.showInDetail}
                    onChange={(e) => onUpdateMapping(index, { showInDetail: e.target.checked })}
                    className="rounded text-brand-purple focus:ring-brand-purple"
                  />
                  In detail
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mapping.includeInEmail}
                    onChange={(e) => onUpdateMapping(index, { includeInEmail: e.target.checked })}
                    className="rounded text-brand-purple focus:ring-brand-purple"
                  />
                  In email
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onSave}
        disabled={isSaving}
        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? 'Opslaan...' : 'Mapping opslaan & volgende'}
      </button>
    </motion.div>
  );
}

function StepEmail({
  template,
  onUpdate,
  onSave,
  isSaving,
  mappings
}: {
  template: EmailTemplate;
  onUpdate: (template: EmailTemplate) => void;
  onSave: () => void;
  isSaving: boolean;
  mappings: FieldMapping[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-lg shadow p-6 sm:p-8"
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Email template configureren</h2>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-900 text-sm mb-2 flex items-center gap-2">
          <EnvelopeIcon className="w-5 h-5" />
          Configureer de email die verzonden wordt bij een nieuwe lead. <strong>Alle lead data wordt automatisch getoond</strong> via <code className="bg-blue-100 px-1 rounded">{'{{#each notificationFields}}'}</code>.
        </p>
        <div className="mt-3 text-blue-800 text-xs">
          <p className="font-medium mb-1">Beschikbare variabelen:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><code className="bg-blue-100 px-1 rounded">{'{{customerName}}'}</code> - Naam van de klant</li>
            <li><code className="bg-blue-100 px-1 rounded">{'{{leadName}}'}</code> - Naam van de lead</li>
            <li><code className="bg-blue-100 px-1 rounded">{'{{portalLink}}'}</code> - Link naar portal</li>
            <li><code className="bg-blue-100 px-1 rounded">{'{{#each notificationFields}}'}</code> - Loop door alle lead velden</li>
          </ul>
        </div>
      </div>

      <div className="space-y-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email onderwerp
          </label>
          <input
            type="text"
            value={template.subject_template}
            onChange={(e) => onUpdate({ ...template, subject_template: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
            placeholder="bijv. Nieuwe lead: {{name}}"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email inhoud (HTML)
          </label>
          <textarea
            value={template.body_template}
            onChange={(e) => onUpdate({ ...template, body_template: e.target.value })}
            rows={25}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent font-mono text-xs"
            placeholder="Email HTML template..."
          />
        </div>

        <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={template.is_active}
            onChange={(e) => onUpdate({ ...template, is_active: e.target.checked })}
            className="rounded text-brand-purple focus:ring-brand-purple"
          />
          <span>Email notificaties actief</span>
        </label>
      </div>

      <button
        onClick={onSave}
        disabled={isSaving}
        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? 'Opslaan...' : 'Template opslaan & voltooien'}
      </button>
    </motion.div>
  );
}

function StepComplete({
  branch,
  onFinish
}: {
  branch: Branch;
  onFinish: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-lg shadow p-6 sm:p-8 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6">
        <CheckCircleIcon className="w-12 h-12 text-white" />
      </div>

      <h2 className="text-3xl font-bold text-gray-900 mb-4">
        Configuratie voltooid! 🎉
      </h2>

      <p className="text-gray-600 text-lg mb-8">
        Branch "{branch.display_name}" is succesvol geconfigureerd en klaar voor gebruik.
      </p>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
        <h3 className="font-semibold text-gray-900 mb-4">Wat er nu gebeurt:</h3>
        <ul className="space-y-3 text-gray-700">
          <li className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Lead data wordt automatisch geparsed volgens de geconfigureerde mapping</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Klanten in deze branch zien hun leads perfect in het portal</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Email notificaties worden verstuurd bij nieuwe leads</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Je kunt altijd terug om de configuratie aan te passen</span>
          </li>
        </ul>
      </div>

      <button
        onClick={onFinish}
        className="px-8 py-3 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-lg transition-colors font-medium"
      >
        Terug naar branch overzicht
      </button>
    </motion.div>
  );
}

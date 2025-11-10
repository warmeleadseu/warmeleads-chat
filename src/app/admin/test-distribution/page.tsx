'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BeakerIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  UserGroupIcon,
  CalculatorIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface TestLead {
  email: string;
  phone: string;
  name: string;
  branch: string;
  postcode: string;
  address: string;
}

interface Batch {
  id: string;
  customerEmail: string;
  customerName: string;
  branchId: string;
  totalBatchSize: number;
  currentBatchCount: number;
  territoryType: string;
  centerPostcode?: string;
  radiusKm?: number;
  isActive: boolean;
}

interface DistributionCandidate {
  customerEmail: string;
  customerName: string;
  batchId: string;
  territoryType: string;
  priorityScore: number;
  distance?: number;
  matchReason: string;
  eligible: boolean;
  rejectionReason?: string;
}

interface TestResult {
  success: boolean;
  leadId?: string;
  distributionsPlanned: number;
  distributionsExecuted: number;
  candidates: DistributionCandidate[];
  selectedCustomers: string[];
  logs: string[];
  error?: string;
  geographicData?: {
    leadCoordinates?: { lat: number; lng: number };
    postcode: string;
  };
}

const BRANCHES = [
  { id: 'thuisbatterijen', name: 'Thuisbatterijen' },
  { id: 'zonnepanelen', name: 'Zonnepanelen' },
  { id: 'kozijnen', name: 'Kozijnen' },
  { id: 'airco', name: 'Airco' },
  { id: 'warmtepompen', name: 'Warmtepompen' },
  { id: 'isolatie', name: 'Isolatie' },
];

export default function TestDistributionPage() {
  const [testLead, setTestLead] = useState<TestLead>({
    email: '',
    phone: '',
    name: '',
    branch: 'thuisbatterijen',
    postcode: '',
    address: '',
  });

  const [dryRun, setDryRun] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [activeBatches, setActiveBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  useEffect(() => {
    loadActiveBatches();
  }, []);

  const loadActiveBatches = async () => {
    try {
      setLoadingBatches(true);
      const response = await fetch('/api/admin/batches?active=true', {
        cache: 'no-store',
      });
      const data = await response.json();
      setActiveBatches(data.batches || []);
    } catch (error) {
      console.error('Error loading batches:', error);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleTestDistribution = async () => {
    if (!testLead.email || !testLead.branch) {
      alert('Email en branch zijn verplicht');
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/admin/test-distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: testLead,
          dryRun,
        }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        success: false,
        distributionsPlanned: 0,
        distributionsExecuted: 0,
        candidates: [],
        selectedCustomers: [],
        logs: [],
        error: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateFakeLead = () => {
    const fakeLeads = [
      {
        email: 'test.zwolle@example.com',
        phone: '06-12345678',
        name: 'Test Lead Zwolle',
        postcode: '8011AA',
        address: 'Teststraat 1, Zwolle',
      },
      {
        email: 'test.amsterdam@example.com',
        phone: '06-87654321',
        name: 'Test Lead Amsterdam',
        postcode: '1012AB',
        address: 'Testgracht 10, Amsterdam',
      },
      {
        email: 'test.rotterdam@example.com',
        phone: '06-11223344',
        name: 'Test Lead Rotterdam',
        postcode: '3011AA',
        address: 'Testlaan 5, Rotterdam',
      },
    ];

    const randomLead = fakeLeads[Math.floor(Math.random() * fakeLeads.length)];
    setTestLead({
      ...randomLead,
      branch: testLead.branch,
    });
  };

  const activeBatchesForBranch = activeBatches.filter((b) => b.branchId === testLead.branch);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <BeakerIcon className="w-8 h-8 text-purple-600" />
          Test Lead Distributie Systeem
        </h1>
        <p className="text-gray-600 mt-1">
          Test het volledige distributie systeem zonder impact op productie
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-1">Test Mode Actief</h3>
            <p className="text-sm text-blue-800">
              In DRY RUN mode wordt er niets naar Google Sheets geschreven. Je ziet alleen welke
              distributies er zouden plaatsvinden en waarom. Perfect voor validatie!
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Input Form */}
        <div className="space-y-6">
          {/* Test Lead Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Test Lead Gegevens</h2>
              <button
                onClick={handleGenerateFakeLead}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                🎲 Genereer fake lead
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch *
                </label>
                <select
                  value={testLead.branch}
                  onChange={(e) => setTestLead({ ...testLead, branch: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {BRANCHES.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={testLead.email}
                  onChange={(e) => setTestLead({ ...testLead, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="test@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Naam</label>
                <input
                  type="text"
                  value={testLead.name}
                  onChange={(e) => setTestLead({ ...testLead, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Test Lead"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telefoon</label>
                <input
                  type="tel"
                  value={testLead.phone}
                  onChange={(e) => setTestLead({ ...testLead, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="06-12345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Postcode (voor geographic matching)
                </label>
                <input
                  type="text"
                  value={testLead.postcode}
                  onChange={(e) => setTestLead({ ...testLead, postcode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="8011AA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adres</label>
                <input
                  type="text"
                  value={testLead.address}
                  onChange={(e) => setTestLead({ ...testLead, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Straat 1, Stad"
                />
              </div>

              {/* Dry Run Toggle */}
              <div className="pt-4 border-t border-gray-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={dryRun}
                      onChange={(e) => setDryRun(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-14 h-8 rounded-full transition-colors ${
                        dryRun ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                          dryRun ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {dryRun ? '🧪 DRY RUN Mode' : '⚠️ LIVE Mode'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {dryRun
                        ? 'Alleen simulatie, geen echte writes'
                        : 'ECHTE distributie naar Google Sheets!'}
                    </div>
                  </div>
                </label>
              </div>

              {/* Test Button */}
              <button
                onClick={handleTestDistribution}
                disabled={isLoading || !testLead.email || !testLead.branch}
                className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Testen...
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-5 h-5" />
                    Test Distributie
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active Batches */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5" />
              Actieve Batches voor {BRANCHES.find((b) => b.id === testLead.branch)?.name}
            </h3>

            {loadingBatches ? (
              <div className="text-center py-4 text-gray-500">Laden...</div>
            ) : activeBatchesForBranch.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                Geen actieve batches voor deze branch
              </div>
            ) : (
              <div className="space-y-3">
                {activeBatchesForBranch.map((batch) => (
                  <div
                    key={batch.id}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium text-gray-900">{batch.customerName}</div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        Actief
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>
                        Voortgang: {batch.currentBatchCount} / {batch.totalBatchSize} leads
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPinIcon className="w-4 h-4" />
                        {batch.territoryType === 'radius' && batch.centerPostcode
                          ? `${batch.radiusKm}km rondom ${batch.centerPostcode}`
                          : batch.territoryType === 'regions'
                          ? 'Specifieke regio\'s'
                          : 'Heel Nederland'}
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              (batch.currentBatchCount / batch.totalBatchSize) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="space-y-6">
          {testResult && (
            <>
              {/* Summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-lg shadow p-6 ${
                  testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {testResult.success ? (
                    <CheckCircleIcon className="w-8 h-8 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircleIcon className="w-8 h-8 text-red-600 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold mb-2 ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                      {testResult.success ? 'Test Succesvol!' : 'Test Mislukt'}
                    </h3>
                    {testResult.error && (
                      <p className="text-sm text-red-800 mb-4">{testResult.error}</p>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                          Kandidaten gevonden
                        </div>
                        <div className={`text-2xl font-bold ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                          {testResult.candidates.length}
                        </div>
                      </div>
                      <div>
                        <div className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                          {dryRun ? 'Zou distribueren naar' : 'Gedistribueerd naar'}
                        </div>
                        <div className={`text-2xl font-bold ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                          {testResult.distributionsPlanned} klanten
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Geographic Data */}
              {testResult.geographicData && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPinIcon className="w-5 h-5" />
                    Geografische Data
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Postcode:</span>
                      <span className="font-medium text-gray-900">
                        {testResult.geographicData.postcode}
                      </span>
                    </div>
                    {testResult.geographicData.leadCoordinates && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Latitude:</span>
                          <span className="font-mono text-gray-900">
                            {testResult.geographicData.leadCoordinates.lat.toFixed(6)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Longitude:</span>
                          <span className="font-mono text-gray-900">
                            {testResult.geographicData.leadCoordinates.lng.toFixed(6)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Candidates */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-lg shadow p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CalculatorIcon className="w-5 h-5" />
                  Distributie Kandidaten & Priority Scoring
                </h3>

                {testResult.candidates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Geen kandidaten gevonden voor deze lead
                  </div>
                ) : (
                  <div className="space-y-3">
                    {testResult.candidates.map((candidate, index) => (
                      <div
                        key={index}
                        className={`border rounded-lg p-4 ${
                          candidate.eligible
                            ? 'border-green-200 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-medium text-gray-900">
                              {candidate.customerName}
                            </div>
                            <div className="text-xs text-gray-500">{candidate.customerEmail}</div>
                          </div>
                          {candidate.eligible ? (
                            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              <CheckCircleIcon className="w-4 h-4" />
                              Geselecteerd
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                              <XCircleIcon className="w-4 h-4" />
                              Afgewezen
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm mb-2">
                          <div>
                            <span className="text-gray-600">Territorium:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {candidate.territoryType === 'radius'
                                ? 'Straal'
                                : candidate.territoryType === 'regions'
                                ? 'Regio\'s'
                                : 'Heel NL'}
                            </span>
                          </div>
                          {candidate.distance !== undefined && (
                            <div>
                              <span className="text-gray-600">Afstand:</span>
                              <span className="ml-2 font-medium text-gray-900">
                                {candidate.distance.toFixed(1)} km
                              </span>
                            </div>
                          )}
                          <div className="col-span-2">
                            <span className="text-gray-600">Priority Score:</span>
                            <span className="ml-2 font-bold text-purple-600">
                              {candidate.priorityScore}
                            </span>
                            <span className="ml-2 text-xs text-gray-500">
                              (lager = hogere prioriteit)
                            </span>
                          </div>
                        </div>

                        <div className="text-sm">
                          <div className="text-gray-600 mb-1">
                            {candidate.eligible ? 'Match reden:' : 'Afwijzing reden:'}
                          </div>
                          <div
                            className={`font-medium ${
                              candidate.eligible ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {candidate.eligible ? candidate.matchReason : candidate.rejectionReason}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Logs */}
              {testResult.logs.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ClockIcon className="w-5 h-5" />
                    Uitvoer Log
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400 max-h-96 overflow-y-auto">
                    {testResult.logs.map((log, index) => (
                      <div key={index} className="mb-1">
                        {log}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}

          {!testResult && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <BeakerIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Vul de test lead gegevens in en klik op "Test Distributie"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalculatorIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';

interface ROICalculatorProps {
  onComplete: (results: {
    investment: number;
    expectedLeads: number;
    expectedConversions: number;
    expectedRevenue: number;
    roi: number;
  }) => void;
  industry: string;
}

export function ROICalculator({ onComplete, industry }: ROICalculatorProps) {
  const [leadPrice, setLeadPrice] = useState(42.50);
  const [leadCount, setLeadCount] = useState(50);
  const [conversionRate, setConversionRate] = useState(15);
  const [avgOrderValue, setAvgOrderValue] = useState(8000);

  const [results, setResults] = useState({
    investment: 0,
    expectedLeads: 0,
    expectedConversions: 0,
    expectedRevenue: 0,
    roi: 0,
  });

  useEffect(() => {
    const investment = leadPrice * leadCount;
    const expectedLeads = leadCount;
    const expectedConversions = Math.round((leadCount * conversionRate) / 100);
    const expectedRevenue = expectedConversions * avgOrderValue;
    const roi = investment > 0 ? Math.round(((expectedRevenue - investment) / investment) * 100) : 0;

    const newResults = {
      investment,
      expectedLeads,
      expectedConversions,
      expectedRevenue,
      roi,
    };

    setResults(newResults);
  }, [leadPrice, leadCount, conversionRate, avgOrderValue]);

  return (
    <motion.div
      className="mt-4 p-6 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
    >
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-lisa-gradient rounded-xl flex items-center justify-center">
          <CalculatorIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-brand-navy">ROI Calculator</h3>
          <p className="text-gray-600 text-sm">Bereken je return on investment</p>
        </div>
      </div>

      {/* Input Controls */}
      <div className="space-y-4 mb-6">
        {/* Lead Price */}
        <div>
          <label className="block text-sm font-medium text-brand-navy mb-2">
            Prijs per lead: €{leadPrice.toFixed(2)}
          </label>
          <input
            type="range"
            min="12.50"
            max="55"
            step="2.50"
            value={leadPrice}
            onChange={(e) => setLeadPrice(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>€12,50 (gedeeld)</span>
            <span>€55,00 (exclusief premium)</span>
          </div>
        </div>

        {/* Lead Count */}
        <div>
          <label className="block text-sm font-medium text-brand-navy mb-2">
            Aantal leads: {leadCount}
          </label>
          <input
            type="range"
            min="30"
            max="500"
            step="10"
            value={leadCount}
            onChange={(e) => setLeadCount(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>30 leads</span>
            <span>500 leads</span>
          </div>
        </div>

        {/* Conversion Rate */}
        <div>
          <label className="block text-sm font-medium text-brand-navy mb-2">
            Verwachte conversie: {conversionRate}%
          </label>
          <input
            type="range"
            min="5"
            max="40"
            step="1"
            value={conversionRate}
            onChange={(e) => setConversionRate(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>5% (conservatief)</span>
            <span>40% (optimistisch)</span>
          </div>
        </div>

        {/* Average Order Value */}
        <div>
          <label className="block text-sm font-medium text-brand-navy mb-2">
            Gemiddelde orderwaarde: €{avgOrderValue.toLocaleString()}
          </label>
          <input
            type="range"
            min="2000"
            max="20000"
            step="500"
            value={avgOrderValue}
            onChange={(e) => setAvgOrderValue(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>€2.000</span>
            <span>€20.000</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-brand-navy">€{results.investment.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Investering</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">€{results.expectedRevenue.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Verwachte omzet</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">{results.expectedConversions}</div>
            <div className="text-sm text-gray-600">Nieuwe klanten</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${results.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {results.roi > 0 ? '+' : ''}{results.roi}%
            </div>
            <div className="text-sm text-gray-600">ROI</div>
          </div>
        </div>
        
        {results.roi > 0 && (
          <div className="mt-4 p-3 bg-green-100 rounded-lg text-center">
            <div className="flex items-center justify-center space-x-2 text-green-800">
              <ArrowTrendingUpIcon className="w-5 h-5" />
              <span className="font-semibold">
                Winst: €{(results.expectedRevenue - results.investment).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* CTA Button */}
      <motion.button
        onClick={() => onComplete(results)}
        className="w-full chat-button py-4 text-lg font-semibold"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        🚀 Bestel {leadCount} {leadPrice <= 18 ? 'gedeelde' : 'exclusieve'} leads voor €{results.investment.toLocaleString()}
      </motion.button>

      {/* Disclaimer */}
      <div className="text-center text-xs text-gray-500 mt-4">
        * Resultaten zijn indicatief en gebaseerd op je instellingen
      </div>
    </motion.div>
  );
}

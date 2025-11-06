'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon,
  LightBulbIcon,
  CurrencyEuroIcon,
  UserGroupIcon,
  ClockIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ComputerDesktopIcon,
  RocketLaunchIcon,
  SparklesIcon,
  BoltIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Logo } from './Logo';
import { type ChatContext } from '@/lib/chatContext';

interface InfoJourneyProps {
  onBackToHome: () => void;
  onStartChat: (context: ChatContext) => void;
  onDirectOrder?: () => void;
}

export function InfoJourney({ onBackToHome, onStartChat, onDirectOrder }: InfoJourneyProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleDirectOrder = () => {
    if (onDirectOrder) {
      onDirectOrder();
    } else {
      onBackToHome();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openOrderModal'));
      }, 100);
    }
  };

  const renderLeadTypesComparison = () => (
    <div className="space-y-4">
      {/* Header Text */}
      <p className="text-white/90 mb-6 leading-relaxed">
        Warme leads zijn potentiële klanten die al interesse hebben getoond in uw product of dienst. 
        Bij WarmeLeads kunt u kiezen uit 3 verschillende lead types:
      </p>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px] bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-4 bg-gradient-to-r from-orange-500/20 to-red-500/20 border-b border-white/20">
            <div className="p-4 font-bold text-white"></div>
            <div className="p-4 text-center border-l border-white/10">
              <div className="font-bold text-white mb-1">💎 EXCLUSIEF</div>
              <div className="text-xs text-white/70">Hoogste kwaliteit</div>
            </div>
            <div className="p-4 text-center border-l border-white/10">
              <div className="font-bold text-white mb-1">🤝 GEDEELD VERS</div>
              <div className="text-xs text-white/70">Vers & betaalbaar</div>
            </div>
            <div className="p-4 text-center border-l border-white/10">
              <div className="font-bold text-white mb-1">📦 BULK</div>
              <div className="text-xs text-white/70">Laagste prijs</div>
            </div>
          </div>

          {/* Price Row */}
          <div className="grid grid-cols-4 border-b border-white/10">
            <div className="p-4 font-medium text-white/80 bg-white/5">Prijs per lead</div>
            <div className="p-4 text-center text-white border-l border-white/10">€35 - €55</div>
            <div className="p-4 text-center text-white border-l border-white/10">€12 - €18</div>
            <div className="p-4 text-center text-white border-l border-white/10">€3,50 - €4,25</div>
          </div>

          {/* Minimum Row */}
          <div className="grid grid-cols-4 border-b border-white/10">
            <div className="p-4 font-medium text-white/80 bg-white/5">Minimum aantal</div>
            <div className="p-4 text-center text-white border-l border-white/10">30 leads</div>
            <div className="p-4 text-center text-white border-l border-white/10">250 leads</div>
            <div className="p-4 text-center text-white border-l border-white/10">100 leads</div>
          </div>

          {/* Freshness Row */}
          <div className="grid grid-cols-4 border-b border-white/10">
            <div className="p-4 font-medium text-white/80 bg-white/5">Versheid</div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <CheckCircleIcon className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <div className="text-xs">Real-time</div>
            </div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <CheckCircleIcon className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <div className="text-xs">0-48 uur</div>
            </div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <ClockIcon className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
              <div className="text-xs">Tot 6 mnd</div>
            </div>
          </div>

          {/* Exclusivity Row */}
          <div className="grid grid-cols-4 border-b border-white/10">
            <div className="p-4 font-medium text-white/80 bg-white/5">Exclusiviteit</div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <SparklesIcon className="w-5 h-5 text-orange-400 mx-auto mb-1" />
              <div className="text-xs">100% exclusief</div>
            </div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <UserGroupIcon className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <div className="text-xs">3 partijen totaal</div>
            </div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <UserGroupIcon className="w-5 h-5 text-purple-400 mx-auto mb-1" />
              <div className="text-xs">Meerdere partijen</div>
            </div>
          </div>

          {/* Delivery Row */}
          <div className="grid grid-cols-4 border-b border-white/10">
            <div className="p-4 font-medium text-white/80 bg-white/5">Levering</div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <ComputerDesktopIcon className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <div className="text-xs">Portal + Sheet</div>
            </div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <div className="text-2xl mb-1">📧</div>
              <div className="text-xs">Excel 24u</div>
            </div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <div className="text-2xl mb-1">📧</div>
              <div className="text-xs">Excel 24u</div>
            </div>
          </div>

          {/* Conversion Row */}
          <div className="grid grid-cols-4">
            <div className="p-4 font-medium text-white/80 bg-white/5">Gemiddelde conversie</div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <div className="font-bold text-green-400">25-40%</div>
            </div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <div className="font-bold text-blue-400">15-25%</div>
            </div>
            <div className="p-4 text-center text-white border-l border-white/10">
              <div className="font-bold text-purple-400">5-10%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="w-5 h-5 text-green-400" />
            <div className="font-semibold text-white">Voor alle leads geldt:</div>
          </div>
          <ul className="space-y-1 text-sm text-white/80">
            <li>✓ Nederlandse en Belgische prospects</li>
            <li>✓ Volledige contactgegevens</li>
            <li>✓ Kwaliteitscontrole</li>
            <li>✓ AVG-compliant</li>
          </ul>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <SparklesIcon className="w-5 h-5 text-orange-400" />
            <div className="font-semibold text-white">Onze aanbeveling:</div>
          </div>
          <p className="text-sm text-white/80">
            Start met bulk leads (€425) om te testen. Bij goede resultaten upgrade naar gedeeld vers of exclusief voor maximale conversie!
          </p>
        </div>
      </div>
    </div>
  );

  const renderSpecializations = () => (
    <div className="space-y-4">
      <p className="text-white/90 mb-4">
        Wij leveren hoogwaardige leads voor de volgende branches:
      </p>
      
      <div className="grid gap-3">
        {[
          { name: 'Zonnepanelen', desc: 'Huiseigenaren met interesse in solar', emoji: '☀️' },
          { name: 'Thuisbatterijen', desc: 'Energie-onafhankelijkheid zoekers', emoji: '🔋' },
          { name: 'Warmtepompen', desc: 'Verduurzaming en besparing', emoji: '🏠' },
          { name: 'Airco installatie', desc: 'Comfort en klimaatbeheersing', emoji: '❄️' },
          { name: 'Financial Lease', desc: 'Bedrijven zoekend naar financiering', emoji: '💼' }
        ].map((branch) => (
          <div key={branch.name} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{branch.emoji}</div>
              <div>
                <div className="font-semibold text-white">{branch.name}</div>
                <div className="text-sm text-white/70">{branch.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-white/20">
        <div className="flex items-center justify-center gap-3 text-white font-medium">
          <span>🇳🇱 Nederlandse markt</span>
          <span>+</span>
          <span>🇧🇪 Belgische markt</span>
        </div>
        <p className="text-center text-white/70 text-sm mt-2">
          Plus maatwerk voor andere branches op aanvraag!
        </p>
      </div>
    </div>
  );

  const renderPricing = () => (
    <div className="space-y-6">
      {/* Exclusive Leads */}
      <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-sm rounded-xl p-5 border-2 border-orange-500/30">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">💎</span>
          <h4 className="text-xl font-bold text-white">Verse Exclusieve Leads</h4>
        </div>
        <div className="space-y-2 text-white/90">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>• Thuisbatterijen: €37,50 - €32,50</div>
            <div>• Zonnepanelen: €37,50 - €32,50</div>
            <div>• Warmtepompen: €37,50 - €32,50</div>
            <div>• Airco: €37,50 - €32,50</div>
            <div className="col-span-2">• Financial Lease: €37,50 - €32,50</div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">📦 Min. 30 leads</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">⚡ Real-time portal</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">🎯 100% exclusief</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">🚀 Start binnen 24u</span>
          </div>
        </div>
      </div>

      {/* Shared Fresh Leads */}
      <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm rounded-xl p-5 border-2 border-blue-500/30">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🤝</span>
          <h4 className="text-xl font-bold text-white">Gedeelde Verse Leads</h4>
        </div>
        <div className="space-y-2 text-white/90">
          <div className="text-sm">
            <div>• €12,50 per lead (alle branches)</div>
            <div>• 1/3 van exclusieve prijs</div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">📦 Min. 250 leads</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">🌱 Verse campagnes</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">👥 3 partijen totaal</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">📧 Excel binnen 24u</span>
          </div>
        </div>
      </div>

      {/* Bulk Leads */}
      <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-xl p-5 border-2 border-purple-500/30">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">📦</span>
          <h4 className="text-xl font-bold text-white">Bulk Leads</h4>
        </div>
        <div className="space-y-2 text-white/90">
          <div className="text-sm">
            <div>• €3,50 - €4,25 per lead (alle branches)</div>
            <div>• Volumekorting: hoe meer, hoe voordeliger</div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">📦 Min. 100 leads</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">💰 Laagste prijs</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">📊 Database leads</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">📧 Excel binnen 24u</span>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-green-500/20 rounded-xl border border-green-500/30">
        <div className="text-center text-white">
          <CheckCircleIcon className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <div className="font-semibold">Geen setup kosten • Geen abonnementen!</div>
          <div className="text-sm text-white/70 mt-1">Alleen betalen voor de leads die u ontvangt</div>
        </div>
      </div>
    </div>
  );

  const renderHowItWorks = () => (
    <div className="space-y-6">
      {/* Exclusive Process */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">💎</span>
          <h4 className="text-lg font-bold text-white">Verse Exclusieve Leads</h4>
        </div>
        <div className="space-y-3">
          {[
            'U kiest uw pakket en betaalt',
            'Wij starten binnen 24u campagnes voor u',
            'Leads komen real-time binnen in uw portal',
            'U ontvangt automatisch notificaties',
            'Direct contact opnemen = maximale conversie!'
          ].map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {index + 1}
              </div>
              <div className="text-white/90 pt-0.5">{step}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Shared Fresh Process */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🤝</span>
          <h4 className="text-lg font-bold text-white">Gedeelde Verse Leads</h4>
        </div>
        <div className="space-y-3">
          {[
            'U bestelt min. 250 leads',
            'Wij starten binnen 24u campagnes',
            'Leads worden binnen 24u per email geleverd',
            'Gedeeld met 2 andere partijen (3 totaal)',
            'Excel bestand direct importeren en aan de slag!'
          ].map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {index + 1}
              </div>
              <div className="text-white/90 pt-0.5">{step}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Process */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📦</span>
          <h4 className="text-lg font-bold text-white">Bulk Leads</h4>
        </div>
        <div className="space-y-3">
          {[
            'U bestelt vanaf 100 leads',
            'Wij bereiden het Excel bestand voor',
            'Binnen 24u ontvangt u de leads per email',
            'Database leads (tot 6 mnd oud)',
            'Direct gebruiken voor cold outreach campaigns'
          ].map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {index + 1}
              </div>
              <div className="text-white/90 pt-0.5">{step}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-500/20 rounded-xl border border-blue-500/30">
        <div className="flex items-center gap-2 text-white">
          <LightBulbIcon className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold">Tip:</span>
          <span className="text-white/90">Start met bulk (€425) om te testen!</span>
        </div>
      </div>
    </div>
  );

  const renderPortalInfo = () => (
    <div className="space-y-4">
      <p className="text-white/90 mb-4">
        Bij exclusieve leads krijgt u toegang tot uw eigen dashboard:
      </p>

      <div className="grid gap-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
          <div className="flex items-center gap-3 mb-3">
            <ComputerDesktopIcon className="w-8 h-8 text-blue-400" />
            <h4 className="font-bold text-white text-lg">Real-time Lead Overview</h4>
          </div>
          <ul className="space-y-2 text-white/80">
            <li>• Alle leads op één plek</li>
            <li>• Status tracking per lead</li>
            <li>• Notificaties bij nieuwe leads</li>
          </ul>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
          <div className="flex items-center gap-3 mb-3">
            <ChartBarIcon className="w-8 h-8 text-green-400" />
            <h4 className="font-bold text-white text-lg">Analytics & Insights</h4>
          </div>
          <ul className="space-y-2 text-white/80">
            <li>• Conversie statistieken</li>
            <li>• ROI berekeningen</li>
            <li>• Performance tracking</li>
          </ul>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
          <div className="flex items-center gap-3 mb-3">
            <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h4 className="font-bold text-white text-lg">CRM Integratie</h4>
          </div>
          <ul className="space-y-2 text-white/80">
            <li>• Direct gekoppeld aan uw Google Sheet</li>
            <li>• Automatische synchronisatie</li>
            <li>• Bidirectionele updates</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-white/20">
        <div className="text-center text-white font-medium">
          ✅ Toegang op elk apparaat - mobiel, tablet, desktop
        </div>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-6">
      <p className="text-white/90 mb-4">
        Echte statistieken van onze klanten:
      </p>

      {/* Conversion Rates */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
        <div className="flex items-center gap-2 mb-4">
          <ChartBarIcon className="w-6 h-6 text-green-400" />
          <h4 className="font-bold text-white text-lg">Gemiddelde conversieratio</h4>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-white/80">Verse Exclusieve leads:</span>
            <span className="font-bold text-green-400 text-lg">25-40%</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-white/80">Gedeelde Verse leads:</span>
            <span className="font-bold text-blue-400 text-lg">15-25%</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-white/80">Bulk leads:</span>
            <span className="font-bold text-purple-400 text-lg">5-10%</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border-t border-white/10">
            <span className="text-white/80">Koude acquisitie:</span>
            <span className="font-bold text-red-400 text-lg">2-5%</span>
          </div>
        </div>
      </div>

      {/* ROI */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
        <div className="flex items-center gap-2 mb-4">
          <CurrencyEuroIcon className="w-6 h-6 text-yellow-400" />
          <h4 className="font-bold text-white text-lg">ROI binnen 3 maanden</h4>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-white/80">Exclusieve klanten:</span>
            <span className="font-bold text-green-400 text-lg">280-450% ROI</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-white/80">Gedeelde verse klanten:</span>
            <span className="font-bold text-blue-400 text-lg">180-280% ROI</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-white/80">Bulk klanten:</span>
            <span className="font-bold text-purple-400 text-lg">120-180% ROI</span>
          </div>
        </div>
      </div>

      {/* Speed Impact */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
        <div className="flex items-center gap-2 mb-4">
          <BoltIcon className="w-6 h-6 text-orange-400" />
          <h4 className="font-bold text-white text-lg">Snelheid maakt verschil</h4>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-white/80">Contact binnen 5 min:</span>
            <span className="font-bold text-green-400 text-lg">+80% conversie</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-white/80">Contact binnen 1 uur:</span>
            <span className="font-bold text-blue-400 text-lg">+40% conversie</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-white/80">Contact na 24 uur:</span>
            <span className="font-bold text-white/60 text-lg">Gemiddeld</span>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
        <div className="text-center text-white font-semibold">
          🎯 85% van onze klanten bestelt opnieuw binnen 3 maanden
        </div>
      </div>
    </div>
  );

  const sections = [
    {
      id: 'what-are-leads',
      icon: LightBulbIcon,
      title: 'Wat zijn warme leads?',
      renderContent: renderLeadTypesComparison,
      cta: 'Direct bestellen',
      context: 'direct' as ChatContext
    },
    {
      id: 'our-branches',
      icon: UserGroupIcon,
      title: 'Onze specialisaties',
      renderContent: renderSpecializations,
      cta: 'Direct bestellen',
      context: 'direct' as ChatContext
    },
    {
      id: 'pricing',
      icon: CurrencyEuroIcon,
      title: 'Transparante prijzen',
      renderContent: renderPricing,
      cta: 'Direct bestellen',
      context: 'direct' as ChatContext
    },
    {
      id: 'how-it-works',
      icon: ClockIcon,
      title: 'Zo werkt het',
      renderContent: renderHowItWorks,
      cta: 'Direct bestellen',
      context: 'direct' as ChatContext
    },
    {
      id: 'your-portal',
      icon: ComputerDesktopIcon,
      title: 'Uw persoonlijke portal',
      renderContent: renderPortalInfo,
      cta: 'Direct bestellen',
      context: 'direct' as ChatContext
    },
    {
      id: 'success-stories',
      icon: ChartBarIcon,
      title: 'Bewezen resultaten',
      renderContent: renderResults,
      cta: 'Bereken uw ROI',
      context: 'roi' as ChatContext
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex flex-col">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between p-3 md:p-4 glass-effect"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={onBackToHome}
          className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Terug</span>
        </button>
        
        <div className="text-center">
          <h1 className="text-white font-bold text-lg md:text-xl">Eerst meer leren</h1>
          <p className="text-white/60 text-xs md:text-sm">Alles over WarmeLeads</p>
        </div>
        
        <button
          onClick={onDirectOrder}
          className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold px-3 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all text-xs md:text-sm flex items-center space-x-1"
        >
          <span>🚀</span>
          <span className="hidden sm:inline">Bestellen</span>
        </button>
      </motion.div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 pb-24 overflow-y-auto">
        {sections.map((section, index) => (
          <motion.div
            key={section.id}
            className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <button
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              className="w-full p-4 text-left flex items-center justify-between text-white hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <section.icon className="w-6 h-6 text-orange-400" />
                <span className="font-semibold text-base md:text-lg">{section.title}</span>
              </div>
              <motion.div
                animate={{ rotate: expandedSection === section.id ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.div>
            </button>
            
            <AnimatePresence>
              {expandedSection === section.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-4 pt-0 border-t border-white/10">
                    <div className="mb-4">
                      {section.renderContent()}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <motion.button
                        onClick={() => section.context === 'roi' ? onStartChat(section.context) : (onDirectOrder ? onDirectOrder() : onBackToHome())}
                        className="flex-1 inline-flex items-center justify-center space-x-2 text-sm bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {section.context === 'roi' ? (
                          <ChatBubbleLeftRightIcon className="w-4 h-4" />
                        ) : (
                          <RocketLaunchIcon className="w-4 h-4" />
                        )}
                        <span>{section.cta}</span>
                      </motion.button>
                      
                      {section.context === 'roi' && (
                        <motion.button
                          onClick={() => onDirectOrder ? onDirectOrder() : onBackToHome()}
                          className="flex-1 inline-flex items-center justify-center space-x-2 text-sm bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <RocketLaunchIcon className="w-4 h-4" />
                          <span>Direct bestellen</span>
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {/* Final CTA */}
        <motion.div
          className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-sm rounded-xl p-6 border-2 border-orange-500/30 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-white font-bold mb-2 text-xl">Klaar om te beginnen?</h3>
          <p className="text-white/80 mb-4">
            Start vandaag nog met hoogwaardige leads en verhoog uw conversie!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.button
              onClick={() => onStartChat('info')}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all inline-flex items-center justify-center space-x-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
              <span>Chat met Lisa</span>
            </motion.button>
            <motion.button
              onClick={handleDirectOrder}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all inline-flex items-center justify-center space-x-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RocketLaunchIcon className="w-5 h-5" />
              <span>Direct bestellen</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import {
  SparklesIcon,
  UserGroupIcon,
  BoltIcon,
  GlobeEuropeAfricaIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
  LockClosedIcon,
  CurrencyEuroIcon,
  BookOpenIcon,
  DocumentTextIcon,
  NewspaperIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface BranchLeadsPageProps {
  metadata: {
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    heroDescription: string;
    exclusivePrice: string;
    sharedPrice: string;
  };
}

export function BranchLeadsPageContent({ metadata }: BranchLeadsPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* SEO Hidden Content */}
      <div className="sr-only">
        <h1>{metadata.title}</h1>
        <p>{metadata.heroDescription}</p>
      </div>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 text-center text-white">
          {/* Hero Content */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              {metadata.heroTitle}
            </h1>
            <p className="text-2xl md:text-3xl mb-8 text-white/90">
              {metadata.heroSubtitle}
            </p>
            <p className="text-lg text-white/80 max-w-3xl mx-auto">
              {metadata.heroDescription}
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Exclusieve Leads Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <SparklesIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Exclusieve leads</h3>
                <div className="text-4xl font-bold mb-2">{metadata.exclusivePrice}</div>
                <div className="text-white/70 mb-6">per lead</div>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                    <span>100% exclusief voor uw bedrijf</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                    <span>Geen concurrentie</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                    <span>Maximale conversiekans</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                    <span>Realtime uit campagnes</span>
                  </li>
                </ul>
                <a href="/" className="inline-block w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold py-4 rounded-xl hover:scale-105 transition-transform">
                  Start met exclusieve leads →
                </a>
              </div>
            </div>

            {/* Gedeelde Leads Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserGroupIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Gedeelde leads</h3>
                <div className="text-4xl font-bold mb-2">{metadata.sharedPrice}</div>
                <div className="text-white/70 mb-6">per lead (min. 100)</div>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                    <span>Gedeeld met max 2 anderen</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                    <span>Zeer kosteneffectief</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                    <span>Perfect om te starten</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                    <span>Hoge kwaliteit prospects</span>
                  </li>
                </ul>
                <a href="/" className="inline-block w-full bg-gradient-to-r from-blue-400 to-purple-500 text-white font-semibold py-4 rounded-xl hover:scale-105 transition-transform">
                  Start met gedeelde leads →
                </a>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <h2 className="text-3xl font-bold mb-8">Waarom WarmeLeads?</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <BoltIcon className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
                <h4 className="font-bold mb-2">Verse leads</h4>
                <p className="text-white/70 text-sm">Direct uit campagnes</p>
              </div>
              <div className="text-center">
                <GlobeEuropeAfricaIcon className="w-12 h-12 mx-auto mb-4 text-blue-400" />
                <h4 className="font-bold mb-2">Nederlandse markt</h4>
                <p className="text-white/70 text-sm">100% Nederlandse prospects</p>
              </div>
              <div className="text-center">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-4 text-green-400" />
                <h4 className="font-bold mb-2">Realtime dashboard</h4>
                <p className="text-white/70 text-sm">Live updates</p>
              </div>
              <div className="text-center">
                <ShieldCheckIcon className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                <h4 className="font-bold mb-2">Kwaliteitsgarantie</h4>
                <p className="text-white/70 text-sm">30 dagen geld terug</p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Klaar om te starten?</h2>
            <p className="text-xl text-white/80 mb-8">
              Ontvang vandaag nog uw eerste verse prospects
            </p>
            <a 
              href="/"
              className="inline-flex items-center gap-2 bg-white text-brand-purple px-12 py-6 rounded-2xl font-bold text-xl hover:scale-110 transition-all duration-300 shadow-2xl"
            >
              <RocketLaunchIcon className="w-6 h-6" />
              Start direct met leads
            </a>
          </div>

          {/* Footer Links */}
          <div className="mt-16 text-center border-t border-white/20 pt-8">
            <div className="flex items-center justify-center gap-4 text-white/60 text-sm mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <LockClosedIcon className="w-4 h-4" />
                <span>Uw gegevens zijn veilig</span>
              </div>
              <span className="hidden md:inline">•</span>
              <div className="flex items-center gap-2">
                <CurrencyEuroIcon className="w-4 h-4" />
                <span>Geen verborgen kosten</span>
              </div>
              <span className="hidden md:inline">•</span>
              <div className="flex items-center gap-2">
                <BoltIcon className="w-4 h-4" />
                <span>Direct resultaat</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <a 
                href="/leadgeneratie-gids" 
                className="flex items-center gap-1 text-white/50 hover:text-white/80 text-xs underline transition-colors"
              >
                <BookOpenIcon className="w-3 h-3" />
                Leadgeneratie gids
              </a>
              <span className="text-white/30">•</span>
              <a 
                href="/blog" 
                className="flex items-center gap-1 text-white/50 hover:text-white/80 text-xs underline transition-colors"
              >
                <NewspaperIcon className="w-3 h-3" />
                Blog & tips
              </a>
              <span className="text-white/30">•</span>
              <a 
                href="/algemene-voorwaarden" 
                className="flex items-center gap-1 text-white/50 hover:text-white/80 text-xs underline transition-colors"
              >
                <DocumentTextIcon className="w-3 h-3" />
                Algemene voorwaarden
              </a>
              <span className="text-white/30">•</span>
              <a 
                href="/privacyverklaring" 
                className="flex items-center gap-1 text-white/50 hover:text-white/80 text-xs underline transition-colors"
              >
                <LockClosedIcon className="w-3 h-3" />
                Privacyverklaring
              </a>
            </div>
            
            {/* Bedrijfsgegevens */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-white/50 text-xs">
                Warmeleads.eu • KvK: 88929280 • Stavangerweg 21-1, 9723 JC Groningen
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


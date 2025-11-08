'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckIcon,
  StarIcon,
  ArrowRightIcon,
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { Logo } from '../../components/Logo';

export default function Design2Page() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const testimonials = [
    {
      name: "Mark van der Berg",
      company: "Thuisbatterij Expert",
      text: "Sinds ik verse leads krijg binnen 15 minuten, is mijn conversie verdubbeld. Fantastisch systeem!",
      rating: 5,
      result: "+180% meer offertes",
      image: "/api/placeholder/64/64"
    },
    {
      name: "Lisa de Vries",
      company: "Zonnepaneel Specialist",
      text: "De kwaliteit van de leads is uitzonderlijk. Exclusieve leads die écht geïnteresseerd zijn.",
      rating: 5,
      result: "€45K extra omzet",
      image: "/api/placeholder/64/64"
    },
    {
      name: "Robert Jansen",
      company: "Warmtepomp Installateur",
      text: "Eindelijk een lead service die doet wat ze beloven. Betrouwbaar en professioneel.",
      rating: 5,
      result: "30 nieuwe klanten",
      image: "/api/placeholder/64/64"
    }
  ];

  const stats = [
    { number: "500+", label: "Installateurs" },
    { number: "15min", label: "Gemiddelde levertijd" },
    { number: "€2.5M", label: "Gegenereerde omzet" },
    { number: "4.9/5", label: "Klanttevredenheid" }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Logo />
              <span className="text-xl font-bold text-gray-900">WarmeLeads</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#results" className="text-gray-600 hover:text-gray-900 transition-colors">Resultaten</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">Hoe werkt het</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Prijzen</a>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                Start Nu
              </button>
            </div>
            <button className="md:hidden bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Start
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section with Social Proof */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : -30 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="flex items-center space-x-2 mb-6">
                <div className="flex -space-x-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-8 h-8 bg-white/20 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold">
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <span className="text-blue-100 font-medium">500+ installateurs gebruiken WarmeLeads</span>
              </div>

              <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
                Van koude leads naar{' '}
                <span className="text-yellow-300">hete prospects</span>
              </h1>

              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                Transformeer je bedrijf met verse, exclusieve leads die binnen 15 minuten in je inbox liggen. Geen koude acquisitie meer.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button className="bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  Start Gratis Trial
                  <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
                </button>
                <button className="border-2 border-white/30 text-white px-8 py-4 rounded-lg hover:bg-white/10 transition-colors font-semibold text-lg backdrop-blur-sm">
                  Bekijk Resultaten
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-blue-100">
                <div className="flex items-center">
                  <ShieldCheckIcon className="w-5 h-5 text-green-400 mr-2" />
                  30 dagen geld terug
                </div>
                <div className="flex items-center">
                  <CheckIcon className="w-5 h-5 text-green-400 mr-2" />
                  GDPR compliant
                </div>
                <div className="flex items-center">
                  <ClockIcon className="w-5 h-5 text-green-400 mr-2" />
                  24/7 support
                </div>
              </div>
            </motion.div>

            {/* Social Proof Cards */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative"
            >
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {stats.map((stat, index) => (
                  <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                    <div className="text-3xl font-bold text-white mb-1">{stat.number}</div>
                    <div className="text-sm text-blue-100">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Rotating Testimonials */}
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentTestimonial}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                  >
                    <div className="flex justify-center mb-4">
                      {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                        <StarIcon key={i} className="w-6 h-6 text-yellow-400 fill-current" />
                      ))}
                    </div>

                    <blockquote className="text-lg text-gray-700 mb-6 italic">
                      "{testimonials[currentTestimonial].text}"
                    </blockquote>

                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="font-semibold text-gray-900">{testimonials[currentTestimonial].name}</div>
                        <div className="text-sm text-gray-600">{testimonials[currentTestimonial].company}</div>
                      </div>
                      <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        {testimonials[currentTestimonial].result}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Testimonial Navigation */}
                <div className="flex justify-center mt-6 space-x-2">
                  {testimonials.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentTestimonial(index)}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        index === currentTestimonial ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section id="results" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Bewijzen resultaten
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Dit zijn de gemiddelde resultaten die onze klanten behalen binnen 30 dagen.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-xl shadow-lg text-center"
            >
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ArrowTrendingUpIcon className="w-8 h-8 text-blue-600" />
                  </div>
              <div className="text-4xl font-bold text-gray-900 mb-2">180%</div>
              <div className="text-lg font-semibold text-gray-700 mb-2">Meer offertes</div>
              <p className="text-gray-600">Gemiddelde stijging in offerte aanvragen</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-xl shadow-lg text-center"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ChartBarIcon className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-2">€8.500</div>
              <div className="text-lg font-semibold text-gray-700 mb-2">Extra omzet per maand</div>
              <p className="text-gray-600">Gemiddelde extra inkomsten per klant</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-xl shadow-lg text-center"
            >
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <UserGroupIcon className="w-8 h-8 text-purple-600" />
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-2">25</div>
              <div className="text-lg font-semibold text-gray-700 mb-2">Nieuwe klanten</div>
              <p className="text-gray-600">Gemiddeld aantal nieuwe klanten per maand</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Zo werkt het in 3 stappen
            </h2>
            <p className="text-xl text-gray-600">
              Van inschrijving tot eerste leads in minder dan 24 uur.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Registreer gratis</h3>
              <p className="text-gray-600">Maak je account aan en kies je branche. Geen creditcard nodig.</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Koppel je CRM</h3>
              <p className="text-gray-600">Verbind je Google Sheets of CRM systeem voor automatische synchronisatie.</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Ontvang leads</h3>
              <p className="text-gray-600">Verse leads stromen direct je systeem in. Start met converteren!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            Klaar voor meer klanten?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Sluit je aan bij meer dan 500 installateurs die hun bedrijf laten groeien met verse leads.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              Start Je Gratis Trial
              <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
            </button>
            <button className="border-2 border-white/30 text-white px-8 py-4 rounded-lg hover:bg-white/10 transition-colors font-semibold text-lg backdrop-blur-sm">
              Plan Demo Gesprek
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Logo />
              <span className="text-xl font-bold">WarmeLeads</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400 text-sm">© 2025 WarmeLeads. Alle rechten voorbehouden.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

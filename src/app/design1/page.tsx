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
  SparklesIcon
} from '@heroicons/react/24/outline';
import { Logo } from '../../components/Logo';

export default function Design1Page() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const testimonials = [
    {
      name: "Mark van der Berg",
      company: "Thuisbatterij Expert",
      text: "Sinds ik verse leads krijg binnen 15 minuten, is mijn conversie verdubbeld. Fantastisch systeem!",
      rating: 5
    },
    {
      name: "Lisa de Vries",
      company: "Zonnepaneel Specialist",
      text: "De kwaliteit van de leads is uitzonderlijk. Exclusieve leads die écht geïnteresseerd zijn.",
      rating: 5
    },
    {
      name: "Robert Jansen",
      company: "Warmtepomp Installateur",
      text: "Eindelijk een lead service die doet wat ze beloven. Betrouwbaar en professioneel.",
      rating: 5
    }
  ];

  const features = [
    {
      icon: ClockIcon,
      title: "15 Minuten Levering",
      description: "Verse leads direct in je portaal"
    },
    {
      icon: UserGroupIcon,
      title: "Exclusieve Leads",
      description: "Alleen jij hebt toegang tot deze prospects"
    },
    {
      icon: ChartBarIcon,
      title: "Hoog Converterend",
      description: "Tot 40% conversie naar offerte"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation */}
      <nav className="bg-white/90 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Logo />
              <span className="text-xl font-bold text-gray-900">WarmeLeads</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Functies</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Prijzen</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition-colors">Reviews</a>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                Start Gratis
              </button>
            </div>
            <button className="md:hidden bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Start
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-center lg:text-left"
            >
              <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <SparklesIcon className="w-4 h-4 mr-2" />
                #1 Lead Service voor Installateurs
              </div>

              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Verse leads binnen{' '}
                <span className="text-blue-600">15 minuten</span>
              </h1>

              <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-xl">
                Krijg dagelijks verse, exclusieve leads van mensen die écht geïnteresseerd zijn in jouw diensten. Geen koude leads meer.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <button className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  Start Gratis Trial
                  <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
                </button>
                <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg hover:border-gray-400 transition-colors font-semibold text-lg">
                  Bekijk Demo
                </button>
              </div>

              <div className="flex items-center justify-center lg:justify-start space-x-6 text-sm text-gray-500">
                <div className="flex items-center">
                  <CheckIcon className="w-5 h-5 text-green-500 mr-2" />
                  Gratis 14 dagen
                </div>
                <div className="flex items-center">
                  <CheckIcon className="w-5 h-5 text-green-500 mr-2" />
                  Geen setup kosten
                </div>
                <div className="flex items-center">
                  <CheckIcon className="w-5 h-5 text-green-500 mr-2" />
                  24/7 support
                </div>
              </div>
            </motion.div>

            {/* Visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.9 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                <div className="space-y-4">
                  {/* Mock Lead Cards */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">Nieuwe Lead</span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">2 min geleden</span>
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">Jan de Vries</p>
                      <p className="text-sm text-gray-600">Amsterdam • Interesse in thuisbatterij</p>
                      <p className="text-sm text-gray-600">Budget: €5.000-€8.000</p>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-900">Nieuwe Lead</span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">5 min geleden</span>
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">Maria Santos</p>
                      <p className="text-sm text-gray-600">Rotterdam • Zonnepanelen interesse</p>
                      <p className="text-sm text-gray-600">Budget: €3.000-€5.000</p>
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-purple-900">Nieuwe Lead</span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">8 min geleden</span>
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">Peter van Dam</p>
                      <p className="text-sm text-gray-600">Utrecht • Warmtepomp nodig</p>
                      <p className="text-sm text-gray-600">Budget: €8.000-€12.000</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <div className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    Live: 3 nieuwe leads vandaag
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Waarom kiezen voor WarmeLeads?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Meer dan 500 installateurs vertrouwen dagelijks op onze verse leads voor hun groei.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center p-8 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <feature.icon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Wat zeggen onze klanten?
            </h2>
            <p className="text-xl text-gray-600">
              Succesverhalen van installateurs die hun bedrijf hebben laten groeien.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-xl shadow-lg"
              >
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <StarIcon key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic">"{testimonial.text}"</p>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.company}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Klaar om meer leads te genereren?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Start vandaag nog met je gratis trial en zie het verschil binnen 24 uur.
          </p>
          <button className="bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
            Start Je Gratis Trial Nu
            <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
          </button>
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

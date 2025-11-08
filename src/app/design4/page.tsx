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
  HomeIcon,
  LightBulbIcon,
  CurrencyEuroIcon,
  PhoneIcon,
  HandThumbUpIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline';
import { Logo } from '../../components/Logo';

export default function Design4Page() {
  const [currentStory, setCurrentStory] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentStory((prev) => (prev + 1) % customerStories.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const customerStories = [
    {
      name: "Sarah & Mark",
      location: "Amsterdam",
      problem: "Hoge energiekosten door oude cv-ketel",
      journey: "Zoeken naar warmtepomp → Offerte aanvragen → Installatie boeken",
      result: "€800 besparing per jaar",
      timeline: "Van interesse tot installatie: 14 dagen",
      image: "/api/placeholder/80/80"
    },
    {
      name: "Tom",
      location: "Rotterdam",
      problem: "Geen groene energie, te dure energierekening",
      journey: "Zonnepanelen onderzoek → Vergelijken offertes → Installatie",
      result: "€1.200 besparing per jaar",
      timeline: "Van interesse tot installatie: 21 dagen",
      image: "/api/placeholder/80/80"
    },
    {
      name: "Familie Jansen",
      location: "Utrecht",
      problem: "Geen thuisbatterij, afhankelijk van energieleverancier",
      journey: "Thuisbatterij informatie → Offerte → Installatie + service",
      result: "Energiezelfvoorzienend + €600 besparing",
      timeline: "Van interesse tot installatie: 18 dagen",
      image: "/api/placeholder/80/80"
    }
  ];

  const journeySteps = [
    {
      step: "Ontdekking",
      icon: LightBulbIcon,
      title: "Het begint met een probleem",
      description: "Mensen ontdekken dat hun energiekosten te hoog zijn of willen verduurzamen",
      customer: "Sarah: 'Onze energierekening is €300 per maand!'",
      color: "from-blue-500 to-blue-600"
    },
    {
      step: "Onderzoek",
      icon: HomeIcon,
      title: "Ze gaan op zoek naar oplossingen",
      description: "Via Google, social media of bekenden horen ze over duurzame alternatieven",
      customer: "Sarah: 'Ik hoor veel over warmtepompen...'",
      color: "from-green-500 to-green-600"
    },
    {
      step: "Interesse",
      icon: SparklesIcon,
      title: "Ze tonen concrete interesse",
      description: "Ze vullen een formulier in, vragen offerte aan of nemen contact op",
      customer: "Sarah: 'Ik wil graag een offerte voor een warmtepomp'",
      color: "from-purple-500 to-purple-600"
    },
    {
      step: "Jouw Lead",
      icon: UserGroupIcon,
      title: "Jij krijgt de exclusieve lead",
      description: "Binnen 15 minuten staat de lead in je systeem met alle details",
      customer: "Jij: 'Nieuwe lead - Sarah uit Amsterdam!'",
      color: "from-orange-500 to-orange-600"
    },
    {
      step: "Contact",
      icon: PhoneIcon,
      title: "Direct contact opnemen",
      description: "Bel binnen 15 minuten voor de hoogste conversiekans",
      customer: "Jij belt Sarah en plant een afspraak",
      color: "from-red-500 to-red-600"
    },
    {
      step: "Succes",
      icon: HandThumbUpIcon,
      title: "Nieuwe klant voor jou",
      description: "Installatie, nazorg en mogelijk vervolgprojecten",
      customer: "Sarah: 'Bedankt voor de geweldige service!'",
      color: "from-emerald-500 to-emerald-600"
    }
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
              <a href="#story" className="text-gray-600 hover:text-gray-900 transition-colors">Het verhaal</a>
              <a href="#journey" className="text-gray-600 hover:text-gray-900 transition-colors">Jouw rol</a>
              <a href="#results" className="text-gray-600 hover:text-gray-900 transition-colors">Resultaten</a>
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

      {/* Hero Section - Story Based */}
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-green-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : -30 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <RocketLaunchIcon className="w-4 h-4 mr-2" />
                Van probleem naar oplossing
              </div>

              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Elk succesverhaal{' '}
                <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  begint met een lead
                </span>
              </h1>

              <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-xl">
                Zie hoe gewone mensen hun energievraagstukken oplossen - en hoe jij deel wordt van hun succesverhaal.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  Word deel van hun verhaal
                  <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
                </button>
                <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg hover:border-gray-400 transition-colors font-semibold text-lg">
                  Lees succesverhalen
                </button>
              </div>

              <div className="flex items-center space-x-8 text-sm text-gray-600">
                <div className="flex items-center">
                  <CheckIcon className="w-5 h-5 text-green-500 mr-2" />
                  500+ verhalen geschreven
                </div>
                <div className="flex items-center">
                  <CheckIcon className="w-5 h-5 text-green-500 mr-2" />
                  €2.5M aan installaties
                </div>
              </div>
            </motion.div>

            {/* Story Display */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Succesverhaal van vandaag</h3>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live updates</span>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStory}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                  >
                    {/* Customer Info */}
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center">
                        <span className="text-xl font-bold text-blue-600">
                          {customerStories[currentStory].name.split(' ')[0][0]}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{customerStories[currentStory].name}</h4>
                        <p className="text-sm text-gray-600">{customerStories[currentStory].location}</p>
                      </div>
                    </div>

                    {/* Problem */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="text-sm text-red-800 font-medium mb-1">Het probleem</div>
                      <p className="text-red-700">{customerStories[currentStory].problem}</p>
                    </div>

                    {/* Journey */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-sm text-blue-800 font-medium mb-1">De reis</div>
                      <p className="text-blue-700">{customerStories[currentStory].journey}</p>
                    </div>

                    {/* Result */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-sm text-green-800 font-medium mb-1">Het resultaat</div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-green-700 font-semibold">{customerStories[currentStory].result}</p>
                          <p className="text-sm text-green-600">{customerStories[currentStory].timeline}</p>
                        </div>
                        <div className="text-2xl">🎉</div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex justify-center mt-6 space-x-2">
                  {customerStories.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentStory(index)}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        index === currentStory ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Customer Journey Section */}
      <section id="journey" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Jouw rol in hun verhaal
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Zie hoe je precies op het juiste moment in hun customer journey komt.
            </p>
          </div>

          <div className="space-y-8">
            {journeySteps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`bg-white rounded-2xl shadow-lg border-l-4 border-blue-500 overflow-hidden ${
                  index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
                } lg:flex`}
              >
                <div className={`p-8 lg:w-1/2 ${index % 2 === 0 ? '' : 'lg:order-2'}`}>
                  <div className="flex items-center space-x-4 mb-4">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${step.color} flex items-center justify-center`}>
                      <step.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-blue-600 uppercase tracking-wide">{step.step}</div>
                      <h3 className="text-xl font-semibold text-gray-900">{step.title}</h3>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4">{step.description}</p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 italic">"{step.customer}"</div>
                  </div>
                </div>

                <div className={`p-8 lg:w-1/2 bg-gradient-to-br ${step.color} text-white ${index % 2 === 0 ? 'lg:order-2' : ''}`}>
                  <div className="text-center">
                    <div className="text-6xl mb-4">
                      {index === 0 && "🤔"}
                      {index === 1 && "🔍"}
                      {index === 2 && "💡"}
                      {index === 3 && "🚀"}
                      {index === 4 && "📞"}
                      {index === 5 && "🎉"}
                    </div>
                    <h4 className="text-2xl font-bold mb-2">Stap {index + 1}</h4>
                    <p className="text-blue-100">Jij komt hier in beeld</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Results Stories */}
      <section id="results" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Echte verhalen, echte resultaten
            </h2>
            <p className="text-xl text-gray-600">
              Dit zijn de verhalen van installateurs die WarmeLeads gebruiken.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
            >
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                  <span className="font-bold text-blue-600">M</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Mark de Vries</div>
                  <div className="text-sm text-gray-600">Thuisbatterij Expert</div>
                </div>
              </div>
              <p className="text-gray-700 mb-6 italic">
                "Ik krijg nu leads die écht geïnteresseerd zijn. Mijn conversie is van 15% naar 45% gegaan!"
              </p>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <div className="font-semibold text-green-600">+200% meer offertes</div>
                  <div>€12.000 extra omzet</div>
                </div>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
            >
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center">
                  <span className="font-bold text-green-600">L</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Lisa Jansen</div>
                  <div className="text-sm text-gray-600">Zonnepaneel Specialist</div>
                </div>
              </div>
              <p className="text-gray-700 mb-6 italic">
                "De leads zijn van topkwaliteit. Geen tijdverspilling meer met mensen die niet serieus zijn."
              </p>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <div className="font-semibold text-green-600">30 nieuwe klanten</div>
                  <div>€45.000 extra omzet</div>
                </div>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 md:col-span-2 lg:col-span-1"
            >
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center">
                  <span className="font-bold text-purple-600">R</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Robert Smit</div>
                  <div className="text-sm text-gray-600">Warmtepomp Installateur</div>
                </div>
              </div>
              <p className="text-gray-700 mb-6 italic">
                "WarmeLeads heeft mijn bedrijf getransformeerd. Van 2 naar 25 installaties per maand!"
              </p>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <div className="font-semibold text-green-600">+1.200% groei</div>
                  <div>€85.000 extra omzet</div>
                </div>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-purple-600 to-green-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            Word deel van succesverhalen
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Sluit je aan bij 500+ installateurs die dagelijks nieuwe klantverhalen schrijven.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              Start Je Eigen Verhaal
              <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
            </button>
            <button className="border-2 border-white/30 text-white px-8 py-4 rounded-lg hover:bg-white/10 transition-colors font-semibold text-lg backdrop-blur-sm">
              Lees Meer Verhalen
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

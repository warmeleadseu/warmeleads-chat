'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import {
  CheckIcon,
  StarIcon,
  ArrowRightIcon,
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  SparklesIcon,
  BoltIcon,
  RocketLaunchIcon,
  CursorArrowRaysIcon,
  DevicePhoneMobileIcon,
  CpuChipIcon,
  CloudIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Logo } from '../../components/Logo';

export default function Design5Page() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [activeMetric, setActiveMetric] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  useEffect(() => {
    setIsVisible(true);

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMetric((prev) => (prev + 1) % metrics.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const metrics = [
    { number: "500+", label: "Installateurs", color: "from-cyan-400 to-blue-500" },
    { number: "15min", label: "Levertijd", color: "from-purple-400 to-pink-500" },
    { number: "€2.5M", label: "Omzet", color: "from-green-400 to-emerald-500" },
    { number: "99.9%", label: "Uptime", color: "from-orange-400 to-red-500" }
  ];

  const features = [
    {
      icon: BoltIcon,
      title: "Bliksemsnel",
      description: "AI-gedreven lead matching in realtime",
      gradient: "from-yellow-400 via-orange-500 to-red-500",
      shadow: "shadow-orange-500/25"
    },
    {
      icon: CpuChipIcon,
      title: "AI Powered",
      description: "Machine learning voor perfecte lead kwaliteit",
      gradient: "from-purple-400 via-pink-500 to-red-500",
      shadow: "shadow-pink-500/25"
    },
    {
      icon: CloudIcon,
      title: "Cloud Native",
      description: "Serverless architectuur voor maximale snelheid",
      gradient: "from-blue-400 via-cyan-500 to-teal-500",
      shadow: "shadow-cyan-500/25"
    },
    {
      icon: DevicePhoneMobileIcon,
      title: "Mobile First",
      description: "Perfect geoptimaliseerd voor alle apparaten",
      gradient: "from-green-400 via-emerald-500 to-teal-500",
      shadow: "shadow-emerald-500/25"
    }
  ];

  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    speed: Math.random() * 2 + 1,
    opacity: Math.random() * 0.5 + 0.2
  }));

  return (
    <div ref={containerRef} className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        {/* Gradient Orbs */}
        <motion.div
          animate={{
            x: mousePosition.x * 0.02,
            y: mousePosition.y * 0.02,
          }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: mousePosition.x * -0.01,
            y: mousePosition.y * -0.01,
          }}
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 rounded-full blur-3xl"
        />

        {/* Particles */}
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              opacity: particle.opacity,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [particle.opacity, particle.opacity * 0.5, particle.opacity],
            }}
            transition={{
              duration: particle.speed * 2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }} />
        </div>
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative z-50 bg-black/80 backdrop-blur-xl border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="p-2"
              >
                <Logo />
              </motion.div>
              <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                WarmeLeads
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <motion.a
                whileHover={{ scale: 1.05 }}
                href="#features"
                className="text-gray-300 hover:text-white transition-colors relative group"
              >
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-pink-400 group-hover:w-full transition-all duration-300" />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.05 }}
                href="#tech"
                className="text-gray-300 hover:text-white transition-colors relative group"
              >
                Tech
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-pink-400 group-hover:w-full transition-all duration-300" />
              </motion.a>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-6 py-2 rounded-full font-semibold text-white shadow-lg shadow-purple-500/25 transition-all duration-300"
              >
                Launch App
              </motion.button>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="md:hidden bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 rounded-full text-sm font-semibold shadow-lg"
            >
              Launch
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section
        style={{ y, opacity }}
        className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-6xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.8 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="inline-flex items-center bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 px-6 py-3 rounded-full text-sm font-medium text-purple-200 mb-8 backdrop-blur-sm"
          >
            <SparklesIcon className="w-4 h-4 mr-2 text-purple-400" />
            Next-Gen Lead Platform 2025
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-5xl lg:text-8xl font-bold mb-8 leading-tight"
          >
            <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              Future
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
              Forward
            </span>
            <br />
            <span className="text-white">Leads</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="text-xl lg:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            AI-powered lead generation that predicts, personalizes, and converts.
            The future of B2B lead generation is here.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="flex flex-col sm:flex-row gap-6 justify-center mb-16"
          >
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:from-purple-500 hover:via-pink-500 hover:to-red-500 px-8 py-4 rounded-full font-bold text-lg text-white shadow-2xl shadow-purple-500/30 transition-all duration-300 flex items-center justify-center group"
            >
              Start Free Trial
              <ArrowRightIcon className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="border-2 border-white/20 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/10 hover:border-white/40 transition-all duration-300 backdrop-blur-sm"
            >
              Watch Demo
            </motion.button>
          </motion.div>

          {/* Live Metrics */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.9 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto"
          >
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                whileHover={{ scale: 1.05, y: -5 }}
                className={`bg-gradient-to-br ${metric.color} p-6 rounded-2xl text-center backdrop-blur-xl border border-white/10 ${
                  index === activeMetric ? 'ring-2 ring-white/50 shadow-2xl' : ''
                } transition-all duration-300`}
              >
                <motion.div
                  key={activeMetric}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="text-3xl lg:text-4xl font-bold text-white mb-1"
                >
                  {metric.number}
                </motion.div>
                <div className="text-sm text-white/80">{metric.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-32 bg-gradient-to-b from-black via-gray-900 to-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              Cutting Edge Features
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Built with tomorrow's technology for today's results.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10 }}
                className={`bg-gradient-to-br ${feature.gradient} p-8 rounded-3xl text-white relative overflow-hidden group cursor-pointer`}
              >
                <div className={`absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all duration-300`} />
                <div className="relative z-10">
                  <motion.div
                    whileHover={{ rotate: 15, scale: 1.1 }}
                    className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm"
                  >
                    <feature.icon className="w-8 h-8" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                  <p className="text-lg text-white/90 leading-relaxed">{feature.description}</p>
                </div>

                {/* Floating elements */}
                <motion.div
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="absolute top-4 right-4 w-20 h-20 bg-white/10 rounded-full blur-xl"
                />
                <motion.div
                  animate={{
                    x: [0, 10, 0],
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute bottom-4 left-4 w-16 h-16 bg-white/5 rounded-full"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="tech" className="relative z-10 py-32 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Future Tech Stack
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Powered by the most advanced technologies available.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-cyan-900/50 to-blue-900/50 p-8 rounded-3xl border border-cyan-500/20 backdrop-blur-xl"
            >
              <div className="text-6xl mb-6">🤖</div>
              <h3 className="text-2xl font-bold text-white mb-4">AI & Machine Learning</h3>
              <p className="text-gray-300 leading-relaxed">
                Advanced algorithms predict lead quality, optimize timing, and personalize outreach for maximum conversion.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 p-8 rounded-3xl border border-purple-500/20 backdrop-blur-xl"
            >
              <div className="text-6xl mb-6">⚡</div>
              <h3 className="text-2xl font-bold text-white mb-4">Edge Computing</h3>
              <p className="text-gray-300 leading-relaxed">
                Distributed processing ensures lightning-fast lead delivery with 99.9% uptime worldwide.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 p-8 rounded-3xl border border-green-500/20 backdrop-blur-xl"
            >
              <div className="text-6xl mb-6">🔒</div>
              <h3 className="text-2xl font-bold text-white mb-4">Quantum Security</h3>
              <p className="text-gray-300 leading-relaxed">
                Military-grade encryption with quantum-resistant algorithms protecting your data.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1 }}
        viewport={{ once: true }}
        className="relative z-10 py-32 bg-gradient-to-r from-purple-900 via-pink-900 to-red-900"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-4xl lg:text-6xl font-bold text-white mb-6"
          >
            Join the Future
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
            className="text-xl text-purple-100 mb-12 max-w-2xl mx-auto"
          >
            Be among the first to experience the next generation of lead generation technology.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white text-black px-12 py-5 rounded-full font-bold text-xl shadow-2xl hover:shadow-white/25 transition-all duration-300"
          >
            Launch Your Future
            <RocketLaunchIcon className="w-6 h-6 ml-3 inline" />
          </motion.button>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="relative z-10 bg-black border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <Logo />
              <span className="text-xl font-bold text-white">WarmeLeads</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400 text-sm">© 2025 WarmeLeads. The Future of Lead Generation.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CalculatorIcon } from '@heroicons/react/24/outline';

interface SimpleValueCardProps {
  onStartROIChat: () => void;
}

export function SimpleValueCard({ onStartROIChat }: SimpleValueCardProps) {
  return (
    <motion.div
      className="relative p-8 rounded-2xl text-left overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-300 group cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      whileHover={{ 
        scale: 1.02,
        y: -4,
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onStartROIChat}
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-orange to-brand-red opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-orange to-brand-red flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <CalculatorIcon className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-white">
          Bereken je potentiële winst
        </h3>
        
        <p className="text-white/80 group-hover:text-white/90 transition-colors mb-4">
          Ontdek hoeveel omzet je kunt genereren met onze leads
        </p>

        {/* Quick Preview */}
        <div className="bg-white/10 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80 text-sm">50 leads →</span>
            <span className="text-green-400 font-bold">€60.000 omzet</span>
          </div>
          <div className="text-white/60 text-xs mt-1">
            Bij 15% conversie en €8.000 gemiddelde order
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center text-white/80 group-hover:text-white transition-colors">
          <span className="text-sm font-medium">Start ROI berekening</span>
          <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>

        {/* Arrow */}
        <motion.div
          className="absolute top-6 right-6 text-white/60 group-hover:text-white"
          initial={{ x: 0 }}
          whileHover={{ x: 4 }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
}







'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: { width: 32, height: 32, text: 'text-sm' },
  md: { width: 48, height: 48, text: 'text-base' },
  lg: { width: 64, height: 64, text: 'text-xl' },
  xl: { width: 80, height: 80, text: 'text-2xl' },
  hero: { width: 200, height: 200, text: 'text-4xl' },
};

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizeConfig = sizeClasses[size];

  return (
    <motion.div
      className={`flex items-center space-x-3 ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="relative"
        whileHover={{ scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <Image
          src="/logo.png"
          alt="WarmeLeads Logo"
          width={sizeConfig.width}
          height={sizeConfig.height}
          style={{ width: 'auto', height: 'auto' }}
          priority
          onError={(e) => {
            console.error('Logo kon niet laden:', e);
            // Fallback naar tekst als afbeelding niet laadt
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              const fallbackDiv = document.createElement('div');
              fallbackDiv.className = `w-${sizeConfig.width} h-${sizeConfig.height} bg-brand-pink rounded-lg flex items-center justify-center text-white font-bold text-xs`;
              fallbackDiv.textContent = 'WL';
              parent.appendChild(fallbackDiv);
            }
          }}
        />
      </motion.div>
      
      {showText && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className={`font-bold text-white ${sizeConfig.text}`}>
            WarmeLeads
          </h1>
          <p className="text-white/80 text-xs">
            Exclusieve leadgeneratie
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

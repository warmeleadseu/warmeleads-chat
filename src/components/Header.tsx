'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRightIcon,
  Bars3Icon,
  XMarkIcon,
  CubeTransparentIcon,
  Cog6ToothIcon,
  BookOpenIcon,
  ChevronRightIcon,
  PhoneIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

const navLinks = [
  { label: 'Oplossingen', href: '/maatwerk-leads', icon: CubeTransparentIcon, desc: 'Leads op maat voor jouw niche' },
  { label: 'Hoe het werkt', href: '/hoe-het-werkt', icon: Cog6ToothIcon, desc: 'Ons bewezen 4-stappen proces' },
  { label: 'Inzichten', href: '/blog', icon: BookOpenIcon, desc: 'Tips, cases & strategieën' },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  return (
    <>
      <div className="h-[3px] bg-warmeleads-gradient" />
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/warmeleads-logo-2026.png"
              alt="WarmeLeads"
              width={180}
              height={54}
              priority
              className="h-9 w-auto md:h-10"
            />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[13px] font-semibold tracking-wide text-slate-500 transition hover:text-brand-purple"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/portal"
              className="hidden text-[13px] font-semibold text-slate-500 transition hover:text-brand-purple lg:inline-flex"
            >
              Klant login
            </Link>
            <Link
              href="/gratis-account"
              className="hidden items-center gap-1.5 rounded-lg border border-brand-purple/30 px-3.5 py-2 text-[13px] font-semibold text-brand-purple transition hover:bg-brand-purple/5 lg:inline-flex"
            >
              Gratis account
            </Link>
            <Link
              href="/plan-gesprek"
              className="group hidden items-center gap-2 rounded-lg bg-button-gradient px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30 sm:inline-flex"
            >
              Plan gesprek
              <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 lg:hidden"
              aria-label="Menu"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Side drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-brand-navy/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 right-0 z-[70] flex w-[min(320px,85vw)] flex-col bg-white shadow-2xl lg:hidden"
            >
              {/* Gradient accent top */}
              <div className="h-[3px] shrink-0 bg-warmeleads-gradient" />

              {/* Header row */}
              <div className="flex h-16 shrink-0 items-center justify-between px-5">
                <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                  <Image
                    src="/warmeleads-logo-2026.png"
                    alt="WarmeLeads"
                    width={130}
                    height={39}
                    className="h-7 w-auto"
                  />
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                  aria-label="Sluit menu"
                >
                  <XMarkIcon className="h-[18px] w-[18px]" />
                </button>
              </div>

              {/* Divider */}
              <div className="mx-5 h-px bg-slate-100" />

              {/* Nav links with icons + descriptions */}
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                <div className="space-y-0.5">
                  {navLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="group flex items-center gap-3.5 rounded-xl px-3 py-3 transition active:bg-slate-100 hover:bg-slate-50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-purple/[0.08]">
                        <item.icon className="h-[18px] w-[18px] text-brand-purple" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-slate-800">{item.label}</p>
                        <p className="text-[12px] leading-tight text-slate-400">{item.desc}</p>
                      </div>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-500 group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              </nav>

              {/* Bottom section */}
              <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
                {/* Contact row */}
                <div className="mb-3 flex items-center justify-center gap-5 text-[12px] text-slate-400">
                  <a href="tel:+31850477067" className="inline-flex items-center gap-1.5 transition hover:text-slate-600">
                    <PhoneIcon className="h-3.5 w-3.5" />
                    085 047 7067
                  </a>
                  <span className="h-3 w-px bg-slate-200" />
                  <a href="mailto:info@warmeleads.eu" className="inline-flex items-center gap-1.5 transition hover:text-slate-600">
                    <EnvelopeIcon className="h-3.5 w-3.5" />
                    Mail ons
                  </a>
                </div>

                {/* CTAs */}
                <Link
                  href="/gratis-account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-brand-purple/30 px-4 py-3 text-[14px] font-bold text-brand-purple transition active:scale-[0.98] hover:bg-brand-purple/5"
                >
                  Gratis account aanmaken
                </Link>
                <Link
                  href="/plan-gesprek"
                  onClick={() => setMobileMenuOpen(false)}
                  className="group flex items-center justify-center gap-2 rounded-xl bg-button-gradient px-4 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-brand-orange/25 transition active:scale-[0.98]"
                >
                  Plan gratis strategiegesprek
                  <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Sticky mobile CTA bar (hidden on /plan-gesprek) */}
      {pathname !== '/plan-gesprek' && (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-lg sm:hidden">
        <Link
          href="/plan-gesprek"
          className="group flex items-center justify-center gap-2 rounded-xl bg-button-gradient px-4 py-3 text-[14px] font-bold text-white shadow-lg shadow-brand-orange/25 transition active:scale-[0.98]"
        >
          Plan gratis strategiegesprek
          <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
      )}
    </>
  );
}

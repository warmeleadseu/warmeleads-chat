'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShareIcon,
  LinkIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  UserCircleIcon,
  SparklesIcon,
  BoltIcon,
  SunIcon,
  FireIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

interface BlogArticle {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  readTime: string;
  author: string;
  image: string;
  keywords: string[];
  content?: string;
}

interface BlogPostClientProps {
  article: BlogArticle;
  relatedArticles: BlogArticle[];
}

const categoryColors: Record<string, string> = {
  'SEO': 'bg-brand-navy/10 text-brand-navy border-brand-navy/20',
  'Marketing': 'bg-brand-purple/10 text-brand-purple border-brand-purple/20',
  'B2B': 'bg-brand-orange/10 text-brand-orange border-brand-orange/20',
  'Conversie': 'bg-brand-pink/10 text-brand-pink border-brand-pink/20',
  'AI': 'bg-brand-pink/10 text-brand-pink border-brand-pink/20',
  'Social Media': 'bg-brand-purple/10 text-brand-purple border-brand-purple/20',
  'E-commerce': 'bg-brand-orange/10 text-brand-orange border-brand-orange/20',
  'Analytics': 'bg-brand-navy/10 text-brand-navy border-brand-navy/20',
  'Sales': 'bg-brand-orange/10 text-brand-orange border-brand-orange/20',
};

export default function BlogPostClient({ article, relatedArticles }: BlogPostClientProps) {
  const [readingProgress, setReadingProgress] = useState(0);
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    const updateReadingProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = (scrollTop / docHeight) * 100;
      setReadingProgress(progress);
    };

    window.addEventListener('scroll', updateReadingProgress);
    return () => window.removeEventListener('scroll', updateReadingProgress);
  }, []);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `${article.title} - ${article.excerpt}`;

  const handleShare = (platform: string) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      email: `mailto:?subject=${encodedText}&body=${encodedUrl}`,
    };

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white text-slate-900">
        {/* Reading Progress Bar */}
        <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-slate-200/50">
          <motion.div
            className="h-full bg-warmeleads-gradient"
            style={{ width: `${readingProgress}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${readingProgress}%` }}
          />
        </div>

      {/* Floating Share Button */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:block">
        <div className="relative">
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="bg-white text-slate-600 p-4 rounded-full border border-slate-200 shadow-lg hover:bg-slate-50 hover:text-brand-purple hover:scale-110 transition-all"
            title="Deel dit artikel"
          >
            <ShareIcon className="w-5 h-5" />
          </button>

          {showShareMenu && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute right-full mr-4 top-0 bg-white rounded-2xl border border-slate-200 p-3 shadow-xl"
            >
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleShare('whatsapp')}
                  className="flex items-center gap-2.5 text-slate-700 hover:text-brand-purple transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium whitespace-nowrap"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </button>
                <button
                  onClick={() => handleShare('linkedin')}
                  className="flex items-center gap-2.5 text-slate-700 hover:text-brand-purple transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium whitespace-nowrap"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  LinkedIn
                </button>
                <button
                  onClick={() => handleShare('twitter')}
                  className="flex items-center gap-2.5 text-slate-700 hover:text-brand-purple transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium whitespace-nowrap"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  X / Twitter
                </button>
                <button
                  onClick={() => handleShare('facebook')}
                  className="flex items-center gap-2.5 text-slate-700 hover:text-brand-purple transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium whitespace-nowrap"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  onClick={copyLink}
                  className="flex items-center gap-2.5 text-slate-700 hover:text-brand-purple transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium whitespace-nowrap"
                >
                  <LinkIcon className="w-4 h-4" />
                  Kopieer link
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Mobile Share Bar */}
      <div className="lg:hidden sticky top-[75px] z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/blog" className="text-slate-500 hover:text-slate-900 text-sm flex items-center gap-1.5">
              <ChevronLeftIcon className="h-4 w-4" />
              <span>Terug</span>
            </Link>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleShare('whatsapp')}
                className="text-slate-400 hover:text-brand-purple p-2 rounded-lg hover:bg-slate-50 transition-colors"
                title="Deel via WhatsApp"
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </button>
              <button
                onClick={() => handleShare('linkedin')}
                className="text-slate-400 hover:text-brand-purple p-2 rounded-lg hover:bg-slate-50 transition-colors"
                title="Deel op LinkedIn"
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </button>
              <button
                onClick={copyLink}
                className="text-slate-400 hover:text-brand-purple p-2 rounded-lg hover:bg-slate-50 transition-colors"
                title="Kopieer link"
              >
                <LinkIcon className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Article Hero */}
      <div className="bg-brand-navy pt-8 lg:pt-16 pb-20">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-sm text-white/60 mb-8"
          >
            <Link href="/" className="hover:text-white/90 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-white/90 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-white/90">{article.category}</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="px-4 py-2 rounded-xl text-sm font-semibold border bg-white/20 text-white border-white/30">
                {article.category}
              </span>
              <span className="text-white/60 text-sm">{article.readTime}</span>
              <span className="text-white/60 text-sm">·</span>
              <span className="text-white/60 text-sm">{article.date}</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
              {article.title}
            </h1>

            <p className="text-xl md:text-2xl text-white/90 leading-relaxed mb-6">
              {article.excerpt}
            </p>

            <div className="flex items-center gap-2.5 text-white/70">
              <UserCircleIcon className="h-5 w-5 text-white/50" />
              <span className="font-medium text-sm">{article.author}</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Article Content */}
      <article className="bg-white relative z-10">
        <div className="max-w-4xl mx-auto px-4 -mt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-3xl p-6 md:p-12 shadow-lg border border-slate-100 mb-12"
          >
            <div className="prose prose-lg max-w-none">
              {article.content ? (
                <div
                  className="blog-content [&_h2]:text-2xl [&_h2]:md:text-3xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mb-6 [&_h2]:mt-10 [&_p]:text-slate-700 [&_p]:leading-relaxed [&_p]:mb-4 [&_p]:text-lg [&_ul]:space-y-2 [&_ul]:mb-6 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-slate-700 [&_li]:text-lg [&_ol]:space-y-2 [&_ol]:mb-6 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-slate-900"
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />
              ) : (
                <>
              <section className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Inleiding</h2>
                <p className="text-slate-700 leading-relaxed mb-4 text-lg">
                  In de snel veranderende wereld van leadgeneratie is het cruciaal om bij te blijven met de laatste
                  trends en strategieën. Dit artikel biedt je diepgaande inzichten en praktische tips om je
                  leadgeneratie naar een hoger niveau te tillen.
                </p>
                <p className="text-slate-700 leading-relaxed text-lg">
                  Of je nu net begint met leadgeneratie of een ervaren marketeer bent, deze gids biedt waardevolle
                  kennis die direct toepasbaar is in je dagelijkse praktijk.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Waarom dit belangrijk is</h2>
                <p className="text-slate-700 leading-relaxed mb-4 text-lg">
                  De Nederlandse markt kent unieke uitdagingen en kansen. Met de juiste strategie en tools kun je
                  significante resultaten behalen. Uit recent onderzoek blijkt dat bedrijven die gestructureerd
                  werken aan leadgeneratie tot 50% meer gekwalificeerde leads genereren.
                </p>
                <ul className="space-y-3 mb-6">
                  {['Verhoogde naamsbekendheid in je doelgroep', 'Lagere kosten per acquisitie (CPA)', 'Betere kwaliteit van inkomende leads', 'Hogere conversieratio\'s in je verkoopproces'].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-700 text-lg">
                      <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Praktische Implementatie</h2>
                <p className="text-slate-700 leading-relaxed mb-6 text-lg">
                  De implementatie van deze strategieën vereist een gestructureerde aanpak. Begin met een grondige
                  analyse van je huidige situatie en stel duidelijke, meetbare doelen. Volg deze stappen:
                </p>
                <div className="space-y-4">
                  {[
                    { title: 'Analyseer je huidige leadgeneratie', desc: 'Waar komen je leads vandaan en wat is de kwaliteit?' },
                    { title: 'Definieer je ideale klantprofiel', desc: 'Wie wil je bereiken en waarom?' },
                    { title: 'Kies de juiste kanalen', desc: 'Focus op wat het beste werkt voor je doelgroep' },
                    { title: 'Test en optimaliseer', desc: 'Continue verbetering is de sleutel tot succes' },
                    { title: 'Meet en rapporteer', desc: 'Data-driven beslissingen leiden tot betere resultaten' }
                  ].map((step, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-brand-orange/20 text-brand-orange rounded-full flex items-center justify-center font-bold text-sm">{i + 1}</span>
                        <div>
                          <h3 className="font-bold text-slate-900 mb-1">{step.title}</h3>
                          <p className="text-slate-600 text-sm">{step.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Veelgemaakte Fouten</h2>
                <div className="bg-brand-pink/5 border-2 border-brand-pink/20 rounded-2xl p-6 mb-4">
                  <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2.5">
                    <ExclamationTriangleIcon className="h-5 w-5 text-brand-pink" />
                    <span>Let op deze valkuilen</span>
                  </h3>
                  <ul className="space-y-3">
                    {['Te brede targeting zonder duidelijke focus', 'Geen follow-up strategie voor gegenereerde leads', 'Onvoldoende testen van verschillende benaderingen', 'Niet investeren in de juiste tools en training'].map((mistake, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-700">
                        <XMarkIcon className="h-4 w-4 shrink-0 text-brand-pink mt-0.5" />
                        <span>{mistake}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Success Stories</h2>
                <div className="bg-brand-orange/5 border-2 border-brand-orange/20 rounded-2xl p-6">
                  <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2.5">
                    <SparklesIcon className="h-5 w-5 text-brand-orange" />
                    <span>Resultaten uit de praktijk</span>
                  </h3>
                  <blockquote className="text-slate-700 italic border-l-4 border-brand-orange/50 pl-6 py-2 text-lg">
                    &ldquo;Door de implementatie van deze strategieën zagen we binnen 3 maanden een toename van 127%
                    in gekwalificeerde leads. De ROI was fenomenaal.&rdquo;
                    <footer className="text-slate-500 text-sm mt-2 not-italic">
                      · Marketing Director bij groot Nederlands installatiebedrijf
                    </footer>
                  </blockquote>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Conclusie en Volgende Stappen</h2>
                <p className="text-slate-700 leading-relaxed mb-4 text-lg">
                  De wereld van leadgeneratie blijft evolueren, maar de fundamentele principes blijven hetzelfde:
                  begrijp je doelgroep, bied waarde, en optimaliseer continu. Door de strategieën uit dit artikel
                  toe te passen, leg je een solide basis voor succesvolle leadgeneratie.
                </p>
                <p className="text-slate-700 leading-relaxed text-lg">
                  Wil je direct aan de slag met professionele leadgeneratie?
                  <Link href="/" className="text-brand-orange underline hover:text-brand-purple ml-1 font-semibold">
                    Ontdek onze diensten
                  </Link> en zie hoe WarmeLeads je kan helpen je doelen te bereiken.
                </p>
              </section>
                </>
              )}

              {/* Keywords */}
              <section className="mt-12 pt-8 border-t border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Gerelateerde onderwerpen:</h3>
                <div className="flex flex-wrap gap-2">
                  {article.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="bg-slate-100 text-slate-600 px-4 py-2 rounded-full text-sm border border-slate-200 hover:bg-slate-200 hover:scale-105 transition-all cursor-default"
                    >
                      #{keyword}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>

          {/* Internal Links Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-16"
          >
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8 text-center">
              Ontdek onze leads
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Link href="/leads-thuisbatterijen" className="group block">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy/10 mb-3">
                    <BoltIcon className="h-5 w-5 text-brand-navy" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-brand-navy transition-colors">
                    Thuisbatterij Leads
                  </h4>
                  <p className="text-slate-500 text-sm">
                    Exclusieve en gedeelde leads voor thuisbatterij installateurs
                  </p>
                </div>
              </Link>

              <Link href="/leads-zonnepanelen" className="group block">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/10 mb-3">
                    <SunIcon className="h-5 w-5 text-brand-orange" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-brand-orange transition-colors">
                    Zonnepaneel Leads
                  </h4>
                  <p className="text-slate-500 text-sm">
                    Warme leads voor zonnepaneel installaties en onderhoud
                  </p>
                </div>
              </Link>

              <Link href="/leads-warmtepompen" className="group block">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-purple/10 mb-3">
                    <FireIcon className="h-5 w-5 text-brand-purple" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-brand-purple transition-colors">
                    Warmtepomp Leads
                  </h4>
                  <p className="text-slate-500 text-sm">
                    Kwalitatieve leads voor warmtepomp installaties
                  </p>
                </div>
              </Link>

              <Link href="/maatwerk-leads" className="group block">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-pink/10 mb-3">
                    <AdjustmentsHorizontalIcon className="h-5 w-5 text-brand-pink" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-brand-pink transition-colors">
                    Maatwerk Leads
                  </h4>
                  <p className="text-slate-500 text-sm">
                    Op maat gemaakte leads voor jouw specifieke branche
                  </p>
                </div>
              </Link>
            </div>
          </motion.div>
        </div>
      </article>

      {/* CTA Section */}
      <div className="bg-brand-navy">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <SparklesIcon className="h-7 w-7 text-brand-orange" />
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Klaar om uw leadgeneratie te transformeren?
            </h3>
            <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
              WarmeLeads levert dagelijks verse, hoogwaardige leads voor uw bedrijf.
              Van zonnepanelen tot thuisbatterijen, van warmtepompen tot financial lease.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-white text-brand-navy px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform shadow-lg"
            >
              Start nu met WarmeLeads
              <ArrowRightIcon className="h-[18px] w-[18px]" />
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <div className="bg-slate-50">
          <div className="max-w-4xl mx-auto px-4 py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8 text-center">
                Gerelateerde Artikelen
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedArticles.map((related, index) => (
                  <motion.div
                    key={related.slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 * index }}
                  >
                    <Link href={`/blog/${related.slug}`}>
                      <div className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full flex flex-col overflow-hidden">
                        <div className="h-1.5 w-full bg-brand-purple" />
                        <div className="p-6 flex flex-col flex-1">
                          <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold border mb-3 self-start ${categoryColors[related.category] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {related.category}
                          </span>
                          <h3 className="text-lg font-bold text-slate-900 mb-3 leading-tight group-hover:text-brand-purple transition-colors">
                            {related.title}
                          </h3>
                          <p className="text-slate-500 text-sm line-clamp-2 mb-4 flex-grow">
                            {related.excerpt}
                          </p>
                          <div className="flex items-center gap-2 text-slate-400 text-xs">
                            <span>{related.readTime}</span>
                            <span>·</span>
                            <span>{related.date}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Back to Blog */}
      <div className="bg-white py-12">
        <div className="text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 bg-brand-navy text-white px-8 py-4 rounded-xl font-semibold hover:bg-brand-navy/90 hover:scale-105 transition-all"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Terug naar alle artikelen
          </Link>
        </div>
      </div>

      </div>
      <Footer />
    </>
  );
}

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpenIcon,
  TagIcon,
  ArrowUpCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  SparklesIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  EnvelopeIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { blogArticles } from '@/data/blogArticles';

const mainCategories = ['SEO', 'Marketing', 'AI', 'B2B', 'Conversie', 'Analytics'];

const categoryMapping: Record<string, string> = {
  'SEO Marketing': 'SEO',
  'SEO': 'SEO',
  'Marketing': 'Marketing',
  'B2B Marketing': 'B2B',
  'B2B Strategy': 'B2B',
  'B2B': 'B2B',
  'Email Marketing': 'Marketing',
  'Content Marketing': 'Marketing',
  'Video Marketing': 'Marketing',
  'Social Media': 'Marketing',
  'Paid Advertising': 'Marketing',
  'Influencer Marketing': 'Marketing',
  'Audio Marketing': 'Marketing',
  'Mobile Marketing': 'Marketing',
  'Retargeting': 'Marketing',
  'Referral Marketing': 'Marketing',
  'UGC Marketing': 'Marketing',
  'Outbound Sales': 'Marketing',
  'AI & Technologie': 'AI',
  'AI': 'AI',
  'Chatbots': 'AI',
  'Automatisering': 'AI',
  'Conversie Optimalisatie': 'Conversie',
  'Conversie': 'Conversie',
  'Analytics': 'Analytics',
  'Data Analytics': 'Analytics',
  'Marktanalyse': 'Analytics',
  'Tools & Software': 'Analytics',
  'AI Gegenereerd': 'AI',
  'Webinars': 'Marketing',
  'Tips & Tricks': 'Marketing',
  'Trends': 'Marketing',
  'Strategie': 'Marketing',
  'Lead Management': 'B2B',
  'Voice SEO': 'SEO',
  'Personalisatie': 'Marketing',
  'Content Formats': 'Marketing',
  'Community': 'Marketing',
  'Partnerships': 'B2B',
  'Omnichannel': 'Marketing',
  'Compliance': 'B2B',
  'Customer Journey': 'Conversie',
  'Brand Storytelling': 'Marketing',
  'Mobile Strategy': 'Marketing',
  'Psychologie': 'Marketing',
  'Growth Hacking': 'Marketing',
  'Markttrends': 'Analytics',
  'Subsidies': 'B2B',
  'ROI & Rendement': 'Analytics',
  'Besparen': 'Conversie',
  'Sales & Conversie': 'Conversie',
  'Belasting & Regelgeving': 'B2B',
  'Product Reviews': 'Analytics',
  'Lokale Marketing': 'SEO',
  'Reputatiemanagement': 'Marketing',
  'Beleid & Regelgeving': 'B2B',
  'Digitale Tools': 'AI',
  'Software & Tools': 'Analytics',
  'Prijzen & Kosten': 'Analytics',
  'Installatie Tips': 'Marketing',
  'Marketing Strategie': 'Marketing',
  'Productvergelijking': 'Analytics',
  'Klantacquisitie': 'Marketing',
};

const categoryColors: Record<string, string> = {
  'SEO': 'bg-brand-navy/10 text-brand-navy border-brand-navy/20',
  'Marketing': 'bg-brand-purple/10 text-brand-purple border-brand-purple/20',
  'B2B': 'bg-brand-orange/10 text-brand-orange border-brand-orange/20',
  'Conversie': 'bg-brand-pink/10 text-brand-pink border-brand-pink/20',
  'AI': 'bg-brand-pink/10 text-brand-pink border-brand-pink/20',
  'Analytics': 'bg-brand-navy/10 text-brand-navy border-brand-navy/20',
};

const categoryAccent: Record<string, string> = {
  'SEO': 'bg-brand-navy',
  'Marketing': 'bg-brand-purple',
  'B2B': 'bg-brand-orange',
  'Conversie': 'bg-brand-pink',
  'AI': 'bg-brand-pink',
  'Analytics': 'bg-brand-navy',
};

export default function BlogPageClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Alle');
  const [currentPage, setCurrentPage] = useState(1);
  const articlesPerPage = 9;

  const filteredArticles = useMemo(() => {
    return blogArticles.filter(article => {
      const matchesSearch =
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.keywords.some(keyword => keyword.toLowerCase().includes(searchQuery.toLowerCase()));

      const mappedCategory = categoryMapping[article.category] || article.category;
      const matchesCategory = selectedCategory === 'Alle' || mappedCategory === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const totalPages = Math.ceil(filteredArticles.length / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const paginatedArticles = filteredArticles.slice(startIndex, startIndex + articlesPerPage);

  const featuredArticle = blogArticles[0];

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Alle': blogArticles.length };

    blogArticles.forEach(article => {
      const mappedCategory = categoryMapping[article.category] || article.category;
      counts[mappedCategory] = (counts[mappedCategory] || 0) + 1;
    });

    return counts;
  }, []);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white text-slate-900">

      {/* Hero Section */}
      <div className="bg-brand-navy pt-12 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-white/60 mb-6">
            <Link href="/" className="hover:text-white/90 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-white/90">Blog</span>
          </div>

          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-7xl font-black mb-6 text-white">
                Leadgeneratie Blog
              </h1>
              <p className="text-xl md:text-2xl text-white/90 mb-4 max-w-3xl mx-auto">
                Expert inzichten, tips en strategieën voor Nederlandse bedrijven
              </p>
              <div className="flex items-center justify-center gap-6 text-white/70 text-sm">
                <div className="flex items-center gap-2">
                  <BookOpenIcon className="h-4 w-4 text-brand-orange" />
                  <span>{blogArticles.length} artikelen</span>
                </div>
                <div className="flex items-center gap-2">
                  <TagIcon className="h-4 w-4 text-brand-orange" />
                  <span>{mainCategories.length} categorieën</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpCircleIcon className="h-4 w-4 text-brand-orange" />
                  <span>Wekelijks nieuwe artikelen</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-2xl mx-auto mb-8"
          >
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" aria-hidden="true" />
              <input
                type="search"
                aria-label="Zoek artikelen"
                placeholder="Zoek artikelen over leadgeneratie, SEO, marketing..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl pl-13 pr-12 py-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all"
                style={{ paddingLeft: '3.25rem' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Zoekopdracht wissen"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/90 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Category Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex flex-wrap items-center justify-center gap-3">
              {['Alle', ...mainCategories].map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  aria-pressed={selectedCategory === category}
                  className={`
                    px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300
                    ${selectedCategory === category
                      ? 'bg-white text-brand-navy scale-110 shadow-xl'
                      : 'bg-white/10 backdrop-blur-sm text-white/80 border border-white/20 hover:bg-white/20 hover:scale-105'
                    }
                  `}
                >
                  {category}
                  <span className="ml-2 text-xs opacity-70">({categoryCounts[category] || 0})</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content Section */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Featured Article */}
          {selectedCategory === 'Alle' && !searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-16"
            >
              <div className="text-center mb-6">
                <span className="inline-flex items-center gap-2 bg-brand-orange/10 text-brand-orange px-4 py-2 rounded-full text-sm font-semibold border border-brand-orange/20">
                  <SparklesIcon className="h-4 w-4" />
                  Uitgelicht Artikel
                </span>
              </div>
              <Link href={`/blog/${featuredArticle.slug}`}>
                <div className="bg-brand-navy rounded-3xl p-8 md:p-12 hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] cursor-pointer shadow-xl">
                  <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold border bg-white/20 text-white border-white/30">
                        {featuredArticle.category}
                      </span>
                      <span className="text-white/60 text-sm">{featuredArticle.readTime}</span>
                      <span className="text-white/60 text-sm">·</span>
                      <span className="text-white/60 text-sm">{featuredArticle.date}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                      {featuredArticle.title}
                    </h2>
                    <p className="text-white/80 text-lg mb-6 leading-relaxed">
                      {featuredArticle.excerpt}
                    </p>
                    <span className="inline-flex items-center gap-2 bg-white text-brand-navy px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-transform">
                      Lees dit artikel
                      <ArrowRightIcon className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

          {/* Results Info */}
          <div className="text-center mb-8">
            <p className="text-slate-500 text-lg">
              {filteredArticles.length === 0 ? (
                <>Geen artikelen gevonden voor &ldquo;{searchQuery}&rdquo;</>
              ) : (
                <>{filteredArticles.length} artikel{filteredArticles.length !== 1 ? 'en' : ''} gevonden</>
              )}
            </p>
          </div>

          {/* Articles Grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedCategory}-${searchQuery}-${currentPage}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12"
            >
              {paginatedArticles.map((article, index) => {
                const mapped = categoryMapping[article.category] || article.category;
                const accent = categoryAccent[mapped] || 'bg-brand-navy';
                return (
                  <motion.div
                    key={article.slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <Link href={`/blog/${article.slug}`}>
                      <div className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full flex flex-col overflow-hidden">
                        <div className={`h-1.5 w-full ${accent}`} />
                        <div className="p-6 flex flex-col flex-1">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${categoryColors[mapped] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {article.category}
                            </span>
                            <span className="text-slate-400 text-xs">{article.readTime}</span>
                          </div>

                          <div className="text-sm text-slate-400 mb-3">{article.date}</div>

                          <h3 className="text-xl font-bold text-slate-900 mb-3 leading-tight group-hover:text-brand-purple transition-colors flex-grow">
                            {article.title}
                          </h3>

                          <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-3">
                            {article.excerpt}
                          </p>

                          <div className="mt-auto">
                            <span className="inline-flex items-center gap-2 text-brand-purple font-medium text-sm group-hover:gap-3 transition-all">
                              Lees meer
                              <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mb-12">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 transition-all text-sm"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                Vorige
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`
                          w-10 h-10 rounded-xl font-semibold transition-all
                          ${currentPage === page
                            ? 'bg-brand-navy text-white scale-110'
                            : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                          }
                        `}
                      >
                        {page}
                      </button>
                    );
                  } else if (
                    page === currentPage - 2 ||
                    page === currentPage + 2
                  ) {
                    return (
                      <span key={page} className="text-slate-400 px-2">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 transition-all text-sm"
              >
                Volgende
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Gratis Account CTA */}
      <div className="bg-brand-navy">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <SparklesIcon className="h-7 w-7 text-brand-orange" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Zelf ervaren hoe het werkt?
            </h2>
            <p className="text-white/80 text-lg mb-6 max-w-2xl mx-auto">
              Maak gratis een account aan op ons klantportaal en ontvang <strong className="text-brand-orange">20% welkomstkorting</strong> op je eerste batch leads.
            </p>
            <Link
              href="/gratis-account"
              className="inline-flex items-center gap-2 bg-button-gradient text-white px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform shadow-lg shadow-brand-orange/30"
            >
              Maak gratis een account aan
              <ArrowRightIcon className="h-[18px] w-[18px]" />
            </Link>
            <p className="mt-4 text-sm text-white/40">Geen verplichtingen &bull; Direct toegang &bull; 20% welkomstkorting</p>
          </motion.div>
        </div>
      </div>

      {/* Back to Home */}
      <div className="bg-slate-50 py-12">
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-brand-navy text-white px-8 py-4 rounded-xl font-semibold hover:bg-brand-navy/90 hover:scale-105 transition-all"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Terug naar homepage
          </Link>
        </div>
      </div>

      </div>
      <Footer />
    </>
  );
}

'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XMarkIcon, StarIcon } from '@heroicons/react/24/outline';

interface OrderFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    orderNumber: string;
    type: string;
    date: string;
    amount: string;
    feedbackRating?: number;
    feedbackNotes?: string;
  } | null;
  onSubmit: (orderNumber: string, rating: number, notes: string) => Promise<void>;
  isSubmitting?: boolean;
}

const ratingLabels: Record<number, string> = {
  1: 'Zeer ontevreden',
  2: 'Ontevreden',
  3: 'Neutraal',
  4: 'Tevreden',
  5: 'Zeer tevreden',
};

export function OrderFeedbackModal({ isOpen, onClose, order, onSubmit, isSubmitting = false }: OrderFeedbackModalProps) {
  const initialRating = order?.feedbackRating || 0;
  const initialNotes = order?.feedbackNotes || '';

  const [rating, setRating] = useState<number>(initialRating);
  const [notes, setNotes] = useState<string>(initialNotes);
  const [error, setError] = useState<string>('');

  React.useEffect(() => {
    if (order) {
      setRating(order.feedbackRating || 0);
      setNotes(order.feedbackNotes || '');
      setError('');
    }
  }, [order?.orderNumber]);

  const selectedLabel = useMemo(() => {
    return rating > 0 ? ratingLabels[rating] : 'Selecteer een beoordeling';
  }, [rating]);

  if (!order) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rating) {
      setError('Kies een beoordeling tussen 1 en 5 sterren.');
      return;
    }

    setError('');
    await onSubmit(order.orderNumber, rating, notes.trim());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center px-4"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
          >
            <motion.form
              onSubmit={handleSubmit}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-brand-navy/95 via-brand-purple/90 to-brand-pink/85 p-6 text-white shadow-[0_45px_95px_-50px_rgba(16,6,38,0.85)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={onClose}
                className="absolute right-5 top-5 rounded-full bg-white/10 p-1 text-white/70 hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>

              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50">Feedback</p>
                  <h2 className="mt-2 text-2xl font-semibold">Hoe was deze order?</h2>
                  <p className="text-sm text-white/70">Vertel ons wat goed ging en wat beter kan. We leveren hiermee iedere batch nog scherper.</p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs text-white/50">Bestelling</p>
                  <div className="mt-1 text-sm text-white/80">
                    <p className="font-semibold">{order.type}</p>
                    <p className="text-white/60">{order.orderNumber} • {order.date} • {order.amount}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/50">Beoordeling</p>
                  <div className="mt-3 flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((value) => {
                      const isActive = value <= rating;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRating(value)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${isActive ? 'border-yellow-300 bg-yellow-300/20 text-yellow-200' : 'border-white/15 bg-white/5 text-white/40 hover:text-white/70'}`}
                        >
                          <StarIcon className="h-5 w-5" />
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-sm text-white/70">{selectedLabel}</p>
                </div>

                <div>
                  <label htmlFor="order-feedback-notes" className="text-xs text-white/50">
                    Toelichting (optioneel)
                  </label>
                  <textarea
                    id="order-feedback-notes"
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Wat viel op? Waarmee kunnen we je volgende batch beter maken?"
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-white/10 p-3 text-sm text-white placeholder:text-white/40 focus:border-white/35 focus:outline-none"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-200">{error}</p>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white"
                    disabled={isSubmitting}
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    className={`rounded-xl bg-gradient-to-r from-brand-pink to-brand-purple px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-purple/30 transition ${isSubmitting ? 'opacity-80 cursor-not-allowed' : 'hover:from-brand-pink/90 hover:to-brand-purple/90'}`}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Opslaan...' : 'Feedback versturen'}
                  </button>
                </div>
              </div>
            </motion.form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

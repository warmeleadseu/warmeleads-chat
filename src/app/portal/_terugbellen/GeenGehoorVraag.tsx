'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';

/** Na "Geen gehoor": terugbellen inplannen? Verdwijnt vanzelf. */
export default function GeenGehoorVraag({ naam, onPlan, onSluit }: { naam: string; onPlan: () => void; onSluit: () => void }) {
  useEffect(() => {
    const t = setTimeout(onSluit, 10_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- één keer per lead (key)
  }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
      className="fixed inset-x-3 bottom-20 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <p className="min-w-0 flex-1 truncate text-sm text-slate-700">Geen gehoor bij <strong>{naam}</strong></p>
      <button type="button" onClick={onPlan} className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700">Terugbellen inplannen</button>
      <button type="button" onClick={onSluit} aria-label="Sluiten" className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-4 w-4" /></button>
    </motion.div>
  );
}

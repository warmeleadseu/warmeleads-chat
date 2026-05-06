/**
 * Stabiele, distinctieve kleur per admin/AM. Op basis van een eenvoudige
 * djb2-style hash van het admin-id, zodat dezelfde gebruiker altijd dezelfde
 * kleur krijgt zonder dat we kleuren in de database hoeven te beheren.
 */

const PALETTE = [
  { bg: '#6366f1', ring: 'ring-indigo-300' }, // indigo
  { bg: '#ec4899', ring: 'ring-pink-300' }, // pink
  { bg: '#f97316', ring: 'ring-orange-300' }, // orange
  { bg: '#10b981', ring: 'ring-emerald-300' }, // emerald
  { bg: '#0ea5e9', ring: 'ring-sky-300' }, // sky
  { bg: '#a855f7', ring: 'ring-purple-300' }, // purple
  { bg: '#ef4444', ring: 'ring-rose-300' }, // rose
  { bg: '#14b8a6', ring: 'ring-teal-300' }, // teal
  { bg: '#eab308', ring: 'ring-yellow-300' }, // yellow
  { bg: '#06b6d4', ring: 'ring-cyan-300' }, // cyan
  { bg: '#84cc16', ring: 'ring-lime-300' }, // lime
  { bg: '#8b5cf6', ring: 'ring-violet-300' }, // violet
] as const;

export interface AdminColor {
  bg: string;
  ring: string;
}

export function colorForAdmin(id: string | null | undefined): AdminColor {
  if (!id) return { bg: '#94a3b8', ring: 'ring-slate-300' };
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) + hash + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx];
}

export function initialsForName(name: string | null | undefined): string {
  if (!name) return '?';
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

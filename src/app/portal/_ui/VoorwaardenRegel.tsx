import Link from 'next/link';
import { VOORWAARDEN_PAD } from '@/lib/voorwaardenBijBetalen';

/**
 * Onder elke betaal- of bestelknop in het portaal: door te betalen gaat de
 * klant akkoord met de algemene voorwaarden (zie src/lib/voorwaardenBijBetalen.ts).
 */
export function VoorwaardenRegel({ soort = 'betalen', className = '' }: { soort?: 'betalen' | 'bestellen' | 'aanzetten'; className?: string }) {
  return (
    <p className={`text-[11px] leading-snug text-slate-500 ${className}`}>
      Door te {soort} ga je akkoord met onze{' '}
      <Link href={VOORWAARDEN_PAD} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-purple underline decoration-brand-purple/30 hover:text-brand-purple/80">
        algemene voorwaarden
      </Link>
      .
    </p>
  );
}

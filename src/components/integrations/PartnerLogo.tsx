import Image from 'next/image';

/**
 * Logo van een partner op een rustig vlak, overal even groot en even
 * uitgelijnd. Zonder logo de eerste letter van de naam, zodat een nieuwe
 * partner nooit een gat in het scherm geeft.
 */
export default function PartnerLogo({
  naam,
  logo,
  grootte = 40,
}: {
  naam: string;
  logo: string | null | undefined;
  /** Zijde van het vlak in pixels. */
  grootte?: number;
}) {
  const rand = Math.max(4, Math.round(grootte * 0.14));
  const stijl = { width: grootte, height: grootte, borderRadius: Math.round(grootte * 0.28) };

  if (!logo) {
    return (
      <span
        aria-hidden
        style={stijl}
        className="inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-slate-500 to-slate-700 font-bold text-white"
      >
        <span style={{ fontSize: Math.round(grootte * 0.42) }}>{naam.charAt(0)}</span>
      </span>
    );
  }

  return (
    <span
      style={{ ...stijl, padding: rand }}
      className="inline-flex shrink-0 items-center justify-center bg-white shadow-sm ring-1 ring-slate-200/80"
    >
      <Image
        src={logo}
        alt={`${naam} logo`}
        width={grootte - rand * 2}
        height={grootte - rand * 2}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

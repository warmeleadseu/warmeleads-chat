'use client';

import { colorForAdmin, initialsForName } from '../_lib/admin-color';

interface Props {
  id: string | null | undefined;
  name: string | null | undefined;
  avatarUrl?: string | null;
  /** Pixel-grootte van de cirkel; default 18 voor kleine event-pillen. */
  size?: number;
  /** Witte ring rond de cirkel. Handig op gekleurde achtergronden. */
  withWhiteRing?: boolean;
  /** Extra ring in de AM-kleur — handig wanneer de avatar een foto is en
   *  de AM-kleur dus niet uit de achtergrond af te leiden valt. */
  withAmRing?: boolean;
  /** Toon de naam als tooltip. Aan tenzij expliciet false. */
  withTitle?: boolean;
  className?: string;
}

/**
 * Avatar voor een admin/AM. Toont de profielfoto als die beschikbaar is,
 * anders een gekleurde cirkel met initialen. De kleur is een deterministische
 * hash van het admin-id zodat dezelfde gebruiker altijd dezelfde kleur heeft.
 */
export function AdminAvatar({
  id,
  name,
  avatarUrl,
  size = 18,
  withWhiteRing = false,
  withAmRing = false,
  withTitle = true,
  className,
}: Props) {
  const color = colorForAdmin(id);
  const initials = initialsForName(name);
  const fontSize = Math.max(8, Math.round(size * 0.42));
  const whitePx = withWhiteRing ? 1.5 : 0;
  const amPx = withAmRing ? 2 : 0;
  const titleAttr = withTitle ? name || 'Onbekend' : undefined;
  const dim = size + whitePx * 2;
  // box-shadow telt niet mee in de layout, dus combineren we de witte ring
  // (binnen) met een eventuele AM-kleur ring (buiten).
  let boxShadow: string | undefined;
  if (withWhiteRing && withAmRing) {
    boxShadow = `0 0 0 ${whitePx}px #ffffff, 0 0 0 ${whitePx + amPx}px ${color.bg}`;
  } else if (withWhiteRing) {
    boxShadow = `0 0 0 ${whitePx}px #ffffff`;
  } else if (withAmRing) {
    boxShadow = `0 0 0 ${amPx}px ${color.bg}`;
  }

  if (avatarUrl) {
    return (
      <span
        title={titleAttr}
        className={`inline-block shrink-0 overflow-hidden rounded-full ${className || ''}`}
        style={{
          width: dim,
          height: dim,
          boxShadow,
          backgroundColor: color.bg,
        }}
      >
        <img
          src={avatarUrl}
          alt={name || ''}
          width={size}
          height={size}
          className="block h-full w-full object-cover"
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span
      title={titleAttr}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className || ''}`}
      style={{
        width: dim,
        height: dim,
        backgroundColor: color.bg,
        fontSize,
        lineHeight: 1,
        boxShadow,
      }}
    >
      {initials}
    </span>
  );
}

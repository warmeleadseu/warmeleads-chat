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
  withTitle = true,
  className,
}: Props) {
  const color = colorForAdmin(id);
  const initials = initialsForName(name);
  const fontSize = Math.max(8, Math.round(size * 0.42));
  const ringPx = withWhiteRing ? 1.5 : 0;
  const titleAttr = withTitle ? name || 'Onbekend' : undefined;
  const dim = size + ringPx * 2;

  if (avatarUrl) {
    return (
      <span
        title={titleAttr}
        className={`inline-block shrink-0 overflow-hidden rounded-full ${className || ''}`}
        style={{
          width: dim,
          height: dim,
          boxShadow: withWhiteRing ? '0 0 0 1.5px #ffffff' : undefined,
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
        boxShadow: withWhiteRing ? '0 0 0 1.5px #ffffff' : undefined,
      }}
    >
      {initials}
    </span>
  );
}

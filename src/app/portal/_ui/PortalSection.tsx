import { ReactNode } from 'react';
import { T } from './tokens';

interface PortalSectionProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bare?: boolean;
}

/**
 * Standaard sectie-container voor het portaal.
 * Standaard een witte kaart (`rounded-2xl border shadow-sm p-4 sm:p-5`);
 * zet `bare` als je enkel de header wilt zonder kaart-omhulsel.
 */
export function PortalSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
  bare = false,
}: PortalSectionProps) {
  const wrapperClass = bare ? className : `${T.card} ${T.cardPadding} ${className}`.trim();
  const hasHeader = eyebrow || title || description || action;

  return (
    <section className={wrapperClass}>
      {hasHeader && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className={`${T.eyebrow} mb-1`}>{eyebrow}</p>}
            {title && <h2 className={T.sectionHeading}>{title}</h2>}
            {description && <p className={T.sectionDescription}>{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

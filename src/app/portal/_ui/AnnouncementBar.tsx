import { ReactNode } from 'react';

type Variant = 'demo' | 'admin' | 'info';

interface AnnouncementBarProps {
  variant: Variant;
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}

const VARIANT_BG: Record<Variant, string> = {
  demo: 'bg-gradient-to-r from-brand-purple via-brand-pink to-brand-orange text-white',
  admin: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
  info: 'bg-brand-purple/5 text-brand-purple/80 border-b border-brand-purple/10',
};

/**
 * Uniforme topbar voor demo/admin/info statussen.
 * Zelfde hoogte en padding voor elke variant, veilig stapelbaar.
 */
export function AnnouncementBar({ variant, icon, children, action }: AnnouncementBarProps) {
  return (
    <div className={VARIANT_BG[variant]}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="truncate">{children}</span>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

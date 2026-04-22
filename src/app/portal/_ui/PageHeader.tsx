import { ReactNode } from 'react';
import { T } from './tokens';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className={T.pageTitle}>{title}</h1>
        {subtitle && <p className={T.pageSubtitle}>{subtitle}</p>}
      </div>
      {action && <div className="self-start sm:self-auto">{action}</div>}
    </div>
  );
}

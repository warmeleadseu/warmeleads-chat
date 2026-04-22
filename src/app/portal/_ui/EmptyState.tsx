import { ComponentType, ReactNode, SVGProps } from 'react';

interface EmptyStateProps {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body?: ReactNode;
  cta?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, body, cta, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center ${className}`.trim()}>
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-purple/10">
          <Icon className="h-6 w-6 text-brand-purple" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{body}</p>}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

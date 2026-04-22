import { getStatusStyle, StatusScope } from './status';
import { T } from './tokens';

interface StatusBadgeProps {
  status: string;
  scope: StatusScope;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, scope, label, className = '' }: StatusBadgeProps) {
  const style = getStatusStyle(scope, status);
  return (
    <span className={`${T.badgeBase} ${style.cls} ${className}`.trim()}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {label ?? style.text}
    </span>
  );
}

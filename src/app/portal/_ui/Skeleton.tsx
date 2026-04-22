interface SkeletonCardsProps {
  count?: number;
  height?: string;
}

function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`.trim()} />;
}

function Cards({ count = 3, height = 'h-40' }: SkeletonCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${height} animate-pulse rounded-2xl border border-slate-200 bg-white`} />
      ))}
    </div>
  );
}

function List({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ))}
    </div>
  );
}

function Page() {
  return (
    <div className="space-y-5">
      <Bar className="h-7 w-48" />
      <Bar className="h-4 w-64" />
      <Cards count={3} />
    </div>
  );
}

export const Skeleton = { Bar, Cards, List, Page };

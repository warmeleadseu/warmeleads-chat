export default function AdminLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-brand-purple/30 border-t-brand-purple" />
        <p className="text-sm font-medium">Admin laden…</p>
      </div>
    </div>
  );
}

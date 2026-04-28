'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

/**
 * Diepe link `/admin/prospects/<id>` opent de drawer op de hoofdpagina via
 * de `?id=` query-parameter. Op mobiel gedraagt de drawer zich als
 * full-screen detail.
 */
export default function ProspectDetailRedirect() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  useEffect(() => {
    if (!params?.id) {
      router.replace('/admin/prospects');
      return;
    }
    router.replace(`/admin/prospects?id=${encodeURIComponent(params.id)}`);
  }, [params, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
      Bezig met laden…
    </div>
  );
}

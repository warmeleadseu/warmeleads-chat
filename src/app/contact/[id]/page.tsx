import { Suspense } from 'react';
import ContactClient from './ContactClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contact · Warme Leads', robots: { index: false, follow: false } };

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Laden...</div>}>
      <ContactClient id={id} />
    </Suspense>
  );
}

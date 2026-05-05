'use client';

import { useState } from 'react';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { ComposeMailDrawer } from './ComposeMailDrawer';

/**
 * Globale "Mail opstellen"-knop. Mount één keer in de admin-layout. Opent
 * de ComposeMailDrawer met een lege ontvangerlijst zodat de gebruiker zelf
 * prospects/klanten kan opzoeken en toevoegen.
 */
export function GlobalComposeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.1]"
        title="Stuur een mail aan een prospect of klant"
      >
        <EnvelopeIcon className="h-4 w-4" />
        Mail opstellen
      </button>
      <ComposeMailDrawer
        open={open}
        onClose={() => setOpen(false)}
        initialRecipients={[]}
      />
    </>
  );
}

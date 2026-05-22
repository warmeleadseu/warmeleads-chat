'use client';

import { LockClosedIcon } from '@heroicons/react/24/outline';
import { PortalSection } from '../_ui';
import { CrmIntegrationHub } from '../integrations/CrmIntegrationHub';

export function IntegrationsTab({
  isOwner,
  showToast,
  oauthHint,
  oauthReason,
  sheetsOauthHint,
  sheetsOauthReason,
}: {
  isOwner: boolean;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  oauthHint?: string | null;
  oauthReason?: string | null;
  sheetsOauthHint?: string | null;
  sheetsOauthReason?: string | null;
}) {
  if (!isOwner) {
    return (
      <PortalSection
        title="Geen toegang"
        description="Alleen de accounteigenaar kan integraties beheren en koppelen."
      >
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <LockClosedIcon className="h-6 w-6 text-slate-400" />
          </div>
          <p className="max-w-sm text-sm text-slate-600">
            Vraag de eigenaar van dit account om Teamleader of andere koppelingen in te stellen.
          </p>
        </div>
      </PortalSection>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Koppel externe systemen om leads automatisch door te sturen naar je eigen workflow.
      </p>
      <CrmIntegrationHub
        showToast={showToast}
        oauthHint={oauthHint}
        oauthReason={oauthReason}
        sheetsOauthHint={sheetsOauthHint}
        sheetsOauthReason={sheetsOauthReason}
      />
    </div>
  );
}

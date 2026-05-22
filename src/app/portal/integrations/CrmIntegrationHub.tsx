'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { portalFetch } from '@/lib/portalAuth';
import { PortalSection, T } from '../_ui';
import {
  CheckCircleIcon,
  ChevronRightIcon,
  PuzzlePieceIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  CRM_PROVIDERS,
  getCrmProvider,
  type CrmProviderId,
} from '@/lib/integrations/crmProviders';
import { TeamleaderIntegration } from './TeamleaderIntegration';

type PreferencesResponse = {
  preferred_crm_provider: string | null;
  connections: {
    teamleader: { connected: boolean; configured: boolean };
  };
};

export function CrmIntegrationHub({
  showToast,
  oauthHint,
  oauthReason,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void;
  oauthHint?: string | null;
  oauthReason?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [savingChoice, setSavingChoice] = useState(false);
  const [prefs, setPrefs] = useState<PreferencesResponse | null>(null);
  const [selectedId, setSelectedId] = useState<CrmProviderId | ''>('');
  const [confirmedId, setConfirmedId] = useState<CrmProviderId | ''>('');
  const [teamleaderConnected, setTeamleaderConnected] = useState(false);

  const loadPrefs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await portalFetch('/api/portal/integrations/preferences');
      if (res.ok) {
        const d = (await res.json()) as PreferencesResponse;
        setPrefs(d);
        setTeamleaderConnected(d.connections.teamleader.connected);
        const preferred = (d.preferred_crm_provider as CrmProviderId) || '';
        if (preferred) {
          setSelectedId(preferred);
          setConfirmedId(preferred);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  useEffect(() => {
    if (oauthHint === 'connected') {
      setTeamleaderConnected(true);
      setSelectedId('teamleader');
      setConfirmedId('teamleader');
    }
  }, [oauthHint]);

  const selectedProvider = getCrmProvider(selectedId);
  const confirmedProvider = getCrmProvider(confirmedId);
  const showProviderSetup = Boolean(confirmedId && confirmedProvider?.status === 'available');

  const statusBadge = useMemo(() => {
    if (teamleaderConnected) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {confirmedProvider?.shortName ?? 'CRM'} gekoppeld
        </span>
      );
    }
    if (confirmedId && !teamleaderConnected) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">
          Setup bezig
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
        Niet gekoppeld
      </span>
    );
  }, [teamleaderConnected, confirmedId, confirmedProvider?.shortName]);

  const confirmProvider = async () => {
    if (!selectedId) {
      showToast('Kies eerst een CRM-systeem', 'error');
      return;
    }
    const provider = getCrmProvider(selectedId);
    if (!provider || provider.status !== 'available') {
      showToast('Dit CRM is nog niet beschikbaar', 'error');
      return;
    }
    if (confirmedId === selectedId) return;

    setSavingChoice(true);
    try {
      const res = await portalFetch('/api/portal/integrations/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_crm_provider: selectedId }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirmedId(selectedId);
        showToast(`${provider.name} geselecteerd`);
      } else {
        showToast(d.error || 'Opslaan mislukt', 'error');
      }
    } finally {
      setSavingChoice(false);
    }
  };

  const changeProvider = () => {
    if (teamleaderConnected) {
      if (
        !confirm(
          'Je bent nog gekoppeld met Teamleader. Ontkoppel eerst via de instellingen hieronder, of wijzig alleen je voorkeur voor een toekomstige koppeling.',
        )
      ) {
        return;
      }
    }
    setConfirmedId('');
  };

  if (loading) {
    return (
      <PortalSection
        eyebrow="CRM-koppeling"
        title="Extern CRM koppelen"
        description="Kies je CRM-systeem en stuur toegewezen leads automatisch door."
      >
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-32 animate-pulse rounded-xl bg-slate-50" />
        </div>
      </PortalSection>
    );
  }

  return (
    <PortalSection
      eyebrow="CRM-koppeling"
      title="Extern CRM koppelen"
      description="Kies het CRM waarmee je wilt koppelen. Toegewezen leads worden automatisch doorgestuurd zodra de koppeling actief is."
      action={statusBadge}
    >
      {/* Stap 1 — CRM kiezen */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              confirmedId ? 'bg-emerald-500 text-white' : 'bg-brand-purple text-white'
            }`}
          >
            {confirmedId ? <CheckCircleIcon className="h-4 w-4" /> : '1'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Stap 1 — Kies je CRM-systeem</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Selecteer het systeem waarmee je leads wilt synchroniseren.
            </p>
          </div>
          {confirmedId && !teamleaderConnected && (
            <button
              type="button"
              onClick={changeProvider}
              className="shrink-0 text-xs font-medium text-slate-500 hover:text-brand-purple"
            >
              Wijzigen
            </button>
          )}
        </div>

        {confirmedId && confirmedProvider ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3">
            <ProviderIcon id={confirmedId} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{confirmedProvider.name}</p>
              <p className="text-xs text-slate-500">{confirmedProvider.setupHint}</p>
            </div>
            {teamleaderConnected && (
              <span className="shrink-0 text-xs font-medium text-emerald-600">Gekoppeld</span>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="crm-provider" className="mb-1.5 block text-xs font-medium text-slate-700">
                CRM-systeem
              </label>
              <select
                id="crm-provider"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value as CrmProviderId | '')}
                className={T.input}
              >
                <option value="">— Selecteer een CRM —</option>
                {CRM_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.status !== 'available'}>
                    {p.name}
                    {p.status === 'coming_soon' ? ' (binnenkort)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedProvider && selectedProvider.status === 'coming_soon' && (
              <ComingSoonCard provider={selectedProvider} />
            )}

            {selectedProvider && selectedProvider.status === 'available' && (
              <p className="text-xs text-slate-500">{selectedProvider.description}</p>
            )}

            <button
              type="button"
              onClick={() => void confirmProvider()}
              disabled={
                savingChoice ||
                !selectedId ||
                selectedProvider?.status !== 'available' ||
                selectedId === confirmedId
              }
              className={`${T.btnPrimary} w-full sm:w-auto`}
            >
              {savingChoice ? 'Bezig…' : 'Doorgaan met dit CRM'}
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Provider-specifieke setup */}
      {showProviderSetup && confirmedId === 'teamleader' && (
        <div className="mt-6 border-t border-slate-100 pt-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
              2
            </span>
            <p className="text-sm font-semibold text-slate-900">Teamleader Focus instellen</p>
          </div>
          <TeamleaderIntegration
            embedded
            showToast={showToast}
            oauthHint={oauthHint}
            oauthReason={oauthReason}
            onConnectionChange={(connected) => {
              setTeamleaderConnected(connected);
              if (connected) void loadPrefs();
            }}
          />
        </div>
      )}

      {showProviderSetup && confirmedId !== 'teamleader' && (
        <ComingSoonCard provider={confirmedProvider!} className="mt-6" />
      )}

      {!confirmedId && !loading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <PuzzlePieceIcon className="h-4 w-4 shrink-0" />
          Meer CRM-systemen volgen binnenkort. Heb je een specifieke wens? Neem contact op met je accountmanager.
        </p>
      )}
    </PortalSection>
  );
}

function ProviderIcon({ id }: { id: string }) {
  const colors: Record<string, string> = {
    teamleader: 'bg-[#00B4B4]/15 text-[#008989]',
    hubspot: 'bg-[#FF7A59]/15 text-[#E85D3A]',
    pipedrive: 'bg-[#017737]/15 text-[#015C2C]',
    salesforce: 'bg-[#00A1E0]/15 text-[#0070A8]',
  };
  const provider = getCrmProvider(id);
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${colors[id] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {provider?.shortName.slice(0, 2).toUpperCase() ?? 'CRM'}
    </div>
  );
}

function ComingSoonCard({
  provider,
  className = '',
}: {
  provider: { name: string; description: string };
  className?: string;
}) {
  return (
    <div
      className={`flex gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 ${className}`}
    >
      <SparklesIcon className="h-5 w-5 shrink-0 text-brand-purple/70" />
      <div>
        <p className="text-sm font-medium text-slate-800">{provider.name} komt binnenkort</p>
        <p className="mt-0.5 text-xs text-slate-500">
          We werken aan ondersteuning voor {provider.name}. {provider.description}
        </p>
      </div>
    </div>
  );
}

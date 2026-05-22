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
import { GoogleSheetsIntegration } from './GoogleSheetsIntegration';

type PreferencesResponse = {
  preferred_crm_provider: string | null;
  connections: {
    teamleader: { connected: boolean; configured: boolean };
    google_sheets: { connected: boolean; configured: boolean };
  };
};

export function CrmIntegrationHub({
  showToast,
  oauthHint,
  oauthReason,
  sheetsOauthHint,
  sheetsOauthReason,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void;
  oauthHint?: string | null;
  oauthReason?: string | null;
  sheetsOauthHint?: string | null;
  sheetsOauthReason?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [savingChoice, setSavingChoice] = useState(false);
  const [selectedId, setSelectedId] = useState<CrmProviderId | ''>('');
  const [confirmedId, setConfirmedId] = useState<CrmProviderId | ''>('');
  const [teamleaderConnected, setTeamleaderConnected] = useState(false);
  const [sheetsConnected, setSheetsConnected] = useState(false);
  const [sheetsSyncReady, setSheetsSyncReady] = useState(false);

  const loadPrefs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await portalFetch('/api/portal/integrations/preferences');
      if (res.ok) {
        const d = (await res.json()) as PreferencesResponse;
        setTeamleaderConnected(d.connections.teamleader.connected);
        setSheetsConnected(d.connections.google_sheets.connected);
        setSheetsSyncReady(d.connections.google_sheets.configured);
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

  useEffect(() => {
    if (sheetsOauthHint === 'connected') {
      setSheetsConnected(true);
      setSelectedId('google_sheets');
      setConfirmedId('google_sheets');
    }
  }, [sheetsOauthHint]);

  const selectedProvider = getCrmProvider(selectedId);
  const confirmedProvider = getCrmProvider(confirmedId);
  const showProviderSetup = Boolean(confirmedId && confirmedProvider?.status === 'available');

  const isFullyConnected =
    (confirmedId === 'teamleader' && teamleaderConnected) ||
    (confirmedId === 'google_sheets' && sheetsConnected && sheetsSyncReady);

  const statusBadge = useMemo(() => {
    if (isFullyConnected) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {confirmedProvider?.shortName ?? 'Integratie'} actief
        </span>
      );
    }
    if (confirmedId && (teamleaderConnected || sheetsConnected)) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">
          Setup bezig
        </span>
      );
    }
    if (confirmedId) {
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
  }, [isFullyConnected, confirmedId, confirmedProvider?.shortName, teamleaderConnected, sheetsConnected]);

  const confirmProvider = async () => {
    if (!selectedId) {
      showToast('Kies eerst een systeem', 'error');
      return;
    }
    const provider = getCrmProvider(selectedId);
    if (!provider || provider.status !== 'available') {
      showToast('Deze integratie is nog niet beschikbaar', 'error');
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
    const hasLiveConnection =
      (teamleaderConnected && confirmedId === 'teamleader') ||
      (sheetsConnected && confirmedId === 'google_sheets');
    if (hasLiveConnection) {
      if (
        !confirm(
          'Je bent nog gekoppeld. Ontkoppel eerst via de instellingen hieronder voordat je van systeem wisselt.',
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
        eyebrow="Integratie"
        title="Extern systeem koppelen"
        description="Koppel Teamleader, Google Spreadsheets of andere tools om leads automatisch door te sturen."
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
      eyebrow="Integratie"
      title="Extern systeem koppelen"
      description="Kies een koppeling en stuur toegewezen leads automatisch door naar je eigen workflow."
      action={statusBadge}
    >
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
            <p className="text-sm font-semibold text-slate-900">Stap 1 — Kies je koppeling</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Teamleader, Google Spreadsheets of later andere CRM-systemen.
            </p>
          </div>
          {confirmedId && !isFullyConnected && (
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
            {isFullyConnected && (
              <span className="shrink-0 text-xs font-medium text-emerald-600">Actief</span>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="crm-provider" className="mb-1.5 block text-xs font-medium text-slate-700">
                Systeem
              </label>
              <select
                id="crm-provider"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value as CrmProviderId | '')}
                className={T.input}
              >
                <option value="">— Selecteer een koppeling —</option>
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
              {savingChoice ? 'Bezig…' : 'Doorgaan met deze koppeling'}
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

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

      {showProviderSetup && confirmedId === 'google_sheets' && (
        <div className="mt-6 border-t border-slate-100 pt-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
              2
            </span>
            <p className="text-sm font-semibold text-slate-900">Google Spreadsheets instellen</p>
          </div>
          <GoogleSheetsIntegration
            embedded
            showToast={showToast}
            oauthHint={sheetsOauthHint}
            oauthReason={sheetsOauthReason}
            onConnectionChange={(connected) => {
              setSheetsConnected(connected);
              if (connected) void loadPrefs();
            }}
          />
        </div>
      )}

      {showProviderSetup &&
        confirmedId !== 'teamleader' &&
        confirmedId !== 'google_sheets' && (
          <ComingSoonCard provider={confirmedProvider!} className="mt-6" />
        )}

      {!confirmedId && !loading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <PuzzlePieceIcon className="h-4 w-4 shrink-0" />
          Meer koppelingen volgen binnenkort. Vragen? Neem contact op met je accountmanager.
        </p>
      )}
    </PortalSection>
  );
}

function ProviderIcon({ id }: { id: string }) {
  const colors: Record<string, string> = {
    teamleader: 'bg-[#00B4B4]/15 text-[#008989]',
    google_sheets: 'bg-[#34A853]/15 text-[#188038]',
    hubspot: 'bg-[#FF7A59]/15 text-[#E85D3A]',
    pipedrive: 'bg-[#017737]/15 text-[#015C2C]',
    salesforce: 'bg-[#00A1E0]/15 text-[#0070A8]',
  };
  const provider = getCrmProvider(id);
  const label =
    id === 'google_sheets' ? 'GS' : (provider?.shortName.slice(0, 2).toUpperCase() ?? '—');
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${colors[id] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {label}
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

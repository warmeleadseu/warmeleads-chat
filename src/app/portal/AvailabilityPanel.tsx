'use client';

import { useState, useEffect, useCallback } from 'react';
import { portalFetch } from '@/lib/portalAuth';
import { PlusIcon, TrashIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

interface AvailabilityRow {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface AvailabilityOverride {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  type: 'blocked' | 'extra';
  reason: string | null;
}

const DAY_LABELS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const DAY_SHORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

export default function AvailabilityPanel({
  portalUserId = null,
  canEdit = true,
  title = 'Beschikbaarheid',
  subtitle = 'Stel je werkdagen en tijden in. Afspraken kunnen alleen in deze slots geboekt worden.',
}: {
  portalUserId?: string | null;
  canEdit?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [rows, setRows] = useState<AvailabilityRow[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [newOverrideDate, setNewOverrideDate] = useState('');
  const [newOverrideType, setNewOverrideType] = useState<'blocked' | 'extra'>('blocked');
  const [newOverrideStart, setNewOverrideStart] = useState('09:00');
  const [newOverrideEnd, setNewOverrideEnd] = useState('17:00');
  const [newOverrideReason, setNewOverrideReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = portalUserId ? `?portal_user_id=${portalUserId}` : '';
      const [availRes, ovRes] = await Promise.all([
        portalFetch(`/api/portal/availability${params}`),
        portalFetch(`/api/portal/availability/overrides${params}`),
      ]);
      if (availRes.ok) {
        const data = await availRes.json();
        setRows((data.availability || []).map((r: AvailabilityRow) => ({
          id: r.id,
          day_of_week: r.day_of_week,
          start_time: r.start_time.slice(0, 5),
          end_time: r.end_time.slice(0, 5),
          is_active: r.is_active,
        })));
      }
      if (ovRes.ok) {
        const data = await ovRes.json();
        setOverrides(data.overrides || []);
      }
    } finally {
      setLoading(false);
    }
  }, [portalUserId]);

  useEffect(() => { load(); }, [load]);

  const addRow = (day: number) => {
    setRows(prev => [...prev, { day_of_week: day, start_time: '09:00', end_time: '17:00', is_active: true }]);
  };

  const updateRow = (idx: number, patch: Partial<AvailabilityRow>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await portalFetch('/api/portal/availability', {
        method: 'PUT',
        body: JSON.stringify({ portal_user_id: portalUserId, rows }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Opslaan mislukt');
      }
      setMsg({ type: 'ok', text: 'Beschikbaarheid opgeslagen' });
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Fout' });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  const addOverride = async () => {
    if (!newOverrideDate) return;
    setSaving(true);
    try {
      const res = await portalFetch('/api/portal/availability/overrides', {
        method: 'POST',
        body: JSON.stringify({
          portal_user_id: portalUserId,
          date: newOverrideDate,
          type: newOverrideType,
          start_time: newOverrideType === 'extra' ? newOverrideStart : null,
          end_time: newOverrideType === 'extra' ? newOverrideEnd : null,
          reason: newOverrideReason || null,
        }),
      });
      if (res.ok) {
        setNewOverrideDate('');
        setNewOverrideReason('');
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async (id: string) => {
    const res = await portalFetch('/api/portal/availability/overrides', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    if (res.ok) await load();
  };

  const rowsByDay = (day: number) => rows.map((r, idx) => ({ r, idx })).filter(x => x.r.day_of_week === day);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-3 py-2 text-xs font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-sm text-slate-400">Laden...</div>
      ) : (
        <>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const dayRows = rowsByDay(day);
              return (
                <div key={day} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-10 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold uppercase text-slate-600">
                        {DAY_SHORT[day]}
                      </div>
                      <div className="text-sm font-semibold text-slate-800">{DAY_LABELS[day]}</div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => addRow(day)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Slot
                      </button>
                    )}
                  </div>
                  {dayRows.length === 0 ? (
                    <p className="mt-2 text-xs italic text-slate-400">Gesloten</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {dayRows.map(({ r, idx }) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={r.start_time}
                            onChange={e => updateRow(idx, { start_time: e.target.value })}
                            disabled={!canEdit}
                            className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50 disabled:bg-slate-50"
                          />
                          <span className="text-xs text-slate-400">tot</span>
                          <input
                            type="time"
                            value={r.end_time}
                            onChange={e => updateRow(idx, { end_time: e.target.value })}
                            disabled={!canEdit}
                            className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50 disabled:bg-slate-50"
                          />
                          {canEdit && (
                            <button
                              onClick={() => removeRow(idx)}
                              className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-purple/90 disabled:opacity-60"
              >
                {saving ? 'Opslaan...' : 'Wekelijks schema opslaan'}
              </button>
            </div>
          )}

          {/* Overrides */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="h-4 w-4 text-brand-purple" />
              <h4 className="text-sm font-bold text-slate-900">Uitzonderingen</h4>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Vakantie, extra beschikbaarheid of uitzonderlijke dagen.</p>

            {overrides.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {overrides.map(o => (
                  <div key={o.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${o.type === 'blocked' ? 'border-red-200 bg-red-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${o.type === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {o.type === 'blocked' ? 'Gesloten' : 'Extra'}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {new Date(o.date + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    {o.type === 'extra' && o.start_time && o.end_time && (
                      <span className="text-slate-600">{o.start_time.slice(0, 5)}–{o.end_time.slice(0, 5)}</span>
                    )}
                    {o.reason && <span className="text-slate-500">· {o.reason}</span>}
                    {canEdit && (
                      <button
                        onClick={() => removeOverride(o.id)}
                        className="ml-auto rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <div className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={newOverrideDate}
                    onChange={e => setNewOverrideDate(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple/50"
                  />
                  <select
                    value={newOverrideType}
                    onChange={e => setNewOverrideType(e.target.value as 'blocked' | 'extra')}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple/50"
                  >
                    <option value="blocked">Gesloten</option>
                    <option value="extra">Extra beschikbaar</option>
                  </select>
                </div>
                {newOverrideType === 'extra' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      value={newOverrideStart}
                      onChange={e => setNewOverrideStart(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple/50"
                    />
                    <input
                      type="time"
                      value={newOverrideEnd}
                      onChange={e => setNewOverrideEnd(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple/50"
                    />
                  </div>
                )}
                <input
                  type="text"
                  value={newOverrideReason}
                  onChange={e => setNewOverrideReason(e.target.value)}
                  placeholder="Reden (optioneel)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple/50"
                />
                <button
                  onClick={addOverride}
                  disabled={!newOverrideDate || saving}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Toevoegen
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useMemo, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { ClockIcon, UserIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import {
  PROSPECT_STATUSES,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
  type ProspectStatus,
} from '@/lib/prospects';
import { ProspectTypeBadge } from './ProspectTypeBadge';

export interface KanbanProspect {
  id: string;
  company_name: string;
  city: string | null;
  status: ProspectStatus;
  account_manager_id: string | null;
  contact_person: string | null;
  next_action_at: string | null;
  open_task_count?: number;
  branches?: string[] | null;
  source?: string | null;
  source_metadata?: Record<string, unknown> | null;
  updated_at: string;
}

interface Props {
  prospects: KanbanProspect[];
  amNames: Record<string, string>;
  branchNames?: Record<string, string>;
  onMove: (id: string, status: ProspectStatus, lostReason?: string) => Promise<void> | void;
  onOpen: (id: string) => void;
  canDrag: boolean;
}

export function ProspectsKanban({ prospects, amNames, branchNames = {}, onMove, onOpen, canDrag }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<ProspectStatus, KanbanProspect[]>();
    for (const s of PROSPECT_STATUSES) map.set(s, []);
    for (const p of prospects) {
      map.get(p.status)?.push(p);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    }
    return map;
  }, [prospects]);

  const [pendingLost, setPendingLost] = useState<{ id: string } | null>(null);
  const [lostReason, setLostReason] = useState('');
  const pressRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const DRAG_THRESHOLD_PX = 5;
  const DRAG_THRESHOLD_MS = 250;

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const dest = destination.droppableId as ProspectStatus;
    if (!PROSPECT_STATUSES.includes(dest)) return;

    if (dest === 'verloren') {
      setPendingLost({ id: draggableId });
      setLostReason('');
      return;
    }

    await onMove(draggableId, dest);
  };

  const submitLost = async () => {
    if (!pendingLost || !lostReason.trim()) return;
    await onMove(pendingLost.id, 'verloren', lostReason.trim());
    setPendingLost(null);
    setLostReason('');
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {PROSPECT_STATUSES.map(status => {
            const items = grouped.get(status) || [];
            const c = PROSPECT_STATUS_COLORS[status];
            return (
              <div key={status} className="flex w-[min(85vw,18rem)] shrink-0 flex-col rounded-2xl bg-slate-100/70 p-2 sm:w-72">
                <div className={`mb-2 flex items-center justify-between rounded-xl px-3 py-2 ${c.bg} ${c.ring} ring-1 ring-inset`}>
                  <span className={`flex items-center gap-2 text-sm font-semibold ${c.text}`}>
                    <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
                    {PROSPECT_STATUS_LABELS[status]}
                  </span>
                  <span className={`text-xs font-bold ${c.text}`}>{items.length}</span>
                </div>
                <Droppable droppableId={status} isDropDisabled={!canDrag}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-1 flex-col gap-2 rounded-xl p-1 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-brand-purple/5' : ''
                      }`}
                    >
                      {items.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-[11px] text-slate-400">
                          Niets in deze kolom
                        </div>
                      ) : (
                        items.map((p, idx) => (
                          <Draggable key={p.id} draggableId={p.id} index={idx} isDragDisabled={!canDrag}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                onPointerDown={e => {
                                  pressRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
                                }}
                                onClick={e => {
                                  // Onderscheid drag van click op basis van afstand + duur,
                                  // zodat de drawer niet opent direct na een sleepbeweging.
                                  const start = pressRef.current;
                                  pressRef.current = null;
                                  if (start) {
                                    const dx = Math.abs(e.clientX - start.x);
                                    const dy = Math.abs(e.clientY - start.y);
                                    const dt = Date.now() - start.t;
                                    if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX || dt > DRAG_THRESHOLD_MS) {
                                      return;
                                    }
                                  }
                                  if (snap.isDragging) return;
                                  onOpen(p.id);
                                }}
                                className={`cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition-shadow ${
                                  snap.isDragging
                                    ? 'border-brand-purple/30 shadow-lg motion-reduce:shadow-sm'
                                    : 'border-slate-200 hover:border-brand-purple/30 hover:shadow-md motion-reduce:hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">{p.company_name}</p>
                                </div>
                                <div className="mt-1.5">
                                  <ProspectTypeBadge
                                    branches={p.branches}
                                    source={p.source}
                                    source_metadata={p.source_metadata}
                                    size="sm"
                                  />
                                </div>
                                {p.contact_person && (
                                  <p className="mt-1.5 text-xs text-slate-500">{p.contact_person}</p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                  {p.city && (
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.city}</span>
                                  )}
                                  {(p.branches || []).slice(0, 2).map(b => (
                                    <span
                                      key={b}
                                      className="inline-flex items-center gap-1 rounded bg-brand-purple/10 px-1.5 py-0.5 text-brand-purple"
                                    >
                                      <BriefcaseIcon className="h-3 w-3" />
                                      {branchNames[b] || b}
                                    </span>
                                  ))}
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                                  <span className="inline-flex min-w-0 flex-1 items-center gap-1">
                                    <UserIcon className="h-3 w-3 shrink-0" />
                                    <span className="min-w-0 truncate">
                                      {p.account_manager_id ? amNames[p.account_manager_id] || '...' : 'Niet toegewezen'}
                                    </span>
                                  </span>
                                  {p.next_action_at && (
                                    <span className="inline-flex shrink-0 items-center gap-1 text-amber-600">
                                      <ClockIcon className="h-3 w-3" />
                                      {new Date(p.next_action_at).toLocaleDateString('nl-NL', {
                                        day: 'numeric',
                                        month: 'short',
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {pendingLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Reden voor verloren</h3>
            <textarea
              value={lostReason}
              onChange={e => setLostReason(e.target.value)}
              rows={3}
              className="mt-3 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
              placeholder="Bv. te duur, andere leverancier gekozen..."
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLost(null)}
                className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={submitLost}
                disabled={!lostReason.trim()}
                className="min-h-[44px] rounded-lg bg-rose-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Markeer als verloren
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

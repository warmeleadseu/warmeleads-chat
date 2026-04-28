'use client';

import { useState } from 'react';
import {
  CheckCircleIcon,
  TrashIcon,
  PlusIcon,
  CalendarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

export interface Task {
  id: string;
  prospect_id: string;
  title: string;
  description: string | null;
  type: string;
  due_at: string | null;
  completed_at: string | null;
  assigned_to_admin_id: string | null;
  created_at: string;
}

function dueClass(dueAt: string | null, completed: boolean): { label: string; cls: string } {
  if (completed) return { label: 'Afgerond', cls: 'text-emerald-600' };
  if (!dueAt) return { label: 'Geen deadline', cls: 'text-slate-400' };
  const date = new Date(dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date < today) {
    const days = Math.floor((today.getTime() - date.getTime()) / 86400000);
    return { label: days === 0 ? 'Verlopen' : `${days} dag(en) verlopen`, cls: 'text-rose-600' };
  }
  if (date < tomorrow) return { label: 'Vandaag', cls: 'text-orange-600' };
  const diff = Math.floor((date.getTime() - today.getTime()) / 86400000);
  if (diff <= 7) return { label: `Over ${diff} dag(en)`, cls: 'text-amber-600' };
  return {
    label: date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
    cls: 'text-slate-500',
  };
}

interface Props {
  prospectId: string;
  tasks: Task[];
  onChange: (tasks: Task[]) => void;
}

export function TaskList({ prospectId, tasks, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [type, setType] = useState<'todo' | 'call' | 'email' | 'meeting' | 'followup'>('todo');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/prospects/${prospectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          type,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.task) {
        onChange([data.task, ...tasks]);
        setTitle('');
        setDueAt('');
        setAdding(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (t: Task) => {
    const next = tasks.map(x =>
      x.id === t.id ? { ...x, completed_at: t.completed_at ? null : new Date().toISOString() } : x,
    );
    onChange(next);
    const res = await adminFetch(`/api/admin/prospects/tasks/${t.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: !t.completed_at }),
    });
    if (!res.ok) {
      onChange(tasks);
    }
  };

  const remove = async (t: Task) => {
    if (!confirm(`Taak "${t.title}" verwijderen?`)) return;
    const previous = tasks;
    onChange(tasks.filter(x => x.id !== t.id));
    const res = await adminFetch(`/api/admin/prospects/tasks/${t.id}`, { method: 'DELETE' });
    if (!res.ok) {
      onChange(previous);
      alert('Verwijderen mislukt');
    }
  };

  return (
    <div className="space-y-3">
      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-500 hover:border-brand-purple/40 hover:text-brand-purple"
        >
          <PlusIcon className="h-4 w-4" />
          Taak toevoegen
        </button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Bv. 'Bel maandag voor offerte'"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={type}
                onChange={e => setType(e.target.value as typeof type)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
              >
                <option value="todo">To-do</option>
                <option value="call">Bellen</option>
                <option value="email">E-mailen</option>
                <option value="meeting">Afspraak</option>
                <option value="followup">Opvolgen</option>
              </select>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={e => setDueAt(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={create}
                disabled={saving || !title.trim()}
                className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-50"
              >
                Toevoegen
              </button>
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
          Geen openstaande taken.
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map(t => {
            const completed = !!t.completed_at;
            const due = dueClass(t.due_at, completed);
            return (
              <li
                key={t.id}
                className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${
                  completed ? 'border-slate-100 opacity-70' : 'border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(t)}
                  className={`mt-0.5 rounded-full ${
                    completed ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-500'
                  }`}
                  aria-label={completed ? 'Markeer als open' : 'Afronden'}
                >
                  <CheckCircleIcon className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      completed ? 'text-slate-400 line-through' : 'text-slate-800'
                    }`}
                  >
                    {t.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px]">
                    <span className={`inline-flex items-center gap-1 ${due.cls}`}>
                      {t.due_at ? <ClockIcon className="h-3 w-3" /> : <CalendarIcon className="h-3 w-3" />}
                      {due.label}
                    </span>
                    <span className="text-slate-400">{t.type}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(t)}
                  className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                  aria-label="Verwijderen"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

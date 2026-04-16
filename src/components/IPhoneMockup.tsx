'use client';

import {
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  UserGroupIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

function WAIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const DEMO_LEADS = [
  { name: 'Jan de Vries', postcode: '3521 AL', plaats: 'Utrecht', branch: 'Zonnepanelen', branchBg: 'bg-emerald-50', branchText: 'text-emerald-600', status: 'Nieuw', statusBg: 'bg-blue-100', statusText: 'text-blue-700', date: '14 mrt' },
  { name: 'Petra Bakker', postcode: '1071 AB', plaats: 'Amsterdam', branch: 'Thuisbatterij', branchBg: 'bg-purple-50', branchText: 'text-purple-600', status: 'Gecontacteerd', statusBg: 'bg-amber-100', statusText: 'text-amber-700', date: '13 mrt' },
  { name: 'Mohammed El Amrani', postcode: '3011 TA', plaats: 'Rotterdam', branch: 'Warmtepomp', branchBg: 'bg-sky-50', branchText: 'text-sky-600', status: 'Offerte', statusBg: 'bg-purple-100', statusText: 'text-purple-700', date: '12 mrt' },
  { name: 'Lisa Jansen', postcode: '2511 VA', plaats: 'Den Haag', branch: 'Airco', branchBg: 'bg-amber-50', branchText: 'text-amber-600', status: 'Nieuw', statusBg: 'bg-blue-100', statusText: 'text-blue-700', date: '12 mrt' },
];

export function IPhoneMockup() {
  return (
    <div className="relative w-[240px] lg:w-[280px]" aria-hidden="true">
      <div className="pointer-events-none absolute -inset-10 rounded-[60px] bg-gradient-to-br from-brand-purple/30 via-brand-pink/15 to-brand-orange/20 blur-[60px]" />

      <div
        className="relative overflow-hidden rounded-[48px] border-[3.5px] border-[#2C2C2E] bg-[#1D1D1F] shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset,0_30px_60px_-10px_rgba(0,0,0,0.6)]"
        style={{ aspectRatio: '71.5 / 146.6' }}
      >
        <div className="absolute left-1/2 top-[10px] z-30 flex h-[22px] w-[84px] -translate-x-1/2 items-center justify-center rounded-full bg-black">
          <div className="h-[4px] w-[4px] rounded-full bg-[#3a3a3e]" />
        </div>

        <div className="relative m-[2px] flex h-[calc(100%-4px)] flex-col overflow-hidden rounded-[45px] bg-[#F8F9FA]">

          <div className="shrink-0 bg-white/95 px-5 pb-0.5 pt-[36px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-900">9:41</span>
              <div className="flex items-center gap-[3px]">
                <div className="flex items-end gap-[1px]">
                  {[3, 4.5, 6, 7.5].map((h, i) => (
                    <div key={i} className="w-[2px] rounded-[0.5px] bg-slate-900" style={{ height: h }} />
                  ))}
                </div>
                <svg className="ml-0.5 h-[9px] w-[11px]" fill="currentColor" viewBox="0 0 16 12">
                  <path d="M8 9.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-4-3a5.98 5.98 0 018 0 .75.75 0 01-1 1.12 4.48 4.48 0 00-6 0 .75.75 0 01-1-1.12zm-3-3c3.87-3.87 10.13-3.87 14 0a.75.75 0 01-1.06 1.06c-3.29-3.29-8.59-3.29-11.88 0A.75.75 0 011 3.5z" />
                </svg>
                <div className="ml-0.5 flex items-center">
                  <div className="h-[7px] w-[17px] rounded-[1.5px] border border-slate-900/80 p-[0.5px]">
                    <div className="h-full w-[80%] rounded-[0.5px] bg-slate-900" />
                  </div>
                  <div className="h-[3px] w-[1px] rounded-r-full bg-slate-900/80" />
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="h-[2px] bg-warmeleads-gradient" />
            <div className="flex items-center justify-between px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <div className="flex h-[16px] w-[16px] items-center justify-center rounded-md bg-gradient-to-br from-brand-purple to-brand-pink">
                  <span className="text-[6px] font-bold text-white">W</span>
                </div>
                <span className="text-[8px] font-bold text-slate-900">WarmeLeads</span>
              </div>
              <div className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-brand-purple/10 text-[6px] font-bold text-brand-purple">
                M
              </div>
            </div>
            <div className="flex border-t border-slate-100">
              <div className="flex-1 border-b-2 border-brand-purple px-2 py-1 text-center text-[7px] font-semibold text-brand-purple">Leads</div>
              <div className="flex-1 border-b-2 border-transparent px-2 py-1 text-center text-[7px] font-medium text-slate-400">Account</div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="animate-portal-scroll space-y-2 px-2.5 pb-8 pt-2.5">

              <div>
                <p className="text-[11px] font-bold text-slate-900">Welkom, Mark</p>
                <p className="text-[7px] text-slate-500">Je leadoverzicht voor SolarTech BV</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="rounded-full bg-brand-purple/10 px-1.5 py-[1px] text-[6px] font-semibold text-brand-purple">Zonnepanelen</span>
                    <span className="rounded-full bg-slate-100 px-1 py-[1px] text-[5px] font-medium text-slate-500">max 15/week</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-900">72%</span>
                </div>
                <div className="mb-1 h-[5px] overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-brand-purple to-brand-pink" />
                </div>
                <span className="text-[6px] font-medium text-slate-500">36 / 50 leads</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Totaal leads', value: '42', Icon: UserGroupIcon, color: 'text-brand-purple', bg: 'bg-brand-purple/10' },
                  { label: 'Nieuw deze week', value: '8', Icon: SparklesIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Gecontacteerd', value: '28', Icon: ArrowTrendingUpIcon, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Verkocht', value: '12', Icon: CheckCircleIcon, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
                    <div className={`flex h-[14px] w-[14px] items-center justify-center rounded-[3px] ${s.bg}`}>
                      <s.Icon className={`h-[9px] w-[9px] ${s.color}`} />
                    </div>
                    <p className="mt-0.5 text-[12px] font-bold leading-tight text-slate-900">{s.value}</p>
                    <p className="text-[6px] leading-tight text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-1.5">
                <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
                  <div className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] bg-brand-purple/10">
                    <ChartBarIcon className="h-[9px] w-[9px] text-brand-purple" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[5px] text-slate-500">Conversieratio</p>
                    <div className="mt-[1px] flex items-center gap-0.5">
                      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-[29%] rounded-full bg-gradient-to-r from-brand-purple to-brand-pink" />
                      </div>
                      <span className="text-[7px] font-bold text-slate-900">29%</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 items-center gap-1 rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-1.5 shadow-sm">
                  <div className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] bg-blue-100">
                    <SparklesIcon className="h-[9px] w-[9px] text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[6px] font-semibold text-slate-900">8 nieuwe</p>
                    <p className="text-[5px] text-slate-500">Bekijk leads</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="absolute left-1.5 top-1/2 h-[9px] w-[9px] -translate-y-1/2 text-slate-400" />
                  <div className="rounded-md border border-slate-200 bg-white py-[5px] pl-5 pr-2 text-[7px] text-slate-400">
                    Zoeken op naam, e-mail...
                  </div>
                </div>
                <div className="flex h-[22px] w-[22px] items-center justify-center rounded-md border border-slate-200 bg-white">
                  <FunnelIcon className="h-[9px] w-[9px] text-slate-400" />
                </div>
              </div>

              <p className="text-[6px] text-slate-500">42 leads gevonden</p>

              {DEMO_LEADS.map(lead => (
                <div key={lead.name} className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                  <div className="mb-1 flex items-start justify-between">
                    <div>
                      <p className="text-[9px] font-semibold text-slate-900">{lead.name}</p>
                      <p className="flex items-center gap-[2px] text-[6px] text-slate-500">
                        <MapPinIcon className="h-[7px] w-[7px]" />
                        {lead.postcode}, {lead.plaats}
                      </p>
                    </div>
                    <span className={`rounded-full px-1.5 py-[1px] text-[5px] font-medium ${lead.statusBg} ${lead.statusText}`}>
                      {lead.status}
                    </span>
                  </div>
                  <div className="mb-1.5 flex items-center gap-1 text-[6px] text-slate-500">
                    <span className={`rounded-full px-1.5 py-[1px] text-[5px] font-medium ${lead.branchBg} ${lead.branchText}`}>{lead.branch}</span>
                    <span className="flex items-center gap-[2px]">
                      <CalendarDaysIcon className="h-[7px] w-[7px]" />
                      {lead.date}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <div className="flex flex-1 items-center justify-center gap-[2px] rounded-md bg-emerald-50 py-[3px] text-[6px] font-medium text-emerald-700">
                      <PhoneIcon className="h-[8px] w-[8px]" /> Bellen
                    </div>
                    <div className="flex flex-1 items-center justify-center gap-[2px] rounded-md bg-green-50 py-[3px] text-[6px] font-medium text-green-700">
                      <WAIcon className="h-[8px] w-[8px]" /> WhatsApp
                    </div>
                    <div className="flex flex-1 items-center justify-center gap-[2px] rounded-md bg-blue-50 py-[3px] text-[6px] font-medium text-blue-700">
                      <EnvelopeIcon className="h-[8px] w-[8px]" /> E-mail
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-[4px] left-1/2 z-20 h-[3px] w-[70px] -translate-x-1/2 rounded-full bg-black/20" />
        </div>
      </div>
    </div>
  );
}

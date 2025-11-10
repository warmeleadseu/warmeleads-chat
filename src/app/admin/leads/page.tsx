'use client';

import React from 'react';

export default function AdminLeadsPage() {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-brand-navy mb-6">
          Leads Overzicht
        </h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 mb-4">
            Hier zie je alle gegenereerde leads per branche met volledige distributie geschiedenis.
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              ✨ Interface wordt binnenkort beschikbaar. De backend API is al klaar!
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Je kunt per lead zien:
            </p>
            <ul className="text-xs text-blue-600 mt-1 list-disc list-inside space-y-1">
              <li>Alle klanten die de lead hebben ontvangen</li>
              <li>Wanneer de lead is gedistribueerd</li>
              <li>Of het een verse of returning lead is</li>
              <li>Geografische match informatie</li>
              <li>Batch voortgang per klant</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

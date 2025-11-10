'use client';

import React from 'react';

export default function AdminBatchesPage() {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-brand-navy mb-6">
          Batch Beheer
        </h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            Hier beheer je alle actieve lead batches van klanten. Je kunt nieuwe batches aanmaken en bestaande batches beheren.
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              ✨ Interface wordt binnenkort beschikbaar. De backend API is al klaar!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


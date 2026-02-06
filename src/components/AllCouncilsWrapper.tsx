'use client';

import React from 'react';

export function AllCouncilsWrapper({ councils, children, label }: { councils: any[]; children: (council: any) => React.ReactNode; label?: string }) {
  return (
    <div className="space-y-8">
      {label && <div className="text-lg font-semibold text-gray-700 mb-2">{label}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {councils.map((council) => (
          <div key={council.id} className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="font-bold text-green-700 mb-2 truncate" title={council.name}>{council.name}</div>
            {council.description && <div className="text-xs text-gray-500 mb-2 truncate">{council.description}</div>}
            {children(council)}
          </div>
        ))}
      </div>
    </div>
  );
}

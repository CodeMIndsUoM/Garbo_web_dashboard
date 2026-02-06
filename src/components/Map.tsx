'use client';

import React from 'react';

export const Map: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      <div className="text-2xl font-semibold mb-4">Map View</div>
      <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">
        {/* Replace with actual map integration (e.g., Google Maps, Leaflet) */}
        <span className="text-gray-500">Map will be displayed here</span>
      </div>
    </div>
  );
};

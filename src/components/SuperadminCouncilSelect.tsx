'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Council {
  id: string;
  name: string;
  description?: string;
}

interface SuperadminCouncilSelectProps {
  councils: Council[];
  onSelect: (council: Council) => void;
}

export const SuperadminCouncilSelect: React.FC<SuperadminCouncilSelectProps> = ({ councils, onSelect }) => {
  return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
      {councils.map((council) => (
        <Card key={council.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onSelect(council)}>
          <CardHeader>
            <CardTitle>{council.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{council.description || 'No description'}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

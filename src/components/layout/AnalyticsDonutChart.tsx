'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CHART, type PieChartEntry } from './analytics-ui';

interface AnalyticsDonutChartProps {
  data: PieChartEntry[];
  centerLabel?: string;
  centerValue?: string | number;
  height?: number;
}

export function AnalyticsDonutChart({
  data,
  centerLabel,
  centerValue,
  height = 300,
}: AnalyticsDonutChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No data available
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={CHART.tooltipStyle}
            formatter={(value: number) => [value, 'Count']}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
      {centerValue !== undefined ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
          <p className="text-2xl font-semibold text-gray-900">{centerValue}</p>
          {centerLabel ? <p className="text-xs text-gray-500">{centerLabel}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

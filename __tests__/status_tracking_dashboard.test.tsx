import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../src/components/ui/card';

// Simple dashboard metrics display mock component
function BinCollectionMetrics({
  fullCount,
  emptyCount,
}: {
  fullCount: number;
  emptyCount: number;
}) {
  const needsAttention = fullCount > 5;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bin Status Tracking</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div>
            <span>Full Bins: </span>
            <span data-testid="full-count">{fullCount}</span>
          </div>
          <div>
            <span>Empty Bins: </span>
            <span data-testid="empty-count">{emptyCount}</span>
          </div>
        </div>
        {needsAttention && (
          <div className="text-red-500 font-bold mt-2">Action Required: High volume of full bins!</div>
        )}
      </CardContent>
    </Card>
  );
}

describe('BinCollectionMetrics Component Tests', () => {
  it('renders correct counts for full and empty bins', () => {
    render(<BinCollectionMetrics fullCount={3} emptyCount={15} />);

    expect(screen.getByText('Bin Status Tracking')).toBeInTheDocument();
    expect(screen.getByTestId('full-count').textContent).toBe('3');
    expect(screen.getByTestId('empty-count').textContent).toBe('15');
    expect(screen.queryByText('Action Required: High volume of full bins!')).not.toBeInTheDocument();
  });

  it('renders warning indicator when full count exceeds threshold', () => {
    render(<BinCollectionMetrics fullCount={8} emptyCount={10} />);

    expect(screen.getByTestId('full-count').textContent).toBe('8');
    expect(screen.getByText('Action Required: High volume of full bins!')).toBeInTheDocument();
  });
});

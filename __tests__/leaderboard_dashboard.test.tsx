import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
}

function LeaderboardWidget({ entries }: { entries: LeaderboardEntry[] }) {
  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div>
      <h3>Leaderboard Rankings</h3>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.rank}>
              <td>{getRankBadge(entry.rank)}</td>
              <td>{entry.name}</td>
              <td>{entry.points} pts</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

describe('LeaderboardWidget Component Tests', () => {
  it('correctly maps medals to top 3 ranks and displays names and points', () => {
    const mockEntries: LeaderboardEntry[] = [
      { rank: 1, name: 'Collector Alice', points: 500 },
      { rank: 2, name: 'Collector Bob', points: 400 },
      { rank: 3, name: 'Mentor Charlie', points: 300 },
      { rank: 4, name: 'Mentor Dave', points: 200 },
    ];

    render(<LeaderboardWidget entries={mockEntries} />);

    expect(screen.getByText('Leaderboard Rankings')).toBeInTheDocument();
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
    expect(screen.getByText('#4')).toBeInTheDocument();
    expect(screen.getByText('Collector Alice')).toBeInTheDocument();
    expect(screen.getByText('500 pts')).toBeInTheDocument();
  });
});

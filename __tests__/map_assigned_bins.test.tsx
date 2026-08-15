import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MapSidePanel } from '../src/components/map/MapSidePanel';

describe('MapSidePanel Component Tests', () => {
  it('renders children and title when open', () => {
    const handleClose = jest.fn();
    render(
      <MapSidePanel open={true} onClose={handleClose} title="Bin Details">
        <div>Assigned Bin #101</div>
      </MapSidePanel>
    );

    expect(screen.getByText('Bin Details')).toBeInTheDocument();
    expect(screen.getByText('Assigned Bin #101')).toBeInTheDocument();
  });

  it('triggers onClose when close button clicked', () => {
    const handleClose = jest.fn();
    render(
      <MapSidePanel open={true} onClose={handleClose} title="Bin Details">
        <div>Content</div>
      </MapSidePanel>
    );

    const closeBtn = screen.getByLabelText('Close panel');
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

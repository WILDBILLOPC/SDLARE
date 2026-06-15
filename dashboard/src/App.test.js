// Integration tests that drive the real <App /> through the DOM. These cover
// the React layer (navigation, the rearrangeable Totals view, the document
// inventory, and the tenant Send links) that the pure-logic suite in
// rentals.test.js can't reach.
import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import App from './App';
import { sampleProperties } from './rentals';

const RENTALS_KEY = 'sdlare.rentals.v1';

// Seed localStorage with the sample portfolio before the app mounts.
function seedSample() {
  window.localStorage.setItem(RENTALS_KEY, JSON.stringify(sampleProperties()));
}

beforeEach(() => {
  window.localStorage.clear();
});

// Switch to the Rentals tab, then to one of its lateral sub-tabs.
function gotoRentalSub(label) {
  fireEvent.click(screen.getAllByRole('button', { name: 'RENTALS' })[0]);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label, 'i') }));
}

describe('App shell', () => {
  it('renders the brand and defaults to the Overview tab', () => {
    render(<App />);
    expect(screen.getByText('SDLARE')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'OVERVIEW' }).length).toBeGreaterThan(0);
  });

  it('shows the empty state for properties when storage is empty', () => {
    render(<App />);
    gotoRentalSub('Properties');
    expect(screen.getByText('No Properties Yet')).toBeInTheDocument();
  });

  it('loads sample fixtures from Options', () => {
    render(<App />);
    gotoRentalSub('Options');
    fireEvent.click(screen.getByRole('button', { name: /load sample fixtures/i }));
    gotoRentalSub('Properties');
    expect(screen.getByText('Logan Heights Duplex')).toBeInTheDocument();
    expect(screen.getByText('Playas Condo')).toBeInTheDocument();
  });
});

describe('Totals & P&L — rearrangeable', () => {
  it('groups by building by default and can switch to a flat list', () => {
    seedSample();
    render(<App />);
    gotoRentalSub('Totals');
    // Default: grouped — the building group header is present.
    expect(screen.getByText(/BY BUILDING/i)).toBeInTheDocument();
    expect(screen.getByText('▸ San Diego')).toBeInTheDocument();

    // Switch grouping to None → flat per-property list, no group header.
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(screen.getByText(/^BY PROPERTY/i)).toBeInTheDocument();
    expect(screen.queryByText('▸ San Diego')).not.toBeInTheDocument();
  });

  it('persists the chosen sort to settings storage', () => {
    seedSample();
    render(<App />);
    gotoRentalSub('Totals');
    fireEvent.click(screen.getByRole('button', { name: 'Net' }));
    const settings = JSON.parse(window.localStorage.getItem('sdlare.settings.v1'));
    expect(settings.totalsSortBy).toBe('net');
  });
});

describe('Document inventory', () => {
  it('lists documents from across the portfolio', () => {
    seedSample();
    render(<App />);
    gotoRentalSub('Documents');
    expect(screen.getByText(/INVENTORY/i)).toBeInTheDocument();
    expect(screen.getByText('SDG&E electric')).toBeInTheDocument();
    expect(screen.getByText('Contrato Depto 3')).toBeInTheDocument();
  });

  it('adds a new document through the form', () => {
    seedSample();
    render(<App />);
    gotoRentalSub('Documents');
    fireEvent.click(screen.getByRole('button', { name: /add document/i }));
    const dialog = screen.getByText('Add Document').closest('.modal');
    fireEvent.change(within(dialog).getByPlaceholderText(/Unit A Lease 2025/i), { target: { value: 'Roof warranty' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));
    expect(screen.getByText('Roof warranty')).toBeInTheDocument();
  });
});

describe('Tenant Send links', () => {
  it('renders SMS, WhatsApp and email deep links for a tenant', () => {
    seedSample();
    render(<App />);
    gotoRentalSub('Properties');
    const sms = screen.getAllByRole('link', { name: /text/i })[0];
    const wa = screen.getAllByRole('link', { name: /whatsapp/i })[0];
    const email = screen.getAllByRole('link', { name: /email/i })[0];
    expect(sms).toHaveAttribute('href', expect.stringContaining('sms:'));
    expect(wa).toHaveAttribute('href', expect.stringContaining('https://wa.me/'));
    expect(email).toHaveAttribute('href', expect.stringContaining('mailto:'));
  });
});

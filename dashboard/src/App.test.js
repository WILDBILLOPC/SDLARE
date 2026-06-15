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

describe('Top-level tabs', () => {
  it('Overview shows the headline metric panels', () => {
    seedSample();
    render(<App />);
    expect(screen.getByText('PAYMENT STATUS')).toBeInTheDocument();
    expect(screen.getByText('OCCUPANCY')).toBeInTheDocument();
  });

  it('FX Engine renders the live-rates panel (fetch mocked)', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ rates: { MXN: 17.1, EUR: 0.9, GBP: 0.8, CAD: 1.3 } }) }));
    seedSample();
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'FX ENGINE' })[0]);
    expect(await screen.findByText(/LIVE FX RATES/i)).toBeInTheDocument();
    delete global.fetch;
  });

  it('Activity starts empty, then logs an action', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'ACTIVITY' })[0]);
    expect(screen.getByText('No Activity Yet')).toBeInTheDocument();
    // Load sample (an action that logs) and re-check.
    gotoRentalSub('Options');
    fireEvent.click(screen.getByRole('button', { name: /load sample fixtures/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'ACTIVITY' })[0]);
    expect(screen.queryByText('No Activity Yet')).not.toBeInTheDocument();
  });

  it('P&L tab shows the grand-total roll-up', () => {
    seedSample();
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'P&L' })[0]);
    expect(screen.getByText('GRAND TOTAL')).toBeInTheDocument();
    expect(screen.getByText('ANNUAL PROJECTION')).toBeInTheDocument();
  });
});

describe('Forms & mutations', () => {
  it('adds a property through the form', () => {
    render(<App />);
    gotoRentalSub('Properties');
    fireEvent.click(screen.getAllByRole('button', { name: /add property/i })[0]);
    const dialog = screen.getByText('Add Property').closest('.modal');
    fireEvent.change(within(dialog).getByPlaceholderText(/Logan Heights Duplex/i), { target: { value: 'Test Fourplex' } });
    fireEvent.change(within(dialog).getByPlaceholderText('San Diego'), { target: { value: 'Chula Vista' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));
    expect(screen.getByText('Test Fourplex')).toBeInTheDocument();
  });

  it('adds a unit with contact info, producing Send links', () => {
    seedSample();
    render(<App />);
    gotoRentalSub('Properties');
    fireEvent.click(screen.getAllByRole('button', { name: '+ Unit' })[0]);
    const dialog = screen.getByText('Add Unit').closest('.modal');
    fireEvent.change(within(dialog).getByPlaceholderText('Unit A'), { target: { value: 'Unit Z' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Ana García'), { target: { value: 'Zoe Test' } });
    fireEvent.change(within(dialog).getByPlaceholderText(/619 555 0101/i), { target: { value: '+15557654321' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));
    expect(screen.getByText('Zoe Test')).toBeInTheDocument();
    const waLinks = screen.getAllByRole('link', { name: /whatsapp/i });
    expect(waLinks.some((a) => a.getAttribute('href').includes('15557654321'))).toBe(true);
  });

  it('logs an expense and lists it in the itemized table', () => {
    seedSample();
    render(<App />);
    gotoRentalSub('Expenses');
    expect(screen.getByText(/BY CATEGORY/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
    const dialog = screen.getByText('Add Monthly Expense').closest('.modal');
    fireEvent.change(within(dialog).getByPlaceholderText(/Predial/i), { target: { value: 'Gardener test' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));
    expect(screen.getByText('Gardener test')).toBeInTheDocument();
  });

  it('adds, toggles and removes a property task', () => {
    seedSample();
    render(<App />);
    gotoRentalSub('Properties');
    const input = screen.getAllByPlaceholderText('Add a task…')[0];
    fireEvent.change(input, { target: { value: 'Fix the gate' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Fix the gate')).toBeInTheDocument();
  });
});

describe('Options', () => {
  it('persists a changed exchange rate on blur', () => {
    seedSample();
    render(<App />);
    gotoRentalSub('Options');
    const rate = screen.getByRole('spinbutton');
    fireEvent.change(rate, { target: { value: '18.5' } });
    fireEvent.blur(rate);
    expect(JSON.parse(window.localStorage.getItem('sdlare.settings.v1')).usdMxn).toBe(18.5);
  });

  it('changes the default input currency', () => {
    seedSample();
    render(<App />);
    gotoRentalSub('Options');
    fireEvent.click(screen.getByRole('button', { name: 'MXN' }));
    expect(JSON.parse(window.localStorage.getItem('sdlare.settings.v1')).defaultCurrency).toBe('MXN');
  });

  it('clears all data after confirmation', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    seedSample();
    render(<App />);
    gotoRentalSub('Options');
    fireEvent.click(screen.getByRole('button', { name: /clear all data/i }));
    gotoRentalSub('Properties');
    expect(screen.queryByText('Logan Heights Duplex')).not.toBeInTheDocument();
    expect(screen.getByText('No Properties Yet')).toBeInTheDocument();
    window.confirm.mockRestore();
  });
});

describe('Pop-out mode', () => {
  afterEach(() => { window.history.pushState({}, '', '/'); });

  it('renders a single chrome-free view from the ?popout query param', () => {
    seedSample();
    window.history.pushState({}, '', '/?popout=totals');
    render(<App />);
    expect(screen.getByText(/SDLARE · Totals/i)).toBeInTheDocument();
    expect(screen.getByText('GRAND TOTAL')).toBeInTheDocument();
    // The main tab chrome is not rendered in pop-out mode.
    expect(screen.queryByRole('button', { name: 'FX ENGINE' })).not.toBeInTheDocument();
  });
});


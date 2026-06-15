// ── SDLARE Rentals — data model, persistence & dual-currency money math ──
//
// Pure, framework-free logic lives here so it can be unit-tested in
// isolation (see rentals.test.js). The React layer in App.js only handles
// rendering and wiring; all financial calculations are defined below.
//
// Currency: every monetary amount carries its own currency ('USD' | 'MXN').
// All aggregation is done in a USD base using the USD→MXN rate, and totals
// are reported in USD so the UI can show both dollars and pesos.
//
// Data shape:
//   Property { id, name, building, address, notes, units: Unit[], expenses: Expense[] }
//   Unit     { id, label, tenant, notes, capacity, fixtures, features,
//              rent, rentCurrency, leaseStart, leaseEnd,
//              payments: { 'YYYY-MM': 'paid' | 'outstanding' } }
//   Expense  { id, category, amount, currency, notes }   // recurring monthly cost
//   Settings { usdMxn, defaultCurrency }

export const STORAGE_KEY = 'sdlare.rentals.v1';
export const SETTINGS_KEY = 'sdlare.settings.v1';

export const CURRENCIES = ['USD', 'MXN'];

// Common rental expense categories (the "expenses you can think of").
export const EXPENSE_CATEGORIES = [
  'Property Tax',
  'Insurance',
  'HOA',
  'Property Management',
  'Maintenance',
  'Utilities',
  'Mortgage / Loan',
  'Landscaping',
  'Other',
];

export const DEFAULT_SETTINGS = { usdMxn: 17, defaultCurrency: 'USD' };

// ── ID + date helpers ──────────────────────────────────────────────────
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function isOccupied(unit) {
  return Boolean(unit && unit.tenant && unit.tenant.trim());
}

// ── Currency + money helpers ────────────────────────────────────────────
// Coerce arbitrary input (string from a form field, number, null) into a
// non-negative finite amount. Guards the money math against NaN.
export function toAmount(value) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function normalizeRate(rate) {
  const n = toAmount(rate);
  return n > 0 ? n : DEFAULT_SETTINGS.usdMxn;
}

// Convert any amount to USD using the USD→MXN rate (e.g. 17 ⇒ 1 USD = 17 MXN).
export function toUSD(amount, currency, rate) {
  const value = toAmount(amount);
  if (currency === 'MXN') return value / normalizeRate(rate);
  return value;
}

export function usdToMxn(usd, rate) {
  return toAmount(usd) * normalizeRate(rate);
}

// Format a single amount in one currency. Never renders raw floats.
export function formatMoney(n, currency = 'USD') {
  const v = Number.isFinite(n) ? n : 0;
  const sym = currency === 'MXN' ? 'MX$' : '$';
  const sign = v < 0 ? '-' : '';
  return `${sign}${sym}${Math.round(Math.abs(v)).toLocaleString('en-US')}`;
}

// Render a USD-base amount in both dollars and pesos, e.g. "$1,000 / MX$17,000".
export function formatDual(usd, rate) {
  return `${formatMoney(usd, 'USD')} / ${formatMoney(usdToMxn(usd, rate), 'MXN')}`;
}

export function formatPct(n) {
  const v = Number.isFinite(n) ? n : 0;
  return `${Math.round(v)}%`;
}

// ── Core metrics (USD base) ─────────────────────────────────────────────
export function computeMetrics(properties = [], month = monthKey(), rate = DEFAULT_SETTINGS.usdMxn) {
  let totalUnits = 0;
  let occupiedUnits = 0;
  let scheduledRent = 0;
  let collectedRent = 0;
  let outstandingRent = 0;
  let outstandingUnits = 0;
  let monthlyExpenses = 0;

  for (const prop of properties) {
    for (const unit of prop.units || []) {
      totalUnits += 1;
      if (!isOccupied(unit)) continue;

      occupiedUnits += 1;
      const rentUSD = toUSD(unit.rent, unit.rentCurrency, rate);
      scheduledRent += rentUSD;

      const status = (unit.payments || {})[month];
      if (status === 'paid') {
        collectedRent += rentUSD;
      } else {
        outstandingRent += rentUSD;
        outstandingUnits += 1;
      }
    }
    for (const exp of prop.expenses || []) {
      monthlyExpenses += toUSD(exp.amount, exp.currency, rate);
    }
  }

  const netCashflow = collectedRent - monthlyExpenses;
  const projectedCashflow = scheduledRent - monthlyExpenses;
  const occupancyRate = totalUnits === 0 ? 0 : (occupiedUnits / totalUnits) * 100;
  const collectionRate = scheduledRent === 0 ? 0 : (collectedRent / scheduledRent) * 100;

  return {
    totalUnits,
    occupiedUnits,
    vacantUnits: totalUnits - occupiedUnits,
    propertyCount: properties.length,
    scheduledRent,
    collectedRent,
    outstandingRent,
    outstandingUnits,
    monthlyExpenses,
    netCashflow,
    projectedCashflow,
    annualProjection: projectedCashflow * 12,
    occupancyRate,
    collectionRate,
  };
}

// Per-property P&L (USD base): scheduled income, expenses and net.
export function propertyPL(prop, month = monthKey(), rate = DEFAULT_SETTINGS.usdMxn) {
  const income = (prop.units || [])
    .filter(isOccupied)
    .reduce((sum, u) => sum + toUSD(u.rent, u.rentCurrency, rate), 0);
  const expenses = (prop.expenses || []).reduce((sum, e) => sum + toUSD(e.amount, e.currency, rate), 0);
  return {
    id: prop.id,
    name: prop.name,
    building: prop.building || 'Ungrouped',
    income,
    expenses,
    net: income - expenses,
  };
}

// Group property P&L by building/group label, summing income/expenses/net.
// Returns one row per building plus the rows it contains.
export function groupByBuilding(properties = [], month = monthKey(), rate = DEFAULT_SETTINGS.usdMxn) {
  const groups = new Map();
  for (const prop of properties) {
    const pl = propertyPL(prop, month, rate);
    const key = pl.building;
    if (!groups.has(key)) {
      groups.set(key, { building: key, income: 0, expenses: 0, net: 0, properties: [] });
    }
    const g = groups.get(key);
    g.income += pl.income;
    g.expenses += pl.expenses;
    g.net += pl.net;
    g.properties.push(pl);
  }
  return Array.from(groups.values());
}

// Portfolio grand total (USD base) across all properties.
export function grandTotal(properties = [], month = monthKey(), rate = DEFAULT_SETTINGS.usdMxn) {
  return properties.reduce(
    (acc, p) => {
      const pl = propertyPL(p, month, rate);
      acc.income += pl.income;
      acc.expenses += pl.expenses;
      acc.net += pl.net;
      return acc;
    },
    { income: 0, expenses: 0, net: 0 }
  );
}

// ── Persistence ─────────────────────────────────────────────────────────
export function loadProperties(storage = safeStorage()) {
  return loadJSON(STORAGE_KEY, [], (v) => (Array.isArray(v) ? v : []), storage);
}

export function saveProperties(properties, storage = safeStorage()) {
  saveJSON(STORAGE_KEY, properties, storage);
}

export function loadSettings(storage = safeStorage()) {
  return loadJSON(
    SETTINGS_KEY,
    { ...DEFAULT_SETTINGS },
    (v) => ({ ...DEFAULT_SETTINGS, ...(v && typeof v === 'object' ? v : {}) }),
    storage
  );
}

export function saveSettings(settings, storage = safeStorage()) {
  saveJSON(SETTINGS_KEY, settings, storage);
}

function loadJSON(key, fallback, sanitize, storage) {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return sanitize(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

function saveJSON(key, value, storage) {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — non-fatal for the dashboard */
  }
}

function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

// ── Sample fixtures ─────────────────────────────────────────────────────
// Seed data showcasing dual currency and building groups (SD + TJ corridor).
export function sampleProperties() {
  const m = monthKey();
  return [
    {
      id: uid(),
      name: 'Logan Heights Duplex',
      building: 'San Diego',
      address: '2841 Imperial Ave, San Diego, CA',
      notes: 'Long-term tenants. Roof replaced 2024.',
      units: [
        {
          id: uid(), label: 'Unit A', tenant: 'Ana García', notes: 'Section 8 voucher.',
          capacity: '2BR / 1BA · 850 sqft', fixtures: 'Range, fridge, in-unit W/D',
          features: 'Off-street parking, fenced yard',
          rent: 2400, rentCurrency: 'USD', leaseStart: '2025-01-01', leaseEnd: '2026-12-31',
          payments: { [m]: 'paid' },
        },
        {
          id: uid(), label: 'Unit B', tenant: 'Miguel Torres', notes: '',
          capacity: '1BR / 1BA · 600 sqft', fixtures: 'Range, fridge', features: 'Shared laundry',
          rent: 1850, rentCurrency: 'USD', leaseStart: '2025-06-01', leaseEnd: '2026-05-31',
          payments: { [m]: 'outstanding' },
        },
      ],
      expenses: [
        { id: uid(), category: 'Property Tax', amount: 620, currency: 'USD', notes: 'Annual ÷ 12' },
        { id: uid(), category: 'Insurance', amount: 180, currency: 'USD', notes: '' },
      ],
    },
    {
      id: uid(),
      name: 'Playas Condo',
      building: 'Tijuana',
      address: 'Paseo Ensenada 1500, Playas de Tijuana, BC',
      notes: 'Cross-border rental — collected in pesos.',
      units: [
        {
          id: uid(), label: 'Depto 3', tenant: 'Roberto Núñez', notes: 'Ocean view.',
          capacity: '2 rec / 2 baños · 95 m²', fixtures: 'Estufa, refri, boiler',
          features: 'Alberca, seguridad 24h', rent: 28000, rentCurrency: 'MXN',
          leaseStart: '2025-03-01', leaseEnd: '2026-02-28', payments: { [m]: 'paid' },
        },
      ],
      expenses: [
        { id: uid(), category: 'HOA', amount: 3200, currency: 'MXN', notes: 'Cuota de mantenimiento' },
        { id: uid(), category: 'Property Tax', amount: 1100, currency: 'MXN', notes: 'Predial ÷ 12' },
      ],
    },
  ];
}

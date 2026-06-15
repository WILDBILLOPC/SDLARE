// ── SDLARE Rentals — data model, persistence & money math ──────────────
//
// Pure, framework-free logic lives here so it can be unit-tested in
// isolation (see rentals.test.js). The React layer in App.js only handles
// rendering and wiring; all financial calculations are defined below.
//
// Data shape:
//   Property { id, name, address, units: Unit[], expenses: Expense[] }
//   Unit     { id, label, tenant, rent, leaseStart, leaseEnd,
//              payments: { 'YYYY-MM': 'paid' | 'outstanding' } }
//   Expense  { id, category, amount }   // recurring monthly cost
//
// A unit is "occupied" when it has a non-empty tenant. Vacant units do not
// count toward scheduled/outstanding rent or occupancy income.

export const STORAGE_KEY = 'sdlare.rentals.v1';

// ── ID + date helpers ──────────────────────────────────────────────────
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Stable 'YYYY-MM' key for a Date (defaults to now). Used to scope payments
// to a calendar month.
export function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function isOccupied(unit) {
  return Boolean(unit && unit.tenant && unit.tenant.trim());
}

// ── Money formatting ────────────────────────────────────────────────────
// Always render money via this helper — never raw floats. Rounds to whole
// dollars for the dashboard's compact display.
export function formatMoney(n) {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;
}

export function formatPct(n) {
  const v = Number.isFinite(n) ? n : 0;
  return `${Math.round(v)}%`;
}

// ── Core metrics ────────────────────────────────────────────────────────
// Compute every dashboard figure for a given month from the property list.
// Returns whole numbers (dollars) plus counts and rates so the UI never has
// to do arithmetic.
export function computeMetrics(properties = [], month = monthKey()) {
  let totalUnits = 0;
  let occupiedUnits = 0;
  let scheduledRent = 0;   // gross potential rent from occupied units
  let collectedRent = 0;   // rent marked paid this month
  let outstandingRent = 0; // occupied rent not yet collected this month
  let outstandingUnits = 0;
  let monthlyExpenses = 0;

  for (const prop of properties) {
    for (const unit of prop.units || []) {
      totalUnits += 1;
      if (!isOccupied(unit)) continue;

      occupiedUnits += 1;
      const rent = toAmount(unit.rent);
      scheduledRent += rent;

      const status = (unit.payments || {})[month];
      if (status === 'paid') {
        collectedRent += rent;
      } else {
        outstandingRent += rent;
        outstandingUnits += 1;
      }
    }
    for (const exp of prop.expenses || []) {
      monthlyExpenses += toAmount(exp.amount);
    }
  }

  const netCashflow = collectedRent - monthlyExpenses;       // realized
  const projectedCashflow = scheduledRent - monthlyExpenses; // potential
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

// Per-property P&L breakdown for the P&L tab.
export function propertyPL(prop, month = monthKey()) {
  const income = (prop.units || [])
    .filter(isOccupied)
    .reduce((sum, u) => sum + toAmount(u.rent), 0);
  const expenses = (prop.expenses || []).reduce((sum, e) => sum + toAmount(e.amount), 0);
  return { id: prop.id, name: prop.name, income, expenses, net: income - expenses };
}

// Coerce arbitrary input (string from a form field, number, null) into a
// non-negative finite amount. Guards the money math against NaN.
export function toAmount(value) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

// ── Persistence ─────────────────────────────────────────────────────────
export function loadProperties(storage = safeStorage()) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProperties(properties, storage = safeStorage()) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(properties));
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

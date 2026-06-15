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
//   Property { id, name, building, address, notes,
//              units: Unit[], expenses: Expense[], tasks: Task[], documents: Doc[] }
//   Unit     { id, label, tenant, phone, email, notes, capacity, fixtures, features,
//              rent, rentCurrency, leaseStart, leaseEnd,
//              payments: { 'YYYY-MM': 'paid' | 'outstanding' } }
//   Expense  { id, category, amount, currency, notes }   // recurring monthly cost
//   Task     { id, text, done, created }                 // per-property to-do
//   Doc      { id, type, name, reference, url, notes }   // document inventory entry
//   Settings { usdMxn, defaultCurrency, totals* }

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

export const DEFAULT_SETTINGS = {
  usdMxn: 17,
  defaultCurrency: 'USD',
  // How the Totals & P&L view is arranged (user-rearrangeable).
  totalsGroupBy: 'building', // 'building' | 'none'
  totalsSortBy: 'name',      // 'name' | 'income' | 'net'
  totalsSortDir: 'asc',      // 'asc' | 'desc'
};

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

// Sort an array of P&L rows (properties or groups) by a field + direction.
export function sortPLRows(rows, sortBy = 'name', sortDir = 'asc') {
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    let cmp;
    if (sortBy === 'net') cmp = a.net - b.net;
    else if (sortBy === 'income') cmp = a.income - b.income;
    else cmp = String(a.name ?? a.building ?? '').localeCompare(String(b.name ?? b.building ?? ''));
    return cmp * dir;
  });
}

// Build the Totals & P&L view, arrangeable by the user. `groupBy` controls
// whether rows are grouped under a building/group header ('building') or
// shown as a flat per-property list ('none'); `sortBy`/`sortDir` order both
// the groups and the rows within them. Returns groups (always) + the grand
// total so the UI can render either mode uniformly.
export function buildTotals(properties = [], opts = {}) {
  const {
    month = monthKey(),
    rate = DEFAULT_SETTINGS.usdMxn,
    groupBy = 'building',
    sortBy = 'name',
    sortDir = 'asc',
  } = opts;
  const grand = grandTotal(properties, month, rate);
  const rows = properties.map((p) => propertyPL(p, month, rate));

  if (groupBy === 'none') {
    return {
      grouped: false,
      groups: [{ key: '', building: '', ...grand, properties: sortPLRows(rows, sortBy, sortDir) }],
      grand,
    };
  }

  const map = new Map();
  for (const pl of rows) {
    const k = pl.building;
    if (!map.has(k)) map.set(k, { key: k, building: k, income: 0, expenses: 0, net: 0, properties: [] });
    const g = map.get(k);
    g.income += pl.income;
    g.expenses += pl.expenses;
    g.net += pl.net;
    g.properties.push(pl);
  }
  const groups = sortPLRows(Array.from(map.values()), sortBy, sortDir)
    .map((g) => ({ ...g, properties: sortPLRows(g.properties, sortBy, sortDir) }));
  return { grouped: true, groups, grand };
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

// ── Tasks ───────────────────────────────────────────────────────────────
// Flatten every property's task list into one "macro" list (tagged with the
// owning property) for the main-tab roll-up. Open tasks come first, then by
// most-recently created.
export function allTasks(properties = []) {
  const tasks = [];
  for (const prop of properties) {
    for (const t of prop.tasks || []) {
      tasks.push({ ...t, propId: prop.id, propName: prop.name });
    }
  }
  return tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (b.created || 0) - (a.created || 0);
  });
}

export function openTaskCount(properties = []) {
  return allTasks(properties).filter((t) => !t.done).length;
}

// ── Daily figures + FX conversion ───────────────────────────────────────
// Number of days in a 'YYYY-MM' month string.
export function daysInMonth(month = monthKey()) {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

// Per-day rent figures (USD base) for a month. `collectedPerDay` is the
// run-rate of what's been collected so far (collected ÷ elapsed days);
// `scheduledPerDay` spreads the full scheduled rent evenly across the month.
export function dailyFigures(metrics, month = monthKey(), refDate = new Date()) {
  const dim = daysInMonth(month);
  const inThisMonth = monthKey(refDate) === month;
  const dayOfMonth = inThisMonth ? Math.min(Math.max(refDate.getDate(), 1), dim) : dim;
  return {
    daysInMonth: dim,
    dayOfMonth,
    collectedPerDay: metrics.collectedRent / dayOfMonth,
    scheduledPerDay: metrics.scheduledRent / dim,
  };
}

// Convert a single amount into both currencies. Returns USD-base + MXN.
export function convertAmount(amount, currency, rate) {
  const usd = toUSD(amount, currency, rate);
  return { usd, mxn: usdToMxn(usd, rate) };
}

// ── Messaging (SMS / WhatsApp / Email deep links) ───────────────────────
// The dashboard has no backend, so "sending" opens the user's own SMS,
// WhatsApp or email app with a pre-filled message via standard deep links.
// All builders are pure so they can be unit-tested.

// Strip a phone number down to digits (keeping a leading +).
export function sanitizePhone(phone) {
  if (!phone) return '';
  const trimmed = String(phone).trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^\d]/g, '');
}

export function buildSmsLink(phone, body = '') {
  return `sms:${sanitizePhone(phone)}?&body=${encodeURIComponent(body)}`;
}

// wa.me expects digits only, no '+'.
export function buildWhatsAppLink(phone, text = '') {
  const digits = sanitizePhone(phone).replace('+', '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function buildMailtoLink(email, subject = '', body = '') {
  return `mailto:${(email || '').trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Bilingual (EN/ES) rent-reminder message for a unit, with the amount due in
// the unit's own currency. Used to pre-fill SMS/WhatsApp/email.
export function rentReminderMessage(unit, propertyName = '') {
  const who = (unit && unit.tenant) ? unit.tenant : 'there';
  const amount = formatMoney(toAmount(unit && unit.rent), (unit && unit.rentCurrency) || 'USD');
  const where = propertyName ? ` for ${propertyName}${unit && unit.label ? ` (${unit.label})` : ''}` : '';
  return (
    `Hi ${who}, a friendly reminder that your rent of ${amount}${where} is due. ` +
    `Please let us know if you have any questions. Thank you! — SDLARE\n\n` +
    `Hola ${who}, un recordatorio de que su renta de ${amount}${where} está por vencer. ` +
    `Cualquier duda, con gusto le ayudamos. ¡Gracias! — SDLARE`
  );
}

// ── Document inventory ──────────────────────────────────────────────────
export const DOCUMENT_TYPES = [
  'Lease / Contract',
  'Utility',
  'Insurance',
  'Property Tax',
  'HOA',
  'Inspection',
  'Permit',
  'Other',
];

// Flatten every property's documents into one inventory list, tagged with the
// owning property.
export function allDocuments(properties = []) {
  const docs = [];
  for (const prop of properties) {
    for (const d of prop.documents || []) {
      docs.push({ ...d, propId: prop.id, propName: prop.name });
    }
  }
  return docs;
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
          id: uid(), label: 'Unit A', tenant: 'Ana García',
          phone: '+16195550101', email: 'ana@example.com', notes: 'Section 8 voucher.',
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
      tasks: [
        { id: uid(), text: 'Follow up on Unit B rent', done: false, created: Date.now() },
        { id: uid(), text: 'Schedule annual HVAC service', done: false, created: Date.now() - 1000 },
      ],
      documents: [
        { id: uid(), type: 'Lease / Contract', name: 'Unit A Lease 2025', reference: 'LSE-A-25', url: '', notes: 'Renews 2026-12-31' },
        { id: uid(), type: 'Utility', name: 'SDG&E electric', reference: 'Acct 8829-1', url: '', notes: 'Autopay' },
        { id: uid(), type: 'Insurance', name: 'Landlord policy', reference: 'POL-44821', url: '', notes: '' },
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
          id: uid(), label: 'Depto 3', tenant: 'Roberto Núñez',
          phone: '+526641234567', email: 'roberto@example.mx', notes: 'Ocean view.',
          capacity: '2 rec / 2 baños · 95 m²', fixtures: 'Estufa, refri, boiler',
          features: 'Alberca, seguridad 24h', rent: 28000, rentCurrency: 'MXN',
          leaseStart: '2025-03-01', leaseEnd: '2026-02-28', payments: { [m]: 'paid' },
        },
      ],
      expenses: [
        { id: uid(), category: 'HOA', amount: 3200, currency: 'MXN', notes: 'Cuota de mantenimiento' },
        { id: uid(), category: 'Property Tax', amount: 1100, currency: 'MXN', notes: 'Predial ÷ 12' },
      ],
      tasks: [
        { id: uid(), text: 'Renew INM paperwork for tenant', done: false, created: Date.now() - 2000 },
      ],
      documents: [
        { id: uid(), type: 'Lease / Contract', name: 'Contrato Depto 3', reference: 'CTR-D3', url: '', notes: 'En español' },
        { id: uid(), type: 'HOA', name: 'Reglamento condominio', reference: '', url: '', notes: '' },
      ],
    },
  ];
}

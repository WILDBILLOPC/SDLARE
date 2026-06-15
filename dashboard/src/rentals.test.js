import {
  computeMetrics,
  propertyPL,
  groupByBuilding,
  grandTotal,
  buildTotals,
  sortPLRows,
  allTasks,
  openTaskCount,
  allDocuments,
  daysInMonth,
  dailyFigures,
  convertAmount,
  sanitizePhone,
  buildSmsLink,
  buildWhatsAppLink,
  buildMailtoLink,
  rentReminderMessage,
  formatMoney,
  formatDual,
  formatPct,
  toAmount,
  toUSD,
  usdToMxn,
  normalizeRate,
  isOccupied,
  monthKey,
  loadProperties,
  saveProperties,
  loadSettings,
  saveSettings,
  sampleProperties,
  STORAGE_KEY,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
} from './rentals';

const MONTH = '2026-06';
const RATE = 20; // 1 USD = 20 MXN, round numbers for assertions

function unit(over = {}) {
  return { id: 'u', label: 'Unit', tenant: 'Tenant', rent: 1000, rentCurrency: 'USD', payments: {}, ...over };
}

describe('toAmount', () => {
  it('parses numeric strings from form fields', () => {
    expect(toAmount('1500')).toBe(1500);
    expect(toAmount('1500.50')).toBe(1500.5);
  });
  it('coerces invalid / negative input to 0', () => {
    expect(toAmount('')).toBe(0);
    expect(toAmount('abc')).toBe(0);
    expect(toAmount(-5)).toBe(0);
    expect(toAmount(null)).toBe(0);
    expect(toAmount(NaN)).toBe(0);
  });
});

describe('currency conversion', () => {
  it('normalizeRate falls back to default for bad input', () => {
    expect(normalizeRate(0)).toBe(DEFAULT_SETTINGS.usdMxn);
    expect(normalizeRate(-3)).toBe(DEFAULT_SETTINGS.usdMxn);
    expect(normalizeRate('abc')).toBe(DEFAULT_SETTINGS.usdMxn);
    expect(normalizeRate(18)).toBe(18);
  });
  it('toUSD leaves dollars unchanged', () => {
    expect(toUSD(1000, 'USD', RATE)).toBe(1000);
  });
  it('toUSD converts pesos to dollars at the rate', () => {
    expect(toUSD(20000, 'MXN', RATE)).toBe(1000);
  });
  it('usdToMxn converts dollars to pesos', () => {
    expect(usdToMxn(1000, RATE)).toBe(20000);
  });
});

describe('formatMoney', () => {
  it('formats USD with a dollar sign', () => {
    expect(formatMoney(1234567, 'USD')).toBe('$1,234,567');
    expect(formatMoney(0)).toBe('$0');
  });
  it('formats MXN with a peso prefix', () => {
    expect(formatMoney(34000, 'MXN')).toBe('MX$34,000');
  });
  it('rounds and handles negatives / non-finite', () => {
    expect(formatMoney(1999.5)).toBe('$2,000');
    expect(formatMoney(-2500)).toBe('-$2,500');
    expect(formatMoney(NaN)).toBe('$0');
  });
});

describe('formatDual', () => {
  it('renders both dollars and pesos from a USD base', () => {
    expect(formatDual(1000, RATE)).toBe('$1,000 / MX$20,000');
  });
});

describe('formatPct', () => {
  it('rounds to a whole percentage', () => {
    expect(formatPct(66.6)).toBe('67%');
    expect(formatPct(NaN)).toBe('0%');
  });
});

describe('isOccupied', () => {
  it('treats a non-empty tenant as occupied', () => {
    expect(isOccupied(unit({ tenant: 'Ana' }))).toBe(true);
  });
  it('treats blank / missing tenant as vacant', () => {
    expect(isOccupied(unit({ tenant: '   ' }))).toBe(false);
    expect(isOccupied({ rent: 1000 })).toBe(false);
  });
});

describe('computeMetrics', () => {
  it('returns zeroed metrics for an empty portfolio', () => {
    expect(computeMetrics([], MONTH, RATE)).toMatchObject({
      totalUnits: 0, scheduledRent: 0, collectedRent: 0, monthlyExpenses: 0,
      netCashflow: 0, occupancyRate: 0, annualProjection: 0,
    });
  });

  it('aggregates mixed-currency rent into a USD base', () => {
    const props = [
      {
        id: 'p1',
        units: [
          unit({ id: 'a', rent: 2000, rentCurrency: 'USD', tenant: 'Ana', payments: { [MONTH]: 'paid' } }),
          unit({ id: 'b', rent: 20000, rentCurrency: 'MXN', tenant: 'Beto', payments: { [MONTH]: 'outstanding' } }),
          unit({ id: 'c', rent: 1500, rentCurrency: 'USD', tenant: '' }), // vacant — excluded
        ],
        expenses: [
          { id: 'e1', category: 'Tax', amount: 500, currency: 'USD' },
          { id: 'e2', category: 'HOA', amount: 4000, currency: 'MXN' }, // = $200
        ],
      },
    ];
    const m = computeMetrics(props, MONTH, RATE);
    expect(m.totalUnits).toBe(3);
    expect(m.occupiedUnits).toBe(2);
    expect(m.scheduledRent).toBe(3000);   // 2000 + (20000/20)
    expect(m.collectedRent).toBe(2000);   // only Ana paid
    expect(m.outstandingRent).toBe(1000); // Beto's 20000 MXN = $1000
    expect(m.monthlyExpenses).toBe(700);  // 500 + 200
    expect(m.netCashflow).toBe(1300);     // 2000 - 700
    expect(m.projectedCashflow).toBe(2300); // 3000 - 700
    expect(m.annualProjection).toBe(27600); // 2300 * 12
    expect(m.occupancyRate).toBeCloseTo((2 / 3) * 100);
  });

  it('scopes payment status to the requested month', () => {
    const props = [{ id: 'p1', units: [unit({ tenant: 'Ana', payments: { '2026-05': 'paid' } })], expenses: [] }];
    expect(computeMetrics(props, '2026-05', RATE).collectedRent).toBe(1000);
    expect(computeMetrics(props, '2026-06', RATE).outstandingRent).toBe(1000);
  });
});

describe('propertyPL / groupByBuilding / grandTotal', () => {
  const props = [
    {
      id: 'p1', name: 'SD Duplex', building: 'San Diego',
      units: [unit({ rent: 2000, rentCurrency: 'USD', tenant: 'Ana' })],
      expenses: [{ id: 'e', category: 'Tax', amount: 400, currency: 'USD' }],
    },
    {
      id: 'p2', name: 'SD Condo', building: 'San Diego',
      units: [unit({ rent: 1500, rentCurrency: 'USD', tenant: 'Bob' })],
      expenses: [],
    },
    {
      id: 'p3', name: 'TJ Condo', building: 'Tijuana',
      units: [unit({ rent: 20000, rentCurrency: 'MXN', tenant: 'Cyn' })], // = $1000
      expenses: [{ id: 'e', category: 'HOA', amount: 2000, currency: 'MXN' }], // = $100
    },
  ];

  it('computes per-property net in USD base', () => {
    expect(propertyPL(props[0], MONTH, RATE)).toMatchObject({ income: 2000, expenses: 400, net: 1600, building: 'San Diego' });
    expect(propertyPL(props[2], MONTH, RATE)).toMatchObject({ income: 1000, expenses: 100, net: 900 });
  });

  it('groups properties by building label', () => {
    const groups = groupByBuilding(props, MONTH, RATE);
    const sd = groups.find((g) => g.building === 'San Diego');
    const tj = groups.find((g) => g.building === 'Tijuana');
    expect(sd.income).toBe(3500);
    expect(sd.properties).toHaveLength(2);
    expect(tj.net).toBe(900);
  });

  it('falls back to "Ungrouped" when no building label', () => {
    const groups = groupByBuilding([{ id: 'x', units: [unit({ tenant: 'A' })], expenses: [] }], MONTH, RATE);
    expect(groups[0].building).toBe('Ungrouped');
  });

  it('computes a portfolio grand total', () => {
    expect(grandTotal(props, MONTH, RATE)).toEqual({ income: 4500, expenses: 500, net: 4000 });
  });
});

describe('buildTotals (rearrangeable)', () => {
  const props = [
    { id: 'p1', name: 'Bravo', building: 'San Diego', units: [unit({ rent: 1000, tenant: 'A' })], expenses: [] },
    { id: 'p2', name: 'Alpha', building: 'San Diego', units: [unit({ rent: 3000, tenant: 'B' })], expenses: [] },
    { id: 'p3', name: 'Charlie', building: 'Tijuana', units: [unit({ rent: 2000, tenant: 'C' })], expenses: [] },
  ];

  it('groups by building by default and sorts groups + rows by name', () => {
    const { grouped, groups, grand } = buildTotals(props, { month: MONTH, rate: RATE });
    expect(grouped).toBe(true);
    expect(groups.map((g) => g.building)).toEqual(['San Diego', 'Tijuana']);
    // within San Diego, properties sorted by name asc
    expect(groups[0].properties.map((r) => r.name)).toEqual(['Alpha', 'Bravo']);
    expect(grand.income).toBe(6000);
  });

  it('supports a flat (groupBy none) arrangement', () => {
    const { grouped, groups } = buildTotals(props, { month: MONTH, rate: RATE, groupBy: 'none', sortBy: 'name' });
    expect(grouped).toBe(false);
    expect(groups).toHaveLength(1);
    expect(groups[0].properties.map((r) => r.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('sorts by net descending when requested', () => {
    const { groups } = buildTotals(props, { month: MONTH, rate: RATE, groupBy: 'none', sortBy: 'net', sortDir: 'desc' });
    expect(groups[0].properties.map((r) => r.income)).toEqual([3000, 2000, 1000]);
  });
});

describe('sortPLRows', () => {
  const rows = [
    { name: 'B', income: 100, net: 10 },
    { name: 'A', income: 300, net: -5 },
    { name: 'C', income: 200, net: 50 },
  ];
  it('sorts by name asc by default', () => {
    expect(sortPLRows(rows).map((r) => r.name)).toEqual(['A', 'B', 'C']);
  });
  it('sorts by income desc', () => {
    expect(sortPLRows(rows, 'income', 'desc').map((r) => r.income)).toEqual([300, 200, 100]);
  });
  it('does not mutate the input', () => {
    const copy = [...rows];
    sortPLRows(rows, 'net', 'desc');
    expect(rows).toEqual(copy);
  });
});

describe('messaging links', () => {
  it('sanitizes phone numbers to digits, keeping a leading +', () => {
    expect(sanitizePhone('+1 (619) 555-0101')).toBe('+16195550101');
    expect(sanitizePhone('619.555.0101')).toBe('6195550101');
    expect(sanitizePhone('')).toBe('');
  });
  it('builds an sms: link with an encoded body', () => {
    expect(buildSmsLink('+16195550101', 'Hi there')).toBe('sms:+16195550101?&body=Hi%20there');
  });
  it('builds a wa.me link with digits only', () => {
    expect(buildWhatsAppLink('+16195550101', 'Hola')).toBe('https://wa.me/16195550101?text=Hola');
  });
  it('builds a mailto: link with subject and body', () => {
    expect(buildMailtoLink('a@b.com', 'Sub', 'Body')).toBe('mailto:a@b.com?subject=Sub&body=Body');
  });
  it('produces a bilingual rent reminder with the amount in the unit currency', () => {
    const msg = rentReminderMessage({ tenant: 'Ana', rent: 2400, rentCurrency: 'USD', label: 'Unit A' }, 'SD Duplex');
    expect(msg).toContain('Ana');
    expect(msg).toContain('$2,400');
    expect(msg).toContain('SD Duplex');
    expect(msg).toContain('renta'); // Spanish half
  });
});

describe('allDocuments', () => {
  it('flattens documents across properties, tagging the owner', () => {
    const props = [
      { id: 'p1', name: 'A', documents: [{ id: 'd1', type: 'Utility', name: 'Electric' }] },
      { id: 'p2', name: 'B', documents: [{ id: 'd2', type: 'Lease / Contract', name: 'Lease' }] },
      { id: 'p3', name: 'C' },
    ];
    const docs = allDocuments(props);
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({ id: 'd1', propId: 'p1', propName: 'A' });
  });
});

describe('tasks', () => {
  const props = [
    { id: 'p1', name: 'A', tasks: [
      { id: 't1', text: 'done one', done: true, created: 100 },
      { id: 't2', text: 'open new', done: false, created: 300 },
    ] },
    { id: 'p2', name: 'B', tasks: [
      { id: 't3', text: 'open old', done: false, created: 200 },
    ] },
    { id: 'p3', name: 'C' }, // no tasks array
  ];

  it('flattens tasks across properties, tagging the owner', () => {
    const tasks = allTasks(props);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({ id: 't2', propId: 'p1', propName: 'A' });
  });

  it('orders open tasks first, then newest', () => {
    const order = allTasks(props).map((t) => t.id);
    expect(order).toEqual(['t2', 't3', 't1']); // open(newest→oldest), then done
  });

  it('counts open tasks only', () => {
    expect(openTaskCount(props)).toBe(2);
    expect(openTaskCount([])).toBe(0);
  });
});

describe('daysInMonth', () => {
  it('returns correct day counts', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2024-02')).toBe(29); // leap year
    expect(daysInMonth('2026-06')).toBe(30);
    expect(daysInMonth('2026-07')).toBe(31);
  });
  it('falls back to 30 for malformed input', () => {
    expect(daysInMonth('garbage')).toBe(30);
  });
});

describe('dailyFigures', () => {
  const metrics = { collectedRent: 3000, scheduledRent: 6000 };

  it('uses the reference day-of-month within the same month', () => {
    const d = dailyFigures(metrics, '2026-06', new Date(2026, 5, 10)); // June 10
    expect(d.daysInMonth).toBe(30);
    expect(d.dayOfMonth).toBe(10);
    expect(d.collectedPerDay).toBe(300);  // 3000 / 10
    expect(d.scheduledPerDay).toBe(200);  // 6000 / 30
  });

  it('uses full month length when the reference date is a different month', () => {
    const d = dailyFigures(metrics, '2026-06', new Date(2026, 0, 15)); // January
    expect(d.dayOfMonth).toBe(30);
    expect(d.collectedPerDay).toBe(100); // 3000 / 30
  });
});

describe('convertAmount', () => {
  it('returns both USD and MXN from a dollar input', () => {
    expect(convertAmount(1000, 'USD', 20)).toEqual({ usd: 1000, mxn: 20000 });
  });
  it('returns both from a peso input', () => {
    expect(convertAmount(20000, 'MXN', 20)).toEqual({ usd: 1000, mxn: 20000 });
  });
});

describe('monthKey', () => {
  it('formats a date as YYYY-MM, zero-padded', () => {
    expect(monthKey(new Date(2026, 0, 15))).toBe('2026-01');
    expect(monthKey(new Date(2026, 11, 1))).toBe('2026-12');
  });
});

describe('persistence', () => {
  function memoryStorage() {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
    };
  }

  it('round-trips properties through storage', () => {
    const store = memoryStorage();
    const props = [{ id: 'p1', name: 'X', units: [], expenses: [] }];
    saveProperties(props, store);
    expect(store.getItem(STORAGE_KEY)).toContain('p1');
    expect(loadProperties(store)).toEqual(props);
  });

  it('returns [] for missing or corrupt property data', () => {
    const empty = memoryStorage();
    expect(loadProperties(empty)).toEqual([]);
    const corrupt = memoryStorage();
    corrupt.setItem(STORAGE_KEY, '{not json');
    expect(loadProperties(corrupt)).toEqual([]);
    const notArray = memoryStorage();
    notArray.setItem(STORAGE_KEY, '{"a":1}');
    expect(loadProperties(notArray)).toEqual([]);
  });

  it('round-trips settings and merges defaults', () => {
    const store = memoryStorage();
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    saveSettings({ usdMxn: 18.5 }, store);
    expect(loadSettings(store)).toEqual({ ...DEFAULT_SETTINGS, usdMxn: 18.5 });
  });

  it('returns default settings for corrupt data', () => {
    const corrupt = memoryStorage();
    corrupt.setItem(SETTINGS_KEY, 'nope');
    expect(loadSettings(corrupt)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('sampleProperties fixtures', () => {
  it('returns seed data across both currencies and buildings', () => {
    const props = sampleProperties();
    expect(props.length).toBeGreaterThan(0);
    const buildings = new Set(props.map((p) => p.building));
    expect(buildings.has('San Diego')).toBe(true);
    expect(buildings.has('Tijuana')).toBe(true);
    const currencies = new Set(props.flatMap((p) => p.units.map((u) => u.rentCurrency)));
    expect(currencies.has('USD')).toBe(true);
    expect(currencies.has('MXN')).toBe(true);
    // every unit carries the new descriptive fields
    for (const p of props) {
      for (const u of p.units) {
        expect(u).toHaveProperty('capacity');
        expect(u).toHaveProperty('fixtures');
        expect(u).toHaveProperty('features');
      }
    }
  });
});

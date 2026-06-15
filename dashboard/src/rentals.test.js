import {
  computeMetrics,
  propertyPL,
  formatMoney,
  formatPct,
  toAmount,
  isOccupied,
  monthKey,
  loadProperties,
  saveProperties,
  STORAGE_KEY,
} from './rentals';

const MONTH = '2026-06';

function unit(over = {}) {
  return { id: 'u', label: 'Unit', tenant: 'Tenant', rent: 1000, payments: {}, ...over };
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
    expect(toAmount(undefined)).toBe(0);
    expect(toAmount(NaN)).toBe(0);
  });
});

describe('isOccupied', () => {
  it('treats a non-empty tenant as occupied', () => {
    expect(isOccupied(unit({ tenant: 'Ana' }))).toBe(true);
  });
  it('treats blank / missing tenant as vacant', () => {
    expect(isOccupied(unit({ tenant: '' }))).toBe(false);
    expect(isOccupied(unit({ tenant: '   ' }))).toBe(false);
    expect(isOccupied({ rent: 1000 })).toBe(false);
  });
});

describe('formatMoney', () => {
  it('formats whole dollars with thousands separators', () => {
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(1234567)).toBe('$1,234,567');
  });
  it('rounds to whole dollars', () => {
    expect(formatMoney(1999.49)).toBe('$1,999');
    expect(formatMoney(1999.5)).toBe('$2,000');
  });
  it('handles negatives and non-finite input', () => {
    expect(formatMoney(-2500)).toBe('-$2,500');
    expect(formatMoney(NaN)).toBe('$0');
    expect(formatMoney(undefined)).toBe('$0');
  });
});

describe('formatPct', () => {
  it('rounds to a whole percentage', () => {
    expect(formatPct(0)).toBe('0%');
    expect(formatPct(66.6)).toBe('67%');
    expect(formatPct(NaN)).toBe('0%');
  });
});

describe('computeMetrics', () => {
  it('returns zeroed metrics for an empty portfolio', () => {
    const m = computeMetrics([], MONTH);
    expect(m).toMatchObject({
      totalUnits: 0,
      occupiedUnits: 0,
      scheduledRent: 0,
      collectedRent: 0,
      outstandingRent: 0,
      monthlyExpenses: 0,
      netCashflow: 0,
      occupancyRate: 0,
      collectionRate: 0,
      annualProjection: 0,
    });
  });

  it('sums scheduled rent only for occupied units', () => {
    const props = [
      {
        id: 'p1',
        units: [
          unit({ rent: 2000, tenant: 'Ana' }),
          unit({ rent: 1500, tenant: '' }), // vacant — excluded
        ],
        expenses: [],
      },
    ];
    const m = computeMetrics(props, MONTH);
    expect(m.totalUnits).toBe(2);
    expect(m.occupiedUnits).toBe(1);
    expect(m.vacantUnits).toBe(1);
    expect(m.scheduledRent).toBe(2000);
    expect(m.occupancyRate).toBe(50);
  });

  it('splits collected vs outstanding by this month payment status', () => {
    const props = [
      {
        id: 'p1',
        units: [
          unit({ id: 'a', rent: 2000, tenant: 'Ana', payments: { [MONTH]: 'paid' } }),
          unit({ id: 'b', rent: 1800, tenant: 'Beto', payments: { [MONTH]: 'outstanding' } }),
          unit({ id: 'c', rent: 1200, tenant: 'Cyn', payments: {} }), // unmarked => outstanding
        ],
        expenses: [{ id: 'e', category: 'HOA', amount: 500 }],
      },
    ];
    const m = computeMetrics(props, MONTH);
    expect(m.scheduledRent).toBe(5000);
    expect(m.collectedRent).toBe(2000);
    expect(m.outstandingRent).toBe(3000);
    expect(m.outstandingUnits).toBe(2);
    expect(m.monthlyExpenses).toBe(500);
    expect(m.netCashflow).toBe(1500); // collected 2000 - expenses 500
    expect(m.projectedCashflow).toBe(4500); // scheduled 5000 - 500
    expect(m.annualProjection).toBe(54000); // 4500 * 12
    expect(m.collectionRate).toBe(40); // 2000 / 5000
  });

  it('scopes payment status to the requested month', () => {
    const props = [
      {
        id: 'p1',
        units: [unit({ rent: 1000, tenant: 'Ana', payments: { '2026-05': 'paid' } })],
        expenses: [],
      },
    ];
    expect(computeMetrics(props, '2026-05').collectedRent).toBe(1000);
    expect(computeMetrics(props, '2026-06').collectedRent).toBe(0);
    expect(computeMetrics(props, '2026-06').outstandingRent).toBe(1000);
  });

  it('tolerates missing units / expenses arrays', () => {
    const m = computeMetrics([{ id: 'p1' }], MONTH);
    expect(m.totalUnits).toBe(0);
    expect(m.propertyCount).toBe(1);
  });
});

describe('propertyPL', () => {
  it('computes income, expenses and net per property', () => {
    const prop = {
      id: 'p1',
      name: 'Logan Heights Duplex',
      units: [
        unit({ rent: 2200, tenant: 'Ana' }),
        unit({ rent: 2000, tenant: '' }), // vacant
      ],
      expenses: [
        { id: 'e1', category: 'Tax', amount: 400 },
        { id: 'e2', category: 'Insurance', amount: 150 },
      ],
    };
    expect(propertyPL(prop, MONTH)).toEqual({
      id: 'p1',
      name: 'Logan Heights Duplex',
      income: 2200,
      expenses: 550,
      net: 1650,
    });
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

  it('returns [] for missing or corrupt data', () => {
    const empty = memoryStorage();
    expect(loadProperties(empty)).toEqual([]);

    const corrupt = memoryStorage();
    corrupt.setItem(STORAGE_KEY, '{not json');
    expect(loadProperties(corrupt)).toEqual([]);

    const notArray = memoryStorage();
    notArray.setItem(STORAGE_KEY, '{"a":1}');
    expect(loadProperties(notArray)).toEqual([]);
  });
});

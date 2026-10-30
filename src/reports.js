// Rent accounting and dashboard rollups.
//
// Rent model: a lease charges its full monthly_rent on the same day-of-month as
// its start_date (clamped to short months), from start_date through the
// earlier of end_date and the as-of date. A lease with no end_date is
// month-to-month and keeps accruing. Balance = charges - payments.

const round2 = (n) => Math.round(n * 100) / 100;

export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

// The k-th monthly anniversary of `iso`, clamped to month length.
export function addMonths(iso, k) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = (m - 1) + k;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function leaseStatus(lease, asOf) {
  if (lease.start_date > asOf) return 'upcoming';
  if (lease.end_date && lease.end_date < asOf) return 'ended';
  return 'current';
}

export function rentCharges(lease, asOf) {
  const stop = lease.end_date && lease.end_date < asOf ? lease.end_date : asOf;
  const charges = [];
  for (let k = 0; ; k++) {
    const due = addMonths(lease.start_date, k);
    if (due > stop) break;
    charges.push({ date: due, amount: lease.monthly_rent });
  }
  return charges;
}

function paymentsFor(db, leaseId, asOf) {
  return db.prepare(
    'SELECT * FROM payments WHERE lease_id = ? AND paid_on <= ? ORDER BY paid_on, id',
  ).all(leaseId, asOf);
}

export function leaseBalance(db, lease, asOf) {
  const charged = rentCharges(lease, asOf).reduce((s, c) => s + c.amount, 0);
  const paid = paymentsFor(db, lease.id, asOf).reduce((s, p) => s + p.amount, 0);
  return { charged: round2(charged), paid: round2(paid), balance: round2(charged - paid) };
}

export function withStatus(db, lease, asOf) {
  return { ...lease, status: leaseStatus(lease, asOf), ...leaseBalance(db, lease, asOf) };
}

export function ledger(db, lease, asOf) {
  const entries = [
    ...rentCharges(lease, asOf).map((c) => ({ date: c.date, kind: 'charge', description: 'Monthly rent', amount: c.amount })),
    ...paymentsFor(db, lease.id, asOf).map((p) => ({
      date: p.paid_on, kind: 'payment', payment_id: p.id,
      description: `Payment (${p.method})${p.memo ? ' — ' + p.memo : ''}`, amount: -p.amount,
    })),
  ];
  // Charges sort before payments on the same day.
  entries.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'charge' ? -1 : 1));
  let running = 0;
  for (const e of entries) {
    running = round2(running + e.amount);
    e.balance = running;
  }
  return { lease: withStatus(db, lease, asOf), entries };
}

const monthKey = (iso) => iso.slice(0, 7);

export function dashboard(db, asOf) {
  const leases = db.prepare('SELECT * FROM v_leases').all().map((l) => withStatus(db, l, asOf));
  const current = leases.filter((l) => l.status === 'current');
  const units = db.prepare('SELECT * FROM v_units').all();
  const propertyCount = db.prepare('SELECT COUNT(*) AS n FROM properties').get().n;

  const occupiedUnitIds = new Set(current.map((l) => l.unit_id));
  const vacantUnits = units.filter((u) => !occupiedUnitIds.has(u.id));

  const month = monthKey(asOf);
  const monthStart = `${month}-01`;
  const sumBetween = (sql) => round2(db.prepare(sql).get(monthStart, asOf).total ?? 0);
  const collectedThisMonth = sumBetween('SELECT SUM(amount) AS total FROM payments WHERE paid_on BETWEEN ? AND ?');
  const expensesThisMonth = sumBetween('SELECT SUM(amount) AS total FROM expenses WHERE spent_on BETWEEN ? AND ?');

  const delinquent = leases
    .filter((l) => l.balance > 0.005)
    .sort((a, b) => b.balance - a.balance)
    .map(({ id, tenant_name, property_name, unit_label, balance, status }) => ({ id, tenant_name, property_name, unit_label, balance, status }));

  const horizon = addDays(asOf, 60);
  const expiring = current
    .filter((l) => l.end_date && l.end_date <= horizon)
    .sort((a, b) => a.end_date.localeCompare(b.end_date))
    .map(({ id, tenant_name, property_name, unit_label, end_date, monthly_rent }) => ({ id, tenant_name, property_name, unit_label, end_date, monthly_rent }));

  const openWork = db.prepare(
    "SELECT priority, COUNT(*) AS n FROM maintenance WHERE status != 'closed' GROUP BY priority",
  ).all();
  const openByPriority = Object.fromEntries(openWork.map((r) => [r.priority, r.n]));

  // Trailing six months of cash in vs. cash out, oldest first.
  const firstMonth = addMonths(monthStart, -5);
  const income = db.prepare(
    "SELECT substr(paid_on, 1, 7) AS m, SUM(amount) AS total FROM payments WHERE paid_on BETWEEN ? AND ? GROUP BY m",
  ).all(firstMonth, asOf);
  const spend = db.prepare(
    "SELECT substr(spent_on, 1, 7) AS m, SUM(amount) AS total FROM expenses WHERE spent_on BETWEEN ? AND ? GROUP BY m",
  ).all(firstMonth, asOf);
  const byMonth = (rows) => Object.fromEntries(rows.map((r) => [r.m, round2(r.total)]));
  const inc = byMonth(income);
  const exp = byMonth(spend);
  const cashflow = Array.from({ length: 6 }, (_, i) => {
    const m = monthKey(addMonths(firstMonth, i));
    return { month: m, income: inc[m] ?? 0, expenses: exp[m] ?? 0, net: round2((inc[m] ?? 0) - (exp[m] ?? 0)) };
  });

  return {
    as_of: asOf,
    totals: {
      properties: propertyCount,
      units: units.length,
      occupied: occupiedUnitIds.size,
      vacant: vacantUnits.length,
      occupancy_rate: units.length ? round2(occupiedUnitIds.size / units.length) : 0,
      scheduled_rent: round2(current.reduce((s, l) => s + l.monthly_rent, 0)),
      collected_this_month: collectedThisMonth,
      expenses_this_month: expensesThisMonth,
      outstanding: round2(delinquent.reduce((s, l) => s + l.balance, 0)),
      open_work_orders: openWork.reduce((s, r) => s + r.n, 0),
    },
    open_by_priority: openByPriority,
    delinquent,
    expiring,
    vacant_units: vacantUnits.map(({ id, property_id, property_name, label, market_rent }) => ({ id, property_id, property_name, label, market_rent })),
    cashflow,
  };
}

export function rentRoll(db, asOf) {
  const units = db.prepare('SELECT * FROM v_units ORDER BY property_name, label').all();
  const current = db.prepare('SELECT * FROM v_leases WHERE start_date <= ? AND (end_date IS NULL OR end_date >= ?)').all(asOf, asOf);
  const byUnit = new Map(current.map((l) => [l.unit_id, l]));
  return units.map((u) => {
    const l = byUnit.get(u.id);
    return {
      unit_id: u.id,
      property_name: u.property_name,
      unit_label: u.label,
      market_rent: u.market_rent,
      lease_id: l?.id ?? null,
      tenant_name: l?.tenant_name ?? null,
      start_date: l?.start_date ?? null,
      end_date: l?.end_date ?? null,
      monthly_rent: l?.monthly_rent ?? null,
      deposit: l?.deposit ?? null,
      balance: l ? leaseBalance(db, l, asOf).balance : null,
    };
  });
}

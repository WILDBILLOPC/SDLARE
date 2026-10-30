import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';
import { addMonths, rentCharges } from '../src/reports.js';

let server;
let base;

before(async () => {
  server = createApp(openDb(':memory:'));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('addMonths clamps to the end of short months', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(addMonths('2026-03-01', -5), '2025-10-01');
});

test('rentCharges stops at the end date', () => {
  const lease = { start_date: '2026-01-15', end_date: '2026-03-31', monthly_rent: 1000 };
  assert.deepEqual(rentCharges(lease, '2026-12-01').map((c) => c.date), ['2026-01-15', '2026-02-15', '2026-03-15']);
  assert.equal(rentCharges(lease, '2026-02-14').length, 1);
});

test('full workflow: property → unit → tenant → lease → payments → ledger', async () => {
  const prop = await call('POST', '/properties', { name: 'Test Duplex', address: '1 Main St', type: 'multifamily' });
  assert.equal(prop.status, 201);
  const unit = await call('POST', '/units', { property_id: prop.body.id, label: '1', market_rent: 2000 });
  assert.equal(unit.status, 201);
  assert.equal(unit.body.property_name, 'Test Duplex');
  const tenant = await call('POST', '/tenants', { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' });
  assert.equal(tenant.status, 201);

  const lease = await call('POST', '/leases', {
    unit_id: unit.body.id, tenant_id: tenant.body.id, start_date: '2026-01-01', end_date: '2026-12-31', monthly_rent: 2000, deposit: 2000,
  });
  assert.equal(lease.status, 201);
  assert.equal(lease.body.tenant_name, 'Ada Lovelace');

  await call('POST', '/payments', { lease_id: lease.body.id, paid_on: '2026-01-02', amount: 2000, method: 'ach' });
  await call('POST', '/payments', { lease_id: lease.body.id, paid_on: '2026-02-03', amount: 1500, method: 'check' });

  const ledger = await call('GET', `/leases/${lease.body.id}/ledger?as_of=2026-03-15`);
  assert.equal(ledger.status, 200);
  assert.equal(ledger.body.lease.charged, 6000);
  assert.equal(ledger.body.lease.paid, 3500);
  assert.equal(ledger.body.lease.balance, 2500);
  assert.equal(ledger.body.entries.at(-1).balance, 2500);

  const dash = await call('GET', '/dashboard?as_of=2026-03-15');
  assert.equal(dash.body.totals.occupied, 1);
  assert.equal(dash.body.totals.outstanding, 2500);
  assert.equal(dash.body.delinquent[0].tenant_name, 'Ada Lovelace');

  const roll = await call('GET', '/rent-roll?as_of=2026-03-15');
  assert.equal(roll.body[0].tenant_name, 'Ada Lovelace');
  assert.equal(roll.body[0].balance, 2500);

  // Overlapping lease on the same unit is rejected.
  const other = await call('POST', '/tenants', { first_name: 'Bob', last_name: 'Smith' });
  const overlap = await call('POST', '/leases', {
    unit_id: unit.body.id, tenant_id: other.body.id, start_date: '2026-06-01', monthly_rent: 2100,
  });
  assert.equal(overlap.status, 400);
  assert.match(overlap.body.errors.unit_id, /overlaps lease/);

  // Back-to-back lease is fine.
  const next = await call('POST', '/leases', {
    unit_id: unit.body.id, tenant_id: other.body.id, start_date: '2027-01-01', monthly_rent: 2100,
  });
  assert.equal(next.status, 201);
  assert.equal(next.body.status, 'upcoming');

  // A tenant with a lease can't be deleted out from under it.
  const del = await call('DELETE', `/tenants/${tenant.body.id}`);
  assert.equal(del.status, 409);
});

test('validation errors are reported per field', async () => {
  const res = await call('POST', '/leases', { unit_id: 9999, start_date: '2026-02-30', monthly_rent: -5 });
  assert.equal(res.status, 400);
  assert.equal(res.body.errors.tenant_id, 'is required');
  assert.match(res.body.errors.start_date, /date/);
  assert.match(res.body.errors.monthly_rent, /at least/);

  const badRef = await call('POST', '/units', { property_id: 9999, label: 'X' });
  assert.equal(badRef.status, 400);
  assert.match(badRef.body.errors.property_id, /does not exist/);
});

test('maintenance close date is set and cleared with status', async () => {
  const prop = await call('POST', '/properties', { name: 'WO Test', address: '2 Main St' });
  const unit = await call('POST', '/units', { property_id: prop.body.id, label: 'A' });
  const wo = await call('POST', '/maintenance', { unit_id: unit.body.id, title: 'Leak', priority: 'high' });
  assert.equal(wo.body.status, 'open');
  assert.ok(wo.body.opened_on);

  const closed = await call('PATCH', `/maintenance/${wo.body.id}`, { status: 'closed', cost: 120 });
  assert.equal(closed.status, 200);
  assert.ok(closed.body.closed_on);
  assert.equal(closed.body.cost, 120);

  const reopened = await call('PATCH', `/maintenance/${wo.body.id}`, { status: 'open' });
  assert.equal(reopened.body.closed_on, null);
});

test('unknown routes and bad JSON', async () => {
  assert.equal((await call('GET', '/nope')).status, 404);
  assert.equal((await call('GET', '/properties/abc')).status, 400);
  const res = await fetch(base + '/properties', { method: 'POST', body: '{oops', headers: { 'Content-Type': 'application/json' } });
  assert.equal(res.status, 400);
});

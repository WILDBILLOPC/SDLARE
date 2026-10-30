// Loads demo data. Usage: npm run seed [-- --reset]
import { rmSync } from 'node:fs';
import { openDb } from '../src/db.js';
import { handleApi } from '../src/api.js';
import { today, addMonths, addDays } from '../src/reports.js';

const file = process.env.DB_FILE ?? 'data/sdlare.db';
if (process.argv.includes('--reset')) {
  for (const f of [file, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });
}
const db = openDb(file);
if (db.prepare('SELECT COUNT(*) AS n FROM properties').get().n > 0) {
  console.log('Database already has data; run `npm run seed -- --reset` to start over.');
  process.exit(0);
}

const post = (resource, body) => handleApi(db, 'POST', `/api/${resource}`, new URLSearchParams(), body).body;
const now = today();
const monthStart = `${now.slice(0, 7)}-01`;

const props = [
  post('properties', { name: 'North Park Fourplex', address: '3912 Utah St', city: 'San Diego', state: 'CA', zip: '92104', type: 'multifamily' }),
  post('properties', { name: 'Clairemont House', address: '4420 Mt Herbert Ave', city: 'San Diego', state: 'CA', zip: '92117', type: 'single_family' }),
  post('properties', { name: 'Little Italy Condo', address: '1601 India St #412', city: 'San Diego', state: 'CA', zip: '92101', type: 'condo' }),
];

const units = [
  ...['A', 'B', 'C', 'D'].map((label) => post('units', { property_id: props[0].id, label, bedrooms: 2, bathrooms: 1, sqft: 850, market_rent: 2650 })),
  post('units', { property_id: props[1].id, label: 'Main', bedrooms: 3, bathrooms: 2, sqft: 1450, market_rent: 3900 }),
  post('units', { property_id: props[2].id, label: '412', bedrooms: 1, bathrooms: 1, sqft: 720, market_rent: 2800 }),
];

const people = [
  ['Maria', 'Gonzalez', 'maria.g@example.com', '619-555-0101'],
  ['James', 'Chen', 'jchen@example.com', '619-555-0142'],
  ['Aisha', 'Patel', 'aisha.patel@example.com', '858-555-0177'],
  ['Robert', 'Nguyen', 'rnguyen@example.com', '858-555-0190'],
  ['Emily', 'Walsh', 'ewalsh@example.com', '619-555-0123'],
].map(([first_name, last_name, email, phone]) => post('tenants', { first_name, last_name, email, phone }));

const leaseSpecs = [
  // unit, tenant, start offset (months from this month), term months (null = month-to-month), rent, deposit, months paid behind
  [0, 0, -14, 24, 2550, 2550, 0],
  [1, 1, -11, 12, 2600, 2600, 1],
  [2, 2, -5, 12, 2650, 2650, 0],
  [4, 3, -26, null, 3750, 4000, 0],
  [5, 4, -3, 12, 2800, 2800, 0],
];

for (const [u, t, offset, term, rent, deposit, behind] of leaseSpecs) {
  const start = addMonths(monthStart, offset);
  const lease = post('leases', {
    unit_id: units[u].id, tenant_id: people[t].id, start_date: start,
    end_date: term ? addDays(addMonths(start, term), -1) : null, monthly_rent: rent, deposit,
  });
  const dues = [];
  for (let k = 0; addMonths(start, k) <= now; k++) dues.push(addMonths(start, k));
  for (const due of dues.slice(0, dues.length - behind)) {
    post('payments', { lease_id: lease.id, paid_on: addDays(due, 2), amount: rent, method: t % 2 ? 'zelle' : 'ach' });
  }
}

post('maintenance', { unit_id: units[1].id, title: 'Kitchen faucet leaking', priority: 'normal', vendor: 'Coastal Plumbing', opened_on: addDays(now, -4) });
post('maintenance', { unit_id: units[4].id, title: 'No hot water', description: 'Water heater pilot keeps going out.', priority: 'high', status: 'in_progress', vendor: 'SD Water Heaters', opened_on: addDays(now, -1) });
post('maintenance', { unit_id: units[3].id, title: 'Turnover paint & clean', priority: 'normal', status: 'open', opened_on: addDays(now, -10) });
post('maintenance', { unit_id: units[0].id, title: 'Replace smoke detectors', priority: 'low', status: 'closed', cost: 180, opened_on: addDays(now, -40), closed_on: addDays(now, -35) });

for (let k = -5; k <= 0; k++) {
  const m = addMonths(monthStart, k);
  if (m > now) continue;
  post('expenses', { property_id: props[0].id, spent_on: m, category: 'utilities', amount: 410, vendor: 'SDG&E' });
  post('expenses', { property_id: props[2].id, spent_on: m, category: 'other', amount: 525, vendor: 'HOA', memo: 'Monthly HOA dues' });
}
post('expenses', { property_id: props[1].id, spent_on: now,category: 'landscaping', amount: 160, vendor: 'Green Thumb' });
post('expenses', { property_id: props[0].id, spent_on: addMonths(monthStart, -2), category: 'insurance', amount: 1890, vendor: 'State Farm' });

console.log(`Seeded ${props.length} properties, ${units.length} units, ${people.length} tenants and ${leaseSpecs.length} leases into ${file}.`);

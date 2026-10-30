import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS properties (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT NOT NULL,
  city        TEXT,
  state       TEXT,
  zip         TEXT,
  type        TEXT NOT NULL DEFAULT 'multifamily',
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS units (
  id           INTEGER PRIMARY KEY,
  property_id  INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  bedrooms     REAL,
  bathrooms    REAL,
  sqft         INTEGER,
  market_rent  REAL,
  UNIQUE (property_id, label)
);

CREATE TABLE IF NOT EXISTS tenants (
  id          INTEGER PRIMARY KEY,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leases (
  id            INTEGER PRIMARY KEY,
  unit_id       INTEGER NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  start_date    TEXT NOT NULL,
  end_date      TEXT,
  monthly_rent  REAL NOT NULL,
  deposit       REAL NOT NULL DEFAULT 0,
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id        INTEGER PRIMARY KEY,
  lease_id  INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  paid_on   TEXT NOT NULL,
  amount    REAL NOT NULL,
  method    TEXT NOT NULL DEFAULT 'other',
  memo      TEXT
);

CREATE TABLE IF NOT EXISTS maintenance (
  id           INTEGER PRIMARY KEY,
  unit_id      INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  priority     TEXT NOT NULL DEFAULT 'normal',
  status       TEXT NOT NULL DEFAULT 'open',
  vendor       TEXT,
  cost         REAL,
  opened_on    TEXT NOT NULL DEFAULT (date('now')),
  closed_on    TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id           INTEGER PRIMARY KEY,
  property_id  INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  spent_on     TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'other',
  amount       REAL NOT NULL,
  vendor       TEXT,
  memo         TEXT
);

CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit ON leases(unit_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_lease ON payments(lease_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_unit ON maintenance(unit_id);
CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id);

-- Read views join in the display names the UI needs.
CREATE VIEW IF NOT EXISTS v_units AS
  SELECT u.*, p.name AS property_name
  FROM units u JOIN properties p ON p.id = u.property_id;

CREATE VIEW IF NOT EXISTS v_leases AS
  SELECT l.*, u.label AS unit_label, u.property_id, p.name AS property_name,
         t.first_name || ' ' || t.last_name AS tenant_name
  FROM leases l
  JOIN units u ON u.id = l.unit_id
  JOIN properties p ON p.id = u.property_id
  JOIN tenants t ON t.id = l.tenant_id;

CREATE VIEW IF NOT EXISTS v_payments AS
  SELECT pay.*, vl.tenant_name, vl.unit_label, vl.property_id, vl.property_name, vl.tenant_id
  FROM payments pay JOIN v_leases vl ON vl.id = pay.lease_id;

CREATE VIEW IF NOT EXISTS v_maintenance AS
  SELECT m.*, u.label AS unit_label, u.property_id, p.name AS property_name
  FROM maintenance m
  JOIN units u ON u.id = m.unit_id
  JOIN properties p ON p.id = u.property_id;

CREATE VIEW IF NOT EXISTS v_expenses AS
  SELECT e.*, p.name AS property_name
  FROM expenses e JOIN properties p ON p.id = e.property_id;

CREATE VIEW IF NOT EXISTS v_tenants AS
  SELECT t.*, t.first_name || ' ' || t.last_name AS full_name FROM tenants t;

CREATE VIEW IF NOT EXISTS v_properties AS
  SELECT p.*, (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id) AS unit_count
  FROM properties p;
`;

export function openDb(file = process.env.DB_FILE ?? 'data/sdlare.db') {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

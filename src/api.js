import { RESOURCES, validate, ValidationError, publicMeta, isValidDate } from './resources.js';
import { today, withStatus, ledger, dashboard, rentRoll } from './reports.js';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

function asOfParam(query) {
  const v = query.get('as_of');
  if (!v) return today();
  if (!isValidDate(v)) throw new HttpError(400, 'as_of must be a date (YYYY-MM-DD)');
  return v;
}

function getRow(db, resource, id) {
  const row = db.prepare(`SELECT * FROM ${RESOURCES[resource].view} WHERE id = ?`).get(id);
  if (!row) throw new HttpError(404, `${RESOURCES[resource].label} ${id} not found`);
  return row;
}

function checkRefs(db, resource, row) {
  const errors = {};
  for (const [name, spec] of Object.entries(RESOURCES[resource].fields)) {
    if (spec.type !== 'ref' || row[name] == null) continue;
    const found = db.prepare(`SELECT 1 FROM ${spec.ref} WHERE id = ?`).get(row[name]);
    if (!found) errors[name] = `${RESOURCES[spec.ref].label.toLowerCase()} ${row[name]} does not exist`;
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
}

// Cross-field rules that the per-field validator can't express. `row` is the
// full record as it will be saved.
function checkRules(db, resource, row, id = null) {
  if (resource === 'leases') {
    if (row.end_date && row.end_date < row.start_date) {
      throw new ValidationError({ end_date: 'must be on or after the start date' });
    }
    const clash = db.prepare(`
      SELECT id, tenant_name, start_date, end_date FROM v_leases
      WHERE unit_id = ? AND id IS NOT ?
        AND start_date <= COALESCE(?, '9999-12-31')
        AND COALESCE(end_date, '9999-12-31') >= ?
      LIMIT 1`).get(row.unit_id, id, row.end_date, row.start_date);
    if (clash) {
      throw new ValidationError({
        unit_id: `overlaps lease #${clash.id} (${clash.tenant_name}, ${clash.start_date} – ${clash.end_date ?? 'month-to-month'})`,
      });
    }
  }
  if (resource === 'maintenance') {
    if (row.status === 'closed' && !row.closed_on) row.closed_on = today();
    if (row.status !== 'closed') row.closed_on = null;
    if (row.closed_on && row.opened_on && row.closed_on < row.opened_on) {
      throw new ValidationError({ closed_on: 'must be on or after the opened date' });
    }
  }
}

function decorate(db, resource, row, asOf) {
  return resource === 'leases' ? withStatus(db, row, asOf) : row;
}

function list(db, resource, query) {
  const r = RESOURCES[resource];
  const where = [];
  const params = [];
  for (const f of r.filters) {
    const v = query.get(f);
    if (v !== null && v !== '') { where.push(`${f} = ?`); params.push(v); }
  }
  const sql = `SELECT * FROM ${r.view}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${r.order}`;
  const asOf = asOfParam(query);
  let rows = db.prepare(sql).all(...params).map((row) => decorate(db, resource, row, asOf));
  // Lease status is computed, so it's filtered after the query.
  const status = resource === 'leases' && query.get('status');
  if (status) rows = rows.filter((l) => l.status === status);
  return rows;
}

function create(db, resource, body) {
  const row = validate(resource, body);
  checkRefs(db, resource, row);
  if (resource === 'maintenance' && !row.opened_on) row.opened_on = today();
  checkRules(db, resource, row);
  const cols = Object.keys(row);
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO ${resource} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
  ).run(...cols.map((c) => row[c]));
  return getRow(db, resource, Number(lastInsertRowid));
}

function update(db, resource, id, body) {
  const existing = db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).get(id);
  if (!existing) throw new HttpError(404, `${RESOURCES[resource].label} ${id} not found`);
  const changes = validate(resource, body, { partial: true });
  checkRefs(db, resource, changes);
  const merged = { ...existing, ...changes };
  checkRules(db, resource, merged, id);
  // Rules may adjust derived columns (e.g. closed_on), so write every field.
  const cols = Object.keys(RESOURCES[resource].fields);
  db.prepare(`UPDATE ${resource} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .run(...cols.map((c) => merged[c] ?? null), id);
  return getRow(db, resource, id);
}

function remove(db, resource, id) {
  getRow(db, resource, id);
  db.prepare(`DELETE FROM ${resource} WHERE id = ?`).run(id);
}

function sqliteToHttp(err) {
  const msg = String(err.message);
  if (msg.includes('FOREIGN KEY constraint failed')) {
    return new HttpError(409, 'This record is still referenced by other records (e.g. leases or payments). Remove those first.');
  }
  if (msg.includes('UNIQUE constraint failed')) {
    return new HttpError(409, 'A record with the same identifying values already exists.');
  }
  return err;
}

// Routes an API request. Returns { status, body }.
export function handleApi(db, method, pathname, query, body) {
  const parts = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const [resource, rawId, sub] = parts;

  if (method === 'GET' && resource === 'meta' && !rawId) return { status: 200, body: publicMeta() };
  if (method === 'GET' && resource === 'dashboard' && !rawId) return { status: 200, body: dashboard(db, asOfParam(query)) };
  if (method === 'GET' && resource === 'rent-roll' && !rawId) return { status: 200, body: rentRoll(db, asOfParam(query)) };

  if (!RESOURCES[resource]) throw new HttpError(404, `Unknown endpoint /api/${parts.join('/')}`);

  let id = null;
  if (rawId !== undefined) {
    id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  }

  if (resource === 'leases' && id && sub === 'ledger' && method === 'GET') {
    const lease = getRow(db, 'leases', id);
    return { status: 200, body: ledger(db, lease, asOfParam(query)) };
  }
  if (sub !== undefined) throw new HttpError(404, `Unknown endpoint /api/${parts.join('/')}`);

  try {
    if (id === null) {
      if (method === 'GET') return { status: 200, body: list(db, resource, query) };
      if (method === 'POST') {
        const row = create(db, resource, body);
        return { status: 201, body: decorate(db, resource, row, today()) };
      }
    } else {
      if (method === 'GET') return { status: 200, body: decorate(db, resource, getRow(db, resource, id), asOfParam(query)) };
      if (method === 'PATCH' || method === 'PUT') {
        return { status: 200, body: decorate(db, resource, update(db, resource, id, body), today()) };
      }
      if (method === 'DELETE') { remove(db, resource, id); return { status: 204, body: null }; }
    }
  } catch (err) {
    throw sqliteToHttp(err);
  }
  throw new HttpError(405, `${method} not allowed here`);
}

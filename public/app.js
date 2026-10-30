// SDLARE Rentals — single-page UI. Hash routes, no build step.

const view = document.getElementById('view');
const asOfInput = document.getElementById('as-of');
const state = { meta: null, rows: new Map() };

// ---------- helpers ----------

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
const pct = (n) => `${Math.round(n * 100)}%`;
const titleCase = (s) => String(s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const localToday = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const asOf = () => asOfInput.value || localToday();
const unitName = (r) => `${esc(r.property_name)} · ${esc(r.unit_label ?? r.label)}`;

const BADGES = {
  current: 'good', upcoming: 'info', ended: '',
  open: 'warn', in_progress: 'info', on_hold: '', closed: 'good',
  low: '', normal: 'info', high: 'warn', emergency: 'bad',
};
const badge = (v) => `<span class="badge ${BADGES[v] ?? ''}">${esc(titleCase(v))}</span>`;
const balanceCell = (n) => (n > 0.005 ? `<span class="neg">${money(n)}</span>` : n < -0.005 ? `<span class="pos">${money(n)} credit</span>` : money(0));

async function api(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error ?? res.statusText), { errors: data?.errors });
  return data;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 2600);
}

// Renders a table. columns: [{ label, cell(row) -> html, num?, wrap? }]
function table(columns, rows, { resource, empty = 'Nothing here yet.', editable = true } = {}) {
  if (resource) for (const r of rows) state.rows.set(`${resource}:${r.id}`, r);
  if (!rows.length) return `<div class="table-wrap"><div class="empty">${esc(empty)}</div></div>`;
  const cls = (c) => [c.num && 'num', c.wrap && 'wrap'].filter(Boolean).join(' ');
  const head = columns.map((c) => `<th class="${cls(c)}">${esc(c.label)}</th>`).join('') + (resource && editable ? '<th></th>' : '');
  const body = rows.map((r) => `<tr>${columns.map((c) => `<td class="${cls(c)}">${c.cell(r)}</td>`).join('')}${resource && editable ? `
    <td class="actions"><button class="btn small" data-action="edit" data-resource="${resource}" data-id="${r.id}">Edit</button>
    <button class="btn small danger" data-action="delete" data-resource="${resource}" data-id="${r.id}">Delete</button></td>` : ''}</tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// ---------- column definitions ----------

const COLUMNS = {
  properties: [
    { label: 'Name', cell: (r) => `<a href="#/properties/${r.id}">${esc(r.name)}</a>` },
    { label: 'Address', cell: (r) => esc([r.address, r.city, r.state].filter(Boolean).join(', ')) },
    { label: 'Type', cell: (r) => esc(titleCase(r.type)) },
    { label: 'Units', num: true, cell: (r) => r.unit_count },
  ],
  units: [
    { label: 'Property', cell: (r) => `<a href="#/properties/${r.property_id}">${esc(r.property_name)}</a>` },
    { label: 'Unit', cell: (r) => esc(r.label) },
    { label: 'Bd / Ba', cell: (r) => `${r.bedrooms ?? '—'} / ${r.bathrooms ?? '—'}` },
    { label: 'Sq ft', num: true, cell: (r) => (r.sqft ? r.sqft.toLocaleString() : '—') },
    { label: 'Market rent', num: true, cell: (r) => money(r.market_rent) },
  ],
  tenants: [
    { label: 'Name', cell: (r) => `<a href="#/tenants/${r.id}">${esc(r.full_name)}</a>` },
    { label: 'Email', cell: (r) => (r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : '—') },
    { label: 'Phone', cell: (r) => (r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : '—') },
  ],
  leases: [
    { label: 'Tenant', cell: (r) => `<a href="#/leases/${r.id}">${esc(r.tenant_name)}</a>` },
    { label: 'Unit', cell: unitName },
    { label: 'Term', cell: (r) => `${fmtDate(r.start_date)} – ${r.end_date ? fmtDate(r.end_date) : 'Month-to-month'}` },
    { label: 'Rent', num: true, cell: (r) => money(r.monthly_rent) },
    { label: 'Status', cell: (r) => badge(r.status) },
    { label: 'Balance', num: true, cell: (r) => balanceCell(r.balance) },
  ],
  payments: [
    { label: 'Date', cell: (r) => fmtDate(r.paid_on) },
    { label: 'Tenant', cell: (r) => `<a href="#/leases/${r.lease_id}">${esc(r.tenant_name)}</a>` },
    { label: 'Unit', cell: unitName },
    { label: 'Method', cell: (r) => esc(titleCase(r.method)) },
    { label: 'Amount', num: true, cell: (r) => money(r.amount) },
    { label: 'Memo', wrap: true, cell: (r) => esc(r.memo) },
  ],
  maintenance: [
    { label: 'Opened', cell: (r) => fmtDate(r.opened_on) },
    { label: 'Issue', wrap: true, cell: (r) => `<strong>${esc(r.title)}</strong>${r.description ? `<div class="muted">${esc(r.description)}</div>` : ''}` },
    { label: 'Unit', cell: unitName },
    { label: 'Priority', cell: (r) => badge(r.priority) },
    { label: 'Status', cell: (r) => badge(r.status) },
    { label: 'Vendor', cell: (r) => esc(r.vendor) || '—' },
    { label: 'Cost', num: true, cell: (r) => money(r.cost) },
  ],
  expenses: [
    { label: 'Date', cell: (r) => fmtDate(r.spent_on) },
    { label: 'Property', cell: (r) => `<a href="#/properties/${r.property_id}">${esc(r.property_name)}</a>` },
    { label: 'Category', cell: (r) => esc(titleCase(r.category)) },
    { label: 'Vendor', cell: (r) => esc(r.vendor) || '—' },
    { label: 'Amount', num: true, cell: (r) => money(r.amount) },
    { label: 'Memo', wrap: true, cell: (r) => esc(r.memo) },
  ],
};

const TITLES = {
  properties: 'Properties', units: 'Units', tenants: 'Tenants', leases: 'Leases',
  payments: 'Payments', maintenance: 'Maintenance', expenses: 'Expenses',
};

const FIELD_LABELS = {
  property_id: 'Property', unit_id: 'Unit', tenant_id: 'Tenant', lease_id: 'Lease',
  sqft: 'Square feet', zip: 'ZIP', paid_on: 'Date paid', spent_on: 'Date', opened_on: 'Opened', closed_on: 'Closed',
};
const LONG = new Set(['notes', 'description', 'address', 'memo', 'title']);

// How each referenced record is shown in a <select>.
const REF_LABEL = {
  properties: (r) => r.name,
  units: (r) => `${r.property_name} · ${r.label}`,
  tenants: (r) => r.full_name,
  leases: (r) => `${r.tenant_name} — ${r.property_name} · ${r.unit_label}${r.status === 'ended' ? ' (ended)' : ''}`,
};

// ---------- forms ----------

const modal = document.getElementById('modal');
const modalForm = document.getElementById('modal-form');
modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) modal.close(); });

async function openForm(resource, { record = null, defaults = {}, onSaved } = {}) {
  const spec = state.meta.resources[resource];
  const values = { ...defaults, ...(record ?? {}) };
  const refs = {};
  await Promise.all(Object.entries(spec.fields).filter(([, f]) => f.type === 'ref').map(async ([name, f]) => {
    refs[name] = await api('GET', `/${f.ref}?as_of=${asOf()}`);
  }));

  const input = (name, f) => {
    const v = values[name] ?? (record ? '' : f.default ?? '');
    const id = `f-${name}`;
    const req = f.required ? ' required' : '';
    switch (f.type) {
      case 'ref': {
        const opts = refs[name].map((r) => `<option value="${r.id}"${String(r.id) === String(v) ? ' selected' : ''}>${esc(REF_LABEL[f.ref](r))}</option>`).join('');
        return `<select id="${id}" name="${name}"${req}><option value="">Select…</option>${opts}</select>`;
      }
      case 'enum':
        return `<select id="${id}" name="${name}"${req}>${f.required ? '' : '<option value=""></option>'}${f.values.map((o) => `<option value="${o}"${o === v ? ' selected' : ''}>${esc(titleCase(o))}</option>`).join('')}</select>`;
      case 'longtext':
        return `<textarea id="${id}" name="${name}" rows="3">${esc(v)}</textarea>`;
      case 'date':
        return `<input id="${id}" type="date" name="${name}" value="${esc(v)}"${req}>`;
      case 'number':
      case 'integer':
        return `<input id="${id}" type="number" step="${f.type === 'integer' ? 1 : 'any'}" ${f.min !== undefined ? `min="${f.min}"` : ''} name="${name}" value="${esc(v)}"${req}>`;
      default:
        return `<input id="${id}" type="${name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}" name="${name}" value="${esc(v)}"${req}>`;
    }
  };

  document.getElementById('modal-title').textContent = `${record ? 'Edit' : 'New'} ${spec.label.toLowerCase()}`;
  document.getElementById('modal-body').innerHTML = Object.entries(spec.fields).map(([name, f]) => `
    <div class="field${f.type === 'longtext' || LONG.has(name) || f.type === 'ref' ? ' full' : ''}" data-field="${name}">
      <label for="f-${name}">${esc(FIELD_LABELS[name] ?? titleCase(name))}${f.required ? ' <span class="req">*</span>' : ''}</label>
      ${input(name, f)}
      <span class="err"></span>
    </div>`).join('');
  const errBox = document.getElementById('modal-error');
  errBox.hidden = true;

  // Picking a unit on a new lease pre-fills the rent from its market rent.
  if (resource === 'leases' && !record) {
    const unitSel = modalForm.elements.unit_id;
    unitSel.addEventListener('change', () => {
      const u = refs.unit_id.find((x) => String(x.id) === unitSel.value);
      if (u?.market_rent && !modalForm.elements.monthly_rent.value) modalForm.elements.monthly_rent.value = u.market_rent;
    });
  }

  modalForm.onsubmit = async (e) => {
    e.preventDefault();
    const body = {};
    for (const name of Object.keys(spec.fields)) body[name] = modalForm.elements[name].value;
    modalForm.querySelectorAll('.field').forEach((el) => { el.classList.remove('invalid'); el.querySelector('.err').textContent = ''; });
    errBox.hidden = true;
    try {
      const saved = record
        ? await api('PATCH', `/${resource}/${record.id}`, body)
        : await api('POST', `/${resource}`, body);
      modal.close();
      toast(`${spec.label} saved`);
      (onSaved ?? render)(saved);
    } catch (err) {
      if (err.errors) {
        for (const [name, msg] of Object.entries(err.errors)) {
          const el = modalForm.querySelector(`[data-field="${name}"]`);
          if (el) { el.classList.add('invalid'); el.querySelector('.err').textContent = msg; }
        }
      } else {
        errBox.textContent = err.message;
        errBox.hidden = false;
      }
    }
  };
  modal.showModal();
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, resource, id } = btn.dataset;
  const defaults = btn.dataset.defaults ? JSON.parse(btn.dataset.defaults) : {};
  if (action === 'new') openForm(resource, { defaults });
  if (action === 'edit') openForm(resource, { record: state.rows.get(`${resource}:${id}`) });
  if (action === 'delete') {
    if (!confirm(`Delete this ${state.meta.resources[resource].label.toLowerCase()}? This cannot be undone.`)) return;
    try {
      await api('DELETE', `/${resource}/${id}`);
      toast('Deleted');
      if (location.hash === `#/${resource}/${id}`) location.hash = `#/${resource}`;
      else render();
    } catch (err) {
      alert(err.message);
    }
  }
});

const newBtn = (resource, text, defaults) =>
  `<button class="btn primary" data-action="new" data-resource="${resource}"${defaults ? ` data-defaults='${esc(JSON.stringify(defaults))}'` : ''}>${esc(text ?? `+ New ${state.meta.resources[resource].label.toLowerCase()}`)}</button>`;

// ---------- views ----------

async function dashboardView() {
  const d = await api('GET', `/dashboard?as_of=${asOf()}`);
  const t = d.totals;
  const max = Math.max(1, ...d.cashflow.flatMap((c) => [c.income, c.expenses]));
  const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' });
  const prio = ['emergency', 'high', 'normal', 'low'].filter((p) => d.open_by_priority[p]).map((p) => `${badge(p)} ${d.open_by_priority[p]}`).join(' &nbsp; ');

  return `
    <div class="page-head"><h1>Dashboard</h1></div>
    <div class="grid kpis">
      <div class="card kpi"><div class="label">Occupancy</div><div class="value">${pct(t.occupancy_rate)}</div><div class="sub">${t.occupied} of ${t.units} units · ${t.properties} properties</div></div>
      <div class="card kpi"><div class="label">Scheduled rent</div><div class="value">${money(t.scheduled_rent)}</div><div class="sub">per month, current leases</div></div>
      <div class="card kpi"><div class="label">Collected this month</div><div class="value">${money(t.collected_this_month)}</div><div class="sub">through ${fmtDate(d.as_of)}</div></div>
      <div class="card kpi"><div class="label">Outstanding</div><div class="value ${t.outstanding > 0 ? 'neg' : ''}">${money(t.outstanding)}</div><div class="sub">${d.delinquent.length} lease${d.delinquent.length === 1 ? '' : 's'} with a balance</div></div>
      <div class="card kpi"><div class="label">Expenses this month</div><div class="value">${money(t.expenses_this_month)}</div><div class="sub">all properties</div></div>
      <div class="card kpi"><div class="label">Open work orders</div><div class="value">${t.open_work_orders}</div><div class="sub">${prio || 'none open'}</div></div>
    </div>
    <div class="grid two-col">
      <div class="card">
        <div class="section-head"><h2>Cash flow, last 6 months</h2><div class="legend"><span class="inc">Rent collected</span><span class="exp">Expenses</span></div></div>
        <div class="bars">${d.cashflow.map((c) => `
          <div class="bar-group" title="${monthLabel(c.month)}: in ${money(c.income)}, out ${money(c.expenses)}, net ${money(c.net)}">
            <div class="bar-pair"><div class="bar inc" style="height:${(c.income / max) * 100}%"></div><div class="bar exp" style="height:${(c.expenses / max) * 100}%"></div></div>
            <div class="bar-label">${monthLabel(c.month)}</div>
          </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <h2>Balances due</h2>
        ${table([
          { label: 'Tenant', cell: (r) => `<a href="#/leases/${r.id}">${esc(r.tenant_name)}</a>` },
          { label: 'Unit', cell: unitName },
          { label: 'Balance', num: true, cell: (r) => balanceCell(r.balance) },
        ], d.delinquent, { empty: 'Everyone is paid up.' })}
      </div>
      <div class="card">
        <h2>Leases ending in the next 60 days</h2>
        ${table([
          { label: 'Tenant', cell: (r) => `<a href="#/leases/${r.id}">${esc(r.tenant_name)}</a>` },
          { label: 'Unit', cell: unitName },
          { label: 'Ends', cell: (r) => fmtDate(r.end_date) },
          { label: 'Rent', num: true, cell: (r) => money(r.monthly_rent) },
        ], d.expiring, { empty: 'No leases ending soon.' })}
      </div>
      <div class="card">
        <h2>Vacant units</h2>
        ${table([
          { label: 'Unit', cell: (r) => `<a href="#/properties/${r.property_id ?? ''}">${unitName(r)}</a>` },
          { label: 'Market rent', num: true, cell: (r) => money(r.market_rent) },
          { label: '', cell: (r) => `<button class="btn small" data-action="new" data-resource="leases" data-defaults='${esc(JSON.stringify({ unit_id: r.id, monthly_rent: r.market_rent, start_date: asOf() }))}'>Lease it</button>` },
        ], d.vacant_units, { empty: 'Fully occupied.' })}
      </div>
    </div>`;
}

async function rentRollView() {
  const rows = await api('GET', `/rent-roll?as_of=${asOf()}`);
  const occupied = rows.filter((r) => r.lease_id);
  const sum = (k) => occupied.reduce((s, r) => s + (r[k] ?? 0), 0);
  return `
    <div class="page-head"><h1>Rent roll</h1><span class="spacer"></span><span class="muted">${occupied.length} of ${rows.length} units occupied as of ${fmtDate(asOf())}</span>
      <button class="btn" id="export-csv">Export CSV</button></div>
    ${table([
      { label: 'Property', cell: (r) => esc(r.property_name) },
      { label: 'Unit', cell: (r) => esc(r.unit_label) },
      { label: 'Tenant', cell: (r) => (r.lease_id ? `<a href="#/leases/${r.lease_id}">${esc(r.tenant_name)}</a>` : '<span class="badge warn">Vacant</span>') },
      { label: 'Lease start', cell: (r) => (r.lease_id ? fmtDate(r.start_date) : '') },
      { label: 'Lease end', cell: (r) => (r.lease_id ? (r.end_date ? fmtDate(r.end_date) : 'MTM') : '') },
      { label: 'Market rent', num: true, cell: (r) => money(r.market_rent) },
      { label: 'Actual rent', num: true, cell: (r) => (r.lease_id ? money(r.monthly_rent) : '—') },
      { label: 'Deposit', num: true, cell: (r) => (r.lease_id ? money(r.deposit) : '—') },
      { label: 'Balance', num: true, cell: (r) => (r.lease_id ? balanceCell(r.balance) : '—') },
    ], rows, { empty: 'Add properties and units to see the rent roll.' })}
    <p class="muted">Totals — actual rent ${money(sum('monthly_rent'))}/mo · deposits held ${money(sum('deposit'))} · outstanding ${money(occupied.reduce((s, r) => s + Math.max(0, r.balance), 0))}</p>`;
}

function exportCsv(rows) {
  const cols = ['property_name', 'unit_label', 'tenant_name', 'start_date', 'end_date', 'market_rent', 'monthly_rent', 'deposit', 'balance'];
  const q = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `rent-roll-${asOf()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// List page with optional filters. filterDefs: [{ name, label, options: [[value, text]] }]
async function listView(resource, params) {
  const filterDefs = [];
  const needProps = ['units', 'payments', 'expenses', 'maintenance', 'leases'].includes(resource);
  const properties = needProps ? await api('GET', '/properties') : [];
  if (needProps && properties.length > 1) filterDefs.push({ name: 'property_id', label: 'All properties', options: properties.map((p) => [p.id, p.name]) });
  if (resource === 'leases') filterDefs.push({ name: 'status', label: 'All statuses', options: ['current', 'upcoming', 'ended'].map((s) => [s, titleCase(s)]) });
  if (resource === 'maintenance') {
    filterDefs.push({ name: 'status', label: 'All statuses', options: state.meta.enums.maintenanceStatus.map((s) => [s, titleCase(s)]) });
    filterDefs.push({ name: 'priority', label: 'All priorities', options: state.meta.enums.priority.map((s) => [s, titleCase(s)]) });
  }
  if (resource === 'expenses') filterDefs.push({ name: 'category', label: 'All categories', options: state.meta.enums.expenseCategory.map((s) => [s, titleCase(s)]) });

  const qs = new URLSearchParams({ as_of: asOf() });
  for (const f of filterDefs) if (params.get(f.name)) qs.set(f.name, params.get(f.name));
  const rows = await api('GET', `/${resource}?${qs}`);

  const filters = filterDefs.map((f) => `<select data-filter="${f.name}"><option value="">${esc(f.label)}</option>${f.options.map(([v, t]) => `<option value="${v}"${String(v) === params.get(f.name) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`).join('');
  const total = ['payments', 'expenses'].includes(resource) ? `<span class="muted">${rows.length} records · ${money(rows.reduce((s, r) => s + r.amount, 0))}</span>` : '';

  return `
    <div class="page-head"><h1>${TITLES[resource]}</h1><div class="filters">${filters}</div><span class="spacer"></span>${total}${newBtn(resource)}</div>
    ${table(COLUMNS[resource], rows, { resource, empty: `No ${TITLES[resource].toLowerCase()} found.` })}`;
}

view.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-filter]');
  if (!sel) return;
  const [path, query = ''] = location.hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  if (sel.value) params.set(sel.dataset.filter, sel.value); else params.delete(sel.dataset.filter);
  location.hash = `${path}${params.size ? '?' + params : ''}`;
});

async function propertyDetail(id) {
  const [p, units, leases, work, expenses] = await Promise.all([
    api('GET', `/properties/${id}`),
    api('GET', `/units?property_id=${id}`),
    api('GET', `/leases?property_id=${id}&as_of=${asOf()}`),
    api('GET', `/maintenance?property_id=${id}`),
    api('GET', `/expenses?property_id=${id}`),
  ]);
  state.rows.set(`properties:${p.id}`, p);
  const current = leases.filter((l) => l.status === 'current');
  const occupied = new Map(current.map((l) => [l.unit_id, l]));
  const unitCols = [
    ...COLUMNS.units.slice(1),
    { label: 'Tenant', cell: (u) => (occupied.get(u.id) ? `<a href="#/leases/${occupied.get(u.id).id}">${esc(occupied.get(u.id).tenant_name)}</a>` : '<span class="badge warn">Vacant</span>') },
  ];
  return `
    <div class="crumbs"><a href="#/properties">Properties</a></div>
    <div class="page-head"><h1>${esc(p.name)}</h1><span class="badge">${esc(titleCase(p.type))}</span><span class="spacer"></span>
      <button class="btn" data-action="edit" data-resource="properties" data-id="${p.id}">Edit</button>
      <button class="btn danger" data-action="delete" data-resource="properties" data-id="${p.id}">Delete</button></div>
    <div class="grid kpis">
      <div class="card kpi"><div class="label">Address</div><div class="sub" style="font-size:14px;color:var(--text)">${esc(p.address)}<br>${esc([p.city, p.state, p.zip].filter(Boolean).join(', '))}</div></div>
      <div class="card kpi"><div class="label">Occupancy</div><div class="value">${occupied.size} / ${units.length}</div></div>
      <div class="card kpi"><div class="label">Monthly rent</div><div class="value">${money(current.reduce((s, l) => s + l.monthly_rent, 0))}</div></div>
      <div class="card kpi"><div class="label">Expenses (all time)</div><div class="value">${money(expenses.reduce((s, e) => s + e.amount, 0))}</div></div>
    </div>
    ${p.notes ? `<p class="muted">${esc(p.notes)}</p>` : ''}
    <div class="section"><div class="section-head"><h2>Units</h2>${newBtn('units', '+ Add unit', { property_id: p.id })}</div>${table(unitCols, units, { resource: 'units', empty: 'No units yet — add one to start leasing.' })}</div>
    <div class="section"><div class="section-head"><h2>Leases</h2>${newBtn('leases', '+ New lease')}</div>${table(COLUMNS.leases, leases, { resource: 'leases', empty: 'No leases.' })}</div>
    <div class="section"><div class="section-head"><h2>Maintenance</h2>${newBtn('maintenance', '+ New work order')}</div>${table(COLUMNS.maintenance, work, { resource: 'maintenance', empty: 'No work orders.' })}</div>
    <div class="section"><div class="section-head"><h2>Expenses</h2>${newBtn('expenses', '+ Add expense', { property_id: p.id, spent_on: localToday() })}</div>${table(COLUMNS.expenses.filter((c) => c.label !== 'Property'), expenses, { resource: 'expenses', empty: 'No expenses recorded.' })}</div>`;
}

async function tenantDetail(id) {
  const [t, leases, payments] = await Promise.all([
    api('GET', `/tenants/${id}`),
    api('GET', `/leases?tenant_id=${id}&as_of=${asOf()}`),
    api('GET', `/payments?tenant_id=${id}`),
  ]);
  state.rows.set(`tenants:${t.id}`, t);
  return `
    <div class="crumbs"><a href="#/tenants">Tenants</a></div>
    <div class="page-head"><h1>${esc(t.full_name)}</h1><span class="spacer"></span>
      <button class="btn" data-action="edit" data-resource="tenants" data-id="${t.id}">Edit</button>
      <button class="btn danger" data-action="delete" data-resource="tenants" data-id="${t.id}">Delete</button></div>
    <div class="card"><dl class="detail-list">
      <dt>Email</dt><dd>${t.email ? `<a href="mailto:${esc(t.email)}">${esc(t.email)}</a>` : '—'}</dd>
      <dt>Phone</dt><dd>${t.phone ? `<a href="tel:${esc(t.phone)}">${esc(t.phone)}</a>` : '—'}</dd>
      <dt>Notes</dt><dd>${esc(t.notes) || '—'}</dd>
    </dl></div>
    <div class="section"><div class="section-head"><h2>Leases</h2>${newBtn('leases', '+ New lease', { tenant_id: t.id })}</div>${table(COLUMNS.leases, leases, { resource: 'leases', empty: 'No leases.' })}</div>
    <div class="section"><div class="section-head"><h2>Payments</h2></div>${table(COLUMNS.payments.filter((c) => c.label !== 'Tenant'), payments, { resource: 'payments', empty: 'No payments.' })}</div>`;
}

async function leaseDetail(id) {
  const { lease: l, entries } = await api('GET', `/leases/${id}/ledger?as_of=${asOf()}`);
  state.rows.set(`leases:${l.id}`, l);
  const payments = await api('GET', `/payments?lease_id=${id}`);
  for (const p of payments) state.rows.set(`payments:${p.id}`, p);
  const suggested = l.balance > 0 ? l.balance : l.monthly_rent;
  return `
    <div class="crumbs"><a href="#/leases">Leases</a></div>
    <div class="page-head"><h1>${esc(l.tenant_name)}</h1>${badge(l.status)}<span class="spacer"></span>
      ${newBtn('payments', '+ Record payment', { lease_id: l.id, paid_on: localToday(), amount: suggested })}
      <button class="btn" data-action="edit" data-resource="leases" data-id="${l.id}">Edit</button>
      <button class="btn danger" data-action="delete" data-resource="leases" data-id="${l.id}">Delete</button></div>
    <div class="grid kpis">
      <div class="card kpi"><div class="label">Unit</div><div class="sub" style="font-size:14px;color:var(--text)"><a href="#/properties/${l.property_id}">${esc(l.property_name)}</a> · ${esc(l.unit_label)}</div></div>
      <div class="card kpi"><div class="label">Term</div><div class="sub" style="font-size:14px;color:var(--text)">${fmtDate(l.start_date)} –<br>${l.end_date ? fmtDate(l.end_date) : 'Month-to-month'}</div></div>
      <div class="card kpi"><div class="label">Rent / deposit</div><div class="value">${money(l.monthly_rent)}</div><div class="sub">${money(l.deposit)} deposit</div></div>
      <div class="card kpi"><div class="label">Balance as of ${fmtDate(asOf())}</div><div class="value">${balanceCell(l.balance)}</div><div class="sub">${money(l.charged)} charged · ${money(l.paid)} paid</div></div>
    </div>
    ${l.notes ? `<p class="muted">${esc(l.notes)}</p>` : ''}
    <div class="section"><div class="section-head"><h2>Ledger</h2></div>
    ${table([
      { label: 'Date', cell: (e) => fmtDate(e.date) },
      { label: 'Description', wrap: true, cell: (e) => esc(e.description) },
      { label: 'Charge', num: true, cell: (e) => (e.kind === 'charge' ? money(e.amount) : '') },
      { label: 'Payment', num: true, cell: (e) => (e.kind === 'payment' ? money(-e.amount) : '') },
      { label: 'Balance', num: true, cell: (e) => balanceCell(e.balance) },
      { label: '', cell: (e) => (e.payment_id ? `<button class="btn small" data-action="edit" data-resource="payments" data-id="${e.payment_id}">Edit</button> <button class="btn small danger" data-action="delete" data-resource="payments" data-id="${e.payment_id}">Delete</button>` : '') },
    ], entries.slice().reverse(), { empty: 'No charges yet — the lease has not started.' })}</div>`;
}

// ---------- router ----------

const ROUTES = [
  [/^\/?$/, () => dashboardView()],
  [/^\/dashboard$/, () => dashboardView()],
  [/^\/rent-roll$/, () => rentRollView()],
  [/^\/properties\/(\d+)$/, (m) => propertyDetail(m[1])],
  [/^\/tenants\/(\d+)$/, (m) => tenantDetail(m[1])],
  [/^\/leases\/(\d+)$/, (m) => leaseDetail(m[1])],
  [/^\/(properties|units|tenants|leases|payments|maintenance|expenses)$/, (m, params) => listView(m[1], params)],
];

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const [path, query = ''] = location.hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', path.split('/')[1] === a.dataset.nav || (path === '' && a.dataset.nav === 'dashboard')));
  document.getElementById('sidebar').classList.remove('open');
  state.rows.clear();
  let html;
  try {
    const route = ROUTES.find(([re]) => re.test(path));
    html = route ? await route[1](path.match(route[0]), params) : '<div class="empty">Page not found.</div>';
  } catch (err) {
    html = `<div class="card"><h2>Something went wrong</h2><p class="neg">${esc(err.message)}</p></div>`;
  }
  if (seq !== renderSeq) return;
  view.innerHTML = html;
  if (path === '/rent-roll') {
    document.getElementById('export-csv')?.addEventListener('click', async () => exportCsv(await api('GET', `/rent-roll?as_of=${asOf()}`)));
  }
}

asOfInput.addEventListener('change', render);
document.getElementById('menu-toggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
window.addEventListener('hashchange', () => { if (modal.open) modal.close(); render(); });

(async () => {
  asOfInput.value = localToday();
  state.meta = await api('GET', '/meta');
  render();
})();

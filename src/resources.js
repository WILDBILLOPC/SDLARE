// Field specs for each CRUD resource. The API validates against these and the
// UI fetches them from /api/meta to build its forms.
//   type: text | longtext | number | integer | date | enum | ref
//   required: reject missing/empty values
//   ref: name of the resource a foreign key points to

export const ENUMS = {
  propertyType: ['single_family', 'multifamily', 'condo', 'townhouse', 'commercial', 'mixed_use'],
  paymentMethod: ['ach', 'check', 'cash', 'card', 'zelle', 'other'],
  priority: ['low', 'normal', 'high', 'emergency'],
  maintenanceStatus: ['open', 'in_progress', 'on_hold', 'closed'],
  expenseCategory: [
    'repairs', 'utilities', 'insurance', 'property_tax', 'mortgage_interest',
    'management', 'landscaping', 'cleaning', 'legal', 'advertising', 'supplies', 'other',
  ],
};

export const RESOURCES = {
  properties: {
    label: 'Property',
    view: 'v_properties',
    order: 'name',
    filters: ['type'],
    fields: {
      name: { type: 'text', required: true },
      address: { type: 'text', required: true },
      city: { type: 'text' },
      state: { type: 'text' },
      zip: { type: 'text' },
      type: { type: 'enum', values: ENUMS.propertyType, default: 'multifamily' },
      notes: { type: 'longtext' },
    },
  },
  units: {
    label: 'Unit',
    view: 'v_units',
    order: 'property_name, label',
    filters: ['property_id'],
    fields: {
      property_id: { type: 'ref', ref: 'properties', required: true },
      label: { type: 'text', required: true },
      bedrooms: { type: 'number', min: 0 },
      bathrooms: { type: 'number', min: 0 },
      sqft: { type: 'integer', min: 0 },
      market_rent: { type: 'number', min: 0 },
    },
  },
  tenants: {
    label: 'Tenant',
    view: 'v_tenants',
    order: 'last_name, first_name',
    filters: [],
    fields: {
      first_name: { type: 'text', required: true },
      last_name: { type: 'text', required: true },
      email: { type: 'text', pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ },
      phone: { type: 'text' },
      notes: { type: 'longtext' },
    },
  },
  leases: {
    label: 'Lease',
    view: 'v_leases',
    order: 'start_date DESC',
    filters: ['unit_id', 'tenant_id', 'property_id'],
    fields: {
      unit_id: { type: 'ref', ref: 'units', required: true },
      tenant_id: { type: 'ref', ref: 'tenants', required: true },
      start_date: { type: 'date', required: true },
      end_date: { type: 'date' },
      monthly_rent: { type: 'number', required: true, min: 0 },
      deposit: { type: 'number', min: 0, default: 0 },
      notes: { type: 'longtext' },
    },
  },
  payments: {
    label: 'Payment',
    view: 'v_payments',
    order: 'paid_on DESC, id DESC',
    filters: ['lease_id', 'tenant_id', 'property_id'],
    fields: {
      lease_id: { type: 'ref', ref: 'leases', required: true },
      paid_on: { type: 'date', required: true },
      amount: { type: 'number', required: true, min: 0.01 },
      method: { type: 'enum', values: ENUMS.paymentMethod, default: 'other' },
      memo: { type: 'text' },
    },
  },
  maintenance: {
    label: 'Work order',
    view: 'v_maintenance',
    order: "CASE status WHEN 'closed' THEN 1 ELSE 0 END, CASE priority WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, opened_on DESC",
    filters: ['unit_id', 'property_id', 'status', 'priority'],
    fields: {
      unit_id: { type: 'ref', ref: 'units', required: true },
      title: { type: 'text', required: true },
      description: { type: 'longtext' },
      priority: { type: 'enum', values: ENUMS.priority, default: 'normal' },
      status: { type: 'enum', values: ENUMS.maintenanceStatus, default: 'open' },
      vendor: { type: 'text' },
      cost: { type: 'number', min: 0 },
      opened_on: { type: 'date' },
      closed_on: { type: 'date' },
    },
  },
  expenses: {
    label: 'Expense',
    view: 'v_expenses',
    order: 'spent_on DESC, id DESC',
    filters: ['property_id', 'category'],
    fields: {
      property_id: { type: 'ref', ref: 'properties', required: true },
      spent_on: { type: 'date', required: true },
      category: { type: 'enum', values: ENUMS.expenseCategory, default: 'other' },
      amount: { type: 'number', required: true, min: 0.01 },
      vendor: { type: 'text' },
      memo: { type: 'text' },
    },
  },
};

export class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.status = 400;
    this.errors = errors;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Returns a clean row of column -> value. With partial=true (PATCH), only the
// supplied fields are checked and returned.
export function validate(resource, input, { partial = false } = {}) {
  const { fields } = RESOURCES[resource];
  const out = {};
  const errors = {};

  for (const [name, spec] of Object.entries(fields)) {
    let v = input?.[name];
    if (partial && !(name in (input ?? {}))) continue;
    if (typeof v === 'string') v = v.trim();
    const empty = v === undefined || v === null || v === '';

    if (empty) {
      if (spec.required) errors[name] = 'is required';
      else if (!partial && spec.default !== undefined) out[name] = spec.default;
      else out[name] = null;
      continue;
    }

    switch (spec.type) {
      case 'number':
      case 'integer':
      case 'ref': {
        const n = Number(v);
        if (!Number.isFinite(n)) { errors[name] = 'must be a number'; break; }
        if ((spec.type !== 'number') && !Number.isInteger(n)) { errors[name] = 'must be a whole number'; break; }
        if (spec.min !== undefined && n < spec.min) { errors[name] = `must be at least ${spec.min}`; break; }
        out[name] = n;
        break;
      }
      case 'date':
        if (!isValidDate(v)) errors[name] = 'must be a date (YYYY-MM-DD)';
        else out[name] = v;
        break;
      case 'enum':
        if (!spec.values.includes(v)) errors[name] = `must be one of: ${spec.values.join(', ')}`;
        else out[name] = v;
        break;
      default:
        if (typeof v !== 'string') { errors[name] = 'must be text'; break; }
        if (spec.pattern && !spec.pattern.test(v)) { errors[name] = 'is not valid'; break; }
        out[name] = v;
    }
  }

  if (Object.keys(errors).length) throw new ValidationError(errors);
  return out;
}

// Serializable copy for the UI (RegExps dropped).
export function publicMeta() {
  const resources = {};
  for (const [key, r] of Object.entries(RESOURCES)) {
    const fields = {};
    for (const [name, { pattern, ...spec }] of Object.entries(r.fields)) fields[name] = spec;
    resources[key] = { label: r.label, filters: r.filters, fields };
  }
  return { resources, enums: ENUMS };
}

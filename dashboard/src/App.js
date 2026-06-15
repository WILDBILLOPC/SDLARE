import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';
import {
  uid,
  monthKey,
  isOccupied,
  formatMoney,
  formatPct,
  toAmount,
  computeMetrics,
  propertyPL,
  loadProperties,
  saveProperties,
} from './rentals';

const ACTIVITY_KEY = 'sdlare.activity.v1';

// ── Rental store hook ──────────────────────────────────────
// Single source of truth for property data + an activity log, persisted to
// localStorage. All tabs read from the value this returns.
function useRentals() {
  const [properties, setProperties] = useState(() => loadProperties());
  const [activity, setActivity] = useState(() => {
    try {
      const raw = window.localStorage.getItem(ACTIVITY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => { saveProperties(properties); }, [properties]);
  useEffect(() => {
    try { window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity)); } catch { /* noop */ }
  }, [activity]);

  const log = useCallback((text) => {
    setActivity((prev) => [{ id: uid(), text, time: Date.now() }, ...prev].slice(0, 50));
  }, []);

  const addProperty = useCallback(({ name, address }) => {
    const prop = { id: uid(), name: name.trim() || 'Untitled Property', address: address.trim(), units: [], expenses: [] };
    setProperties((prev) => [...prev, prop]);
    log(`Added property "${prop.name}"`);
  }, [log]);

  const removeProperty = useCallback((id) => {
    setProperties((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) log(`Removed property "${gone.name}"`);
      return prev.filter((p) => p.id !== id);
    });
  }, [log]);

  const addUnit = useCallback((propId, data) => {
    setProperties((prev) => prev.map((p) => p.id !== propId ? p : {
      ...p,
      units: [...p.units, {
        id: uid(),
        label: data.label.trim() || 'Unit',
        tenant: data.tenant.trim(),
        rent: toAmount(data.rent),
        leaseStart: data.leaseStart || '',
        leaseEnd: data.leaseEnd || '',
        payments: {},
      }],
    }));
    log(`Added unit "${data.label || 'Unit'}"`);
  }, [log]);

  const removeUnit = useCallback((propId, unitId) => {
    setProperties((prev) => prev.map((p) => p.id !== propId ? p : {
      ...p, units: p.units.filter((u) => u.id !== unitId),
    }));
  }, []);

  const togglePayment = useCallback((propId, unitId, month) => {
    setProperties((prev) => prev.map((p) => {
      if (p.id !== propId) return p;
      return {
        ...p,
        units: p.units.map((u) => {
          if (u.id !== unitId) return u;
          const current = (u.payments || {})[month];
          const next = current === 'paid' ? 'outstanding' : 'paid';
          if (next === 'paid') log(`Rent collected — ${u.tenant || u.label} (${formatMoney(toAmount(u.rent))})`);
          return { ...u, payments: { ...u.payments, [month]: next } };
        }),
      };
    }));
  }, [log]);

  const addExpense = useCallback((propId, data) => {
    setProperties((prev) => prev.map((p) => p.id !== propId ? p : {
      ...p,
      expenses: [...p.expenses, { id: uid(), category: data.category.trim() || 'Expense', amount: toAmount(data.amount) }],
    }));
  }, []);

  const removeExpense = useCallback((propId, expId) => {
    setProperties((prev) => prev.map((p) => p.id !== propId ? p : {
      ...p, expenses: p.expenses.filter((e) => e.id !== expId),
    }));
  }, []);

  return { properties, activity, addProperty, removeProperty, addUnit, removeUnit, togglePayment, addExpense, removeExpense };
}

// ── Tab Components ─────────────────────────────────────────
const OverviewTab = ({ metrics }) => (
  <div className="tab-content">
    <div className="stats-grid">
      <StatCard label="Monthly Income" value={formatMoney(metrics.scheduledRent)} sub={`${metrics.propertyCount} props`} color="green" />
      <StatCard label="Total Expenses" value={formatMoney(metrics.monthlyExpenses)} sub="all categories" color="red" />
      <StatCard label="Net Cashflow" value={formatMoney(metrics.netCashflow)} sub="income minus expenses" color="cyan" />
      <StatCard label="Outstanding" value={formatMoney(metrics.outstandingRent)} sub={`${metrics.outstandingUnits} units`} color="orange" />
    </div>
    <div className="panel-row">
      <div className="panel">
        <div className="panel-title">PAYMENT STATUS</div>
        <div className="panel-body">
          <div className="occupancy-row">
            <span>OCCUPANCY</span>
            <span className="badge-cyan">{formatPct(metrics.occupancyRate)}</span>
          </div>
          <div className="occupancy-row" style={{ marginTop: '0.75rem' }}>
            <span>RENT COLLECTED</span>
            <span className="badge-cyan">{formatPct(metrics.collectionRate)}</span>
          </div>
          <div className="occupancy-row" style={{ marginTop: '0.75rem' }}>
            <span>OCCUPIED UNITS</span>
            <span className="badge-cyan">{metrics.occupiedUnits} / {metrics.totalUnits}</span>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">INCOME VS EXPENSES</div>
        <div className="panel-body">
          {[
            ['Gross rent collected', formatMoney(metrics.collectedRent), 'green'],
            ['Outstanding rent', formatMoney(metrics.outstandingRent), 'orange'],
            ['Total expenses', formatMoney(metrics.monthlyExpenses), 'red'],
            ['Net cashflow', formatMoney(metrics.netCashflow), 'cyan'],
            ['Annual projection', formatMoney(metrics.annualProjection), 'cyan'],
          ].map(([label, val, color]) => (
            <div className="ie-row" key={label}>
              <span>{label}</span>
              <span className={`val-${color}`}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const RentalsTab = ({ store, month }) => {
  const [showProp, setShowProp] = useState(false);
  const [unitFor, setUnitFor] = useState(null);    // propId awaiting a new unit
  const [expenseFor, setExpenseFor] = useState(null); // propId awaiting a new expense
  const { properties } = store;

  if (properties.length === 0) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-icon">🏠</div>
          <div className="empty-title">No Properties Yet</div>
          <div className="empty-sub">Add your first property to start tracking rentals</div>
          <button className="btn-primary" onClick={() => setShowProp(true)}>+ ADD PROPERTY</button>
        </div>
        {showProp && <PropertyForm onClose={() => setShowProp(false)} onSave={(d) => { store.addProperty(d); setShowProp(false); }} />}
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="section-head">
        <h2>Properties</h2>
        <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => setShowProp(true)}>+ ADD PROPERTY</button>
      </div>
      <div className="prop-list">
        {properties.map((prop) => {
          const pl = propertyPL(prop, month);
          const occupied = (prop.units || []).filter(isOccupied).length;
          return (
            <div className="prop-card" key={prop.id}>
              <div className="prop-card-head">
                <div>
                  <div className="prop-name">{prop.name}</div>
                  {prop.address && <div className="prop-addr">{prop.address}</div>}
                </div>
                <div className="prop-metrics">
                  <div className="prop-metric"><div className="pm-val val-green">{formatMoney(pl.income)}</div><div className="pm-label">Rent</div></div>
                  <div className="prop-metric"><div className="pm-val val-cyan">{formatMoney(pl.net)}</div><div className="pm-label">Net</div></div>
                  <div className="prop-metric"><div className="pm-val">{occupied}/{prop.units.length}</div><div className="pm-label">Occ</div></div>
                  <button className="btn-danger" onClick={() => store.removeProperty(prop.id)}>Delete</button>
                </div>
              </div>

              {prop.units.length > 0 && (
                <table className="unit-table">
                  <thead>
                    <tr><th>Unit</th><th>Tenant</th><th>Lease</th><th className="num">Rent</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {prop.units.map((u) => {
                      const occ = isOccupied(u);
                      const status = (u.payments || {})[month];
                      const cls = !occ ? 'pay-vacant' : status === 'paid' ? 'pay-paid' : 'pay-outstanding';
                      const txt = !occ ? 'Vacant' : status === 'paid' ? 'Paid' : 'Outstanding';
                      return (
                        <tr key={u.id}>
                          <td>{u.label}</td>
                          <td>{u.tenant || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                          <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{u.leaseStart || '—'}{u.leaseEnd ? ` → ${u.leaseEnd}` : ''}</td>
                          <td className="num">{formatMoney(toAmount(u.rent))}</td>
                          <td>
                            <button className={`pay-toggle ${cls}`} disabled={!occ}
                              onClick={() => occ && store.togglePayment(prop.id, u.id, month)}>{txt}</button>
                          </td>
                          <td><button className="btn-danger" onClick={() => store.removeUnit(prop.id, u.id)}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {prop.expenses.length > 0 && (
                <>
                  <div className="sub-head"><span>Monthly Expenses</span></div>
                  {prop.expenses.map((e) => (
                    <div className="expense-row" key={e.id}>
                      <span>{e.category}</span>
                      <span><span className="val-red" style={{ fontFamily: "'Share Tech Mono', monospace" }}>{formatMoney(toAmount(e.amount))}</span>
                        <button className="btn-danger" style={{ marginLeft: 8 }} onClick={() => store.removeExpense(prop.id, e.id)}>✕</button></span>
                    </div>
                  ))}
                </>
              )}

              <div className="sub-head" style={{ paddingBottom: '0.9rem' }}>
                <button className="btn-secondary" onClick={() => setUnitFor(prop.id)}>+ Unit</button>
                <button className="btn-secondary" onClick={() => setExpenseFor(prop.id)}>+ Expense</button>
              </div>
            </div>
          );
        })}
      </div>

      {showProp && <PropertyForm onClose={() => setShowProp(false)} onSave={(d) => { store.addProperty(d); setShowProp(false); }} />}
      {unitFor && <UnitForm onClose={() => setUnitFor(null)} onSave={(d) => { store.addUnit(unitFor, d); setUnitFor(null); }} />}
      {expenseFor && <ExpenseForm onClose={() => setExpenseFor(null)} onSave={(d) => { store.addExpense(expenseFor, d); setExpenseFor(null); }} />}
    </div>
  );
};

const FXTab = () => {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pairs = ['MXN', 'EUR', 'GBP', 'CAD'];
    Promise.all(
      pairs.map(t =>
        fetch(`https://api.frankfurter.dev/latest?from=USD&to=${t}`)
          .then(r => r.json())
          .then(d => ({ pair: `USD/${t}`, rate: d.rates[t] }))
      )
    ).then(results => {
      setRates(results);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="tab-content">
      <div className="panel-title" style={{marginBottom: '1.5rem'}}>LIVE FX RATES — USD BASE</div>
      {loading ? (
        <div className="loading-pulse">Fetching rates...</div>
      ) : (
        <div className="fx-grid">
          {rates?.map(({ pair, rate }) => (
            <div className="fx-card" key={pair}>
              <div className="fx-pair">{pair}</div>
              <div className="fx-rate">{rate?.toFixed(4)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ActivityTab = ({ activity }) => {
  if (!activity || activity.length === 0) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-title">No Activity Yet</div>
          <div className="empty-sub">Transactions and events will appear here</div>
        </div>
      </div>
    );
  }
  return (
    <div className="tab-content">
      <div className="panel">
        <div className="panel-title">RECENT ACTIVITY</div>
        <div className="panel-body activity-feed">
          {activity.map((a) => (
            <div className="activity-item" key={a.id}>
              <span>{a.text}</span>
              <span className="activity-time">{new Date(a.time).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PLTab = ({ properties, metrics, month }) => {
  if (properties.length === 0) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <div className="empty-title">P&amp;L Coming Soon</div>
          <div className="empty-sub">Connect your properties to generate P&amp;L reports</div>
        </div>
      </div>
    );
  }
  const rows = properties.map((p) => propertyPL(p, month));
  return (
    <div className="tab-content">
      <div className="panel">
        <div className="panel-title">PROFIT &amp; LOSS — {month}</div>
        <table className="pl-table">
          <thead>
            <tr><th>Property</th><th className="num">Income</th><th className="num">Expenses</th><th className="num">Net</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="num val-green">{formatMoney(r.income)}</td>
                <td className="num val-red">{formatMoney(r.expenses)}</td>
                <td className={`num val-${r.net >= 0 ? 'cyan' : 'red'}`}>{formatMoney(r.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>TOTAL</td>
              <td className="num val-green">{formatMoney(metrics.scheduledRent)}</td>
              <td className="num val-red">{formatMoney(metrics.monthlyExpenses)}</td>
              <td className="num val-cyan">{formatMoney(metrics.projectedCashflow)}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text-dim)' }}>ANNUAL PROJECTION</td>
              <td colSpan={3} className="num val-cyan">{formatMoney(metrics.annualProjection)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ── Forms ──────────────────────────────────────────────────
const Modal = ({ title, children, onClose, onSave }) => (
  <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal">
      <div className="modal-title">{title}</div>
      <div className="modal-body">{children}</div>
      <div className="modal-foot">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" style={{ marginTop: 0 }} onClick={onSave}>Save</button>
      </div>
    </div>
  </div>
);

const Field = ({ label, ...props }) => (
  <div className="field">
    <label>{label}</label>
    <input {...props} />
  </div>
);

const PropertyForm = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  return (
    <Modal title="Add Property" onClose={onClose} onSave={() => onSave({ name, address })}>
      <Field label="Name" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Logan Heights Duplex" />
      <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, San Diego" />
    </Modal>
  );
};

const UnitForm = ({ onClose, onSave }) => {
  const [f, setF] = useState({ label: '', tenant: '', rent: '', leaseStart: '', leaseEnd: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Add Unit" onClose={onClose} onSave={() => onSave(f)}>
      <div className="field-row">
        <Field label="Unit label" value={f.label} autoFocus onChange={set('label')} placeholder="Unit A" />
        <Field label="Monthly rent" type="number" min="0" value={f.rent} onChange={set('rent')} placeholder="2200" />
      </div>
      <Field label="Tenant (leave blank if vacant)" value={f.tenant} onChange={set('tenant')} placeholder="Ana García" />
      <div className="field-row">
        <Field label="Lease start" type="date" value={f.leaseStart} onChange={set('leaseStart')} />
        <Field label="Lease end" type="date" value={f.leaseEnd} onChange={set('leaseEnd')} />
      </div>
    </Modal>
  );
};

const ExpenseForm = ({ onClose, onSave }) => {
  const [f, setF] = useState({ category: '', amount: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Add Monthly Expense" onClose={onClose} onSave={() => onSave(f)}>
      <Field label="Category" value={f.category} autoFocus onChange={set('category')} placeholder="Property tax / HOA / Insurance" />
      <Field label="Monthly amount" type="number" min="0" value={f.amount} onChange={set('amount')} placeholder="450" />
    </Modal>
  );
};

// ── Reusable Components ─────────────────────────────────────
const StatCard = ({ label, value, sub, color }) => (
  <div className="stat-card">
    <div className="stat-label">{label.toUpperCase()}</div>
    <div className={`stat-value val-${color}`}>{value}</div>
    <div className="stat-sub">{sub}</div>
  </div>
);

// ── Clock ───────────────────────────────────────────────────
const Clock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="clock">
      <span className="clock-time">
        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <span className="clock-date">
        {time.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
      </span>
    </div>
  );
};

// ── Main App ────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'rentals', label: 'RENTALS' },
  { id: 'fx', label: 'FX ENGINE' },
  { id: 'activity', label: 'ACTIVITY' },
  { id: 'pl', label: 'P&L' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const store = useRentals();
  const month = monthKey();
  const metrics = useMemo(() => computeMetrics(store.properties, month), [store.properties, month]);

  const renderTab = () => {
    switch (activeTab) {
      case 'rentals': return <RentalsTab store={store} month={month} />;
      case 'fx': return <FXTab />;
      case 'activity': return <ActivityTab activity={store.activity} />;
      case 'pl': return <PLTab properties={store.properties} metrics={metrics} month={month} />;
      case 'overview':
      default: return <OverviewTab metrics={metrics} />;
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo-mark">S</div>
          <div className="logo-text">
            <span className="logo-name">SDLARE</span>
            <span className="logo-sub">San Diego Lending &amp; Real Estate</span>
          </div>
        </div>
        <Clock />
      </header>

      {/* Top Nav */}
      <nav className="top-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="main">
        {renderTab()}
      </main>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`bottom-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

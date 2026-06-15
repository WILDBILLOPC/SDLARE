import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';
import {
  uid,
  monthKey,
  isOccupied,
  formatMoney,
  formatDual,
  formatPct,
  toAmount,
  normalizeRate,
  computeMetrics,
  propertyPL,
  groupByBuilding,
  grandTotal,
  loadProperties,
  saveProperties,
  loadSettings,
  saveSettings,
  sampleProperties,
  CURRENCIES,
  EXPENSE_CATEGORIES,
} from './rentals';

const ACTIVITY_KEY = 'sdlare.activity.v1';

// ── Rental store hook ──────────────────────────────────────
// Single source of truth for property data, settings and an activity log,
// persisted to localStorage. A 'storage' listener keeps pop-out windows in
// sync with the main window (same origin shares localStorage).
function useRentals() {
  const [properties, setProperties] = useState(() => loadProperties());
  const [settings, setSettings] = useState(() => loadSettings());
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
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => {
    try { window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity)); } catch { /* noop */ }
  }, [activity]);

  // Cross-window sync: reload when another window writes our keys.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === null || e.key === 'sdlare.rentals.v1') setProperties(loadProperties());
      if (e.key === null || e.key === 'sdlare.settings.v1') setSettings(loadSettings());
      if (e.key === null || e.key === ACTIVITY_KEY) {
        try {
          const raw = window.localStorage.getItem(ACTIVITY_KEY);
          setActivity(raw ? JSON.parse(raw) : []);
        } catch { /* noop */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const log = useCallback((text) => {
    setActivity((prev) => [{ id: uid(), text, time: Date.now() }, ...prev].slice(0, 60));
  }, []);

  const addProperty = useCallback((d) => {
    const prop = {
      id: uid(),
      name: d.name.trim() || 'Untitled Property',
      building: d.building.trim(),
      address: d.address.trim(),
      notes: d.notes.trim(),
      units: [],
      expenses: [],
    };
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

  const addUnit = useCallback((propId, d) => {
    setProperties((prev) => prev.map((p) => p.id !== propId ? p : {
      ...p,
      units: [...p.units, {
        id: uid(),
        label: d.label.trim() || 'Unit',
        tenant: d.tenant.trim(),
        notes: d.notes.trim(),
        capacity: d.capacity.trim(),
        fixtures: d.fixtures.trim(),
        features: d.features.trim(),
        rent: toAmount(d.rent),
        rentCurrency: CURRENCIES.includes(d.rentCurrency) ? d.rentCurrency : 'USD',
        leaseStart: d.leaseStart || '',
        leaseEnd: d.leaseEnd || '',
        payments: {},
      }],
    }));
    log(`Added unit "${d.label || 'Unit'}"`);
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
          if (next === 'paid') log(`Rent collected — ${u.tenant || u.label} (${formatMoney(toAmount(u.rent), u.rentCurrency)})`);
          return { ...u, payments: { ...u.payments, [month]: next } };
        }),
      };
    }));
  }, [log]);

  const addExpense = useCallback((propId, d) => {
    setProperties((prev) => prev.map((p) => p.id !== propId ? p : {
      ...p,
      expenses: [...p.expenses, {
        id: uid(),
        category: d.category.trim() || 'Expense',
        amount: toAmount(d.amount),
        currency: CURRENCIES.includes(d.currency) ? d.currency : 'USD',
        notes: (d.notes || '').trim(),
      }],
    }));
    log(`Added expense "${d.category}" (${formatMoney(toAmount(d.amount), d.currency)})`);
  }, [log]);

  const removeExpense = useCallback((propId, expId) => {
    setProperties((prev) => prev.map((p) => p.id !== propId ? p : {
      ...p, expenses: p.expenses.filter((e) => e.id !== expId),
    }));
  }, []);

  const updateSettings = useCallback((patch) => setSettings((prev) => ({ ...prev, ...patch })), []);

  const loadSample = useCallback(() => {
    setProperties(sampleProperties());
    log('Loaded sample fixtures');
  }, [log]);

  const clearAll = useCallback(() => {
    setProperties([]);
    log('Cleared all properties');
  }, [log]);

  return {
    properties, settings, activity,
    addProperty, removeProperty, addUnit, removeUnit, togglePayment,
    addExpense, removeExpense, updateSettings, loadSample, clearAll,
  };
}

// ── Small presentational helpers ───────────────────────────
const StatCard = ({ label, value, sub, color }) => (
  <div className="stat-card">
    <div className="stat-label">{label.toUpperCase()}</div>
    <div className={`stat-value val-${color}`}>{value}</div>
    <div className="stat-sub">{sub}</div>
  </div>
);

// ── Overview tab ───────────────────────────────────────────
const OverviewTab = ({ metrics, rate }) => (
  <div className="tab-content">
    <div className="stats-grid">
      <StatCard label="Monthly Income" value={formatMoney(metrics.scheduledRent)} sub={`${metrics.propertyCount} props · ${formatMoney(metrics.scheduledRent * normalizeRate(rate), 'MXN')}`} color="green" />
      <StatCard label="Total Expenses" value={formatMoney(metrics.monthlyExpenses)} sub={formatMoney(metrics.monthlyExpenses * normalizeRate(rate), 'MXN')} color="red" />
      <StatCard label="Net Cashflow" value={formatMoney(metrics.netCashflow)} sub={formatMoney(metrics.netCashflow * normalizeRate(rate), 'MXN')} color="cyan" />
      <StatCard label="Outstanding" value={formatMoney(metrics.outstandingRent)} sub={`${metrics.outstandingUnits} units`} color="orange" />
    </div>
    <div className="panel-row">
      <div className="panel">
        <div className="panel-title">PAYMENT STATUS</div>
        <div className="panel-body">
          <div className="occupancy-row"><span>OCCUPANCY</span><span className="badge-cyan">{formatPct(metrics.occupancyRate)}</span></div>
          <div className="occupancy-row" style={{ marginTop: '0.75rem' }}><span>RENT COLLECTED</span><span className="badge-cyan">{formatPct(metrics.collectionRate)}</span></div>
          <div className="occupancy-row" style={{ marginTop: '0.75rem' }}><span>OCCUPIED UNITS</span><span className="badge-cyan">{metrics.occupiedUnits} / {metrics.totalUnits}</span></div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">INCOME VS EXPENSES (USD / MXN)</div>
        <div className="panel-body">
          {[
            ['Gross rent collected', metrics.collectedRent, 'green'],
            ['Outstanding rent', metrics.outstandingRent, 'orange'],
            ['Total expenses', metrics.monthlyExpenses, 'red'],
            ['Net cashflow', metrics.netCashflow, 'cyan'],
            ['Annual projection', metrics.annualProjection, 'cyan'],
          ].map(([label, usd, color]) => (
            <div className="ie-row" key={label}>
              <span>{label}</span>
              <span className={`val-${color}`}>{formatDual(usd, rate)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ── FX tab (unchanged live rates) ──────────────────────────
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
    ).then(results => { setRates(results); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  return (
    <div className="tab-content">
      <div className="panel-title" style={{ marginBottom: '1.5rem' }}>LIVE FX RATES — USD BASE</div>
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

// ── Activity tab ───────────────────────────────────────────
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

// ── Rentals: Properties sub-view ───────────────────────────
const PropertiesView = ({ store, month, rate }) => {
  const [showProp, setShowProp] = useState(false);
  const [unitFor, setUnitFor] = useState(null);
  const [expenseFor, setExpenseFor] = useState(null);
  const { properties, settings } = store;

  if (properties.length === 0) {
    return (
      <>
        <div className="empty-state">
          <div className="empty-icon">🏠</div>
          <div className="empty-title">No Properties Yet</div>
          <div className="empty-sub">Add your first property — or load sample fixtures from Options</div>
          <button className="btn-primary" onClick={() => setShowProp(true)}>+ ADD PROPERTY</button>
        </div>
        {showProp && <PropertyForm onClose={() => setShowProp(false)} onSave={(d) => { store.addProperty(d); setShowProp(false); }} />}
      </>
    );
  }

  return (
    <>
      <div className="section-head">
        <h2>Properties</h2>
        <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => setShowProp(true)}>+ ADD PROPERTY</button>
      </div>
      <div className="prop-list">
        {properties.map((prop) => {
          const pl = propertyPL(prop, month, rate);
          const occupied = (prop.units || []).filter(isOccupied).length;
          return (
            <div className="prop-card" key={prop.id}>
              <div className="prop-card-head">
                <div>
                  <div className="prop-name">{prop.name}
                    {prop.building && <span className="chip">{prop.building}</span>}
                  </div>
                  {prop.address && <div className="prop-addr">{prop.address}</div>}
                  {prop.notes && <div className="prop-note">📝 {prop.notes}</div>}
                </div>
                <div className="prop-metrics">
                  <div className="prop-metric"><div className="pm-val val-green">{formatMoney(pl.income)}</div><div className="pm-label">Rent</div></div>
                  <div className="prop-metric"><div className="pm-val val-cyan">{formatMoney(pl.net)}</div><div className="pm-label">Net</div></div>
                  <div className="prop-metric"><div className="pm-val">{occupied}/{prop.units.length}</div><div className="pm-label">Occ</div></div>
                  <button className="btn-secondary" onClick={() => openPopout(`property:${prop.id}`)} title="Open in new window">⧉</button>
                  <button className="btn-danger" onClick={() => store.removeProperty(prop.id)}>Delete</button>
                </div>
              </div>

              {prop.units.length > 0 && (
                <div className="table-scroll">
                  <table className="unit-table">
                    <thead>
                      <tr><th>Unit</th><th>Tenant</th><th>Capacity</th><th>Lease</th><th className="num">Rent</th><th>Status</th><th></th></tr>
                    </thead>
                    <tbody>
                      {prop.units.map((u) => {
                        const occ = isOccupied(u);
                        const status = (u.payments || {})[month];
                        const cls = !occ ? 'pay-vacant' : status === 'paid' ? 'pay-paid' : 'pay-outstanding';
                        const txt = !occ ? 'Vacant' : status === 'paid' ? 'Paid' : 'Outstanding';
                        return (
                          <React.Fragment key={u.id}>
                            <tr>
                              <td>{u.label}</td>
                              <td>{u.tenant || <span className="dim">—</span>}</td>
                              <td className="dim small">{u.capacity || '—'}</td>
                              <td className="dim small">{u.leaseStart || '—'}{u.leaseEnd ? ` → ${u.leaseEnd}` : ''}</td>
                              <td className="num">{formatMoney(toAmount(u.rent), u.rentCurrency)}</td>
                              <td><button className={`pay-toggle ${cls}`} disabled={!occ} onClick={() => occ && store.togglePayment(prop.id, u.id, month)}>{txt}</button></td>
                              <td><button className="btn-danger" onClick={() => store.removeUnit(prop.id, u.id)}>✕</button></td>
                            </tr>
                            {(u.fixtures || u.features || u.notes) && (
                              <tr className="detail-row"><td colSpan={7}>
                                {u.fixtures && <span className="tag">Fixtures: {u.fixtures}</span>}
                                {u.features && <span className="tag">Features: {u.features}</span>}
                                {u.notes && <span className="tag">📝 {u.notes}</span>}
                              </td></tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {prop.expenses.length > 0 && (
                <>
                  <div className="sub-head"><span>Monthly Expenses</span></div>
                  {prop.expenses.map((e) => (
                    <div className="expense-row" key={e.id}>
                      <span>{e.category}{e.notes ? <span className="dim small"> · {e.notes}</span> : null}</span>
                      <span><span className="val-red mono">{formatMoney(toAmount(e.amount), e.currency)}</span>
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
      {unitFor && <UnitForm defaultCurrency={settings.defaultCurrency} onClose={() => setUnitFor(null)} onSave={(d) => { store.addUnit(unitFor, d); setUnitFor(null); }} />}
      {expenseFor && <ExpenseForm defaultCurrency={settings.defaultCurrency} onClose={() => setExpenseFor(null)} onSave={(d) => { store.addExpense(expenseFor, d); setExpenseFor(null); }} />}
    </>
  );
};

// ── Rentals: Expenses sub-view (itemized + analysis) ───────
const ExpensesView = ({ store, rate }) => {
  const [addFor, setAddFor] = useState(null);
  const { properties, settings } = store;

  const items = properties.flatMap((p) => (p.expenses || []).map((e) => ({ ...e, propId: p.id, propName: p.name, building: p.building || 'Ungrouped' })));
  const byCategory = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const usd = toAmount(it.amount) / (it.currency === 'MXN' ? normalizeRate(rate) : 1);
      map.set(it.category, (map.get(it.category) || 0) + usd);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items, rate]);
  const total = byCategory.reduce((s, [, v]) => s + v, 0);

  return (
    <>
      <div className="section-head">
        <h2>Expenses</h2>
        <button className="btn-primary" style={{ marginTop: 0 }} disabled={properties.length === 0}
          onClick={() => setAddFor(properties[0]?.id || null)}>+ ADD EXPENSE</button>
      </div>

      {properties.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🧾</div><div className="empty-title">No Properties</div><div className="empty-sub">Add a property before logging expenses</div></div>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: '1rem' }}>
            <div className="panel-title">BY CATEGORY (USD / MXN)</div>
            <div className="panel-body">
              {byCategory.length === 0 && <div className="dim">No expenses logged yet.</div>}
              {byCategory.map(([cat, usd]) => (
                <div className="ie-row" key={cat}><span>{cat}</span><span className="val-red">{formatDual(usd, rate)}</span></div>
              ))}
              {byCategory.length > 0 && (
                <div className="ie-row" style={{ fontWeight: 700 }}><span>TOTAL</span><span className="val-red">{formatDual(total, rate)}</span></div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">ITEMIZED</div>
            <div className="table-scroll">
              <table className="pl-table">
                <thead><tr><th>Property</th><th>Building</th><th>Category</th><th>Notes</th><th className="num">Amount</th><th className="num">USD</th><th></th></tr></thead>
                <tbody>
                  {items.length === 0 && <tr><td colSpan={7} className="dim">Nothing logged yet.</td></tr>}
                  {items.map((it) => {
                    const usd = toAmount(it.amount) / (it.currency === 'MXN' ? normalizeRate(rate) : 1);
                    return (
                      <tr key={it.id}>
                        <td>{it.propName}</td>
                        <td className="dim">{it.building}</td>
                        <td>{it.category}</td>
                        <td className="dim small">{it.notes || '—'}</td>
                        <td className="num">{formatMoney(toAmount(it.amount), it.currency)}</td>
                        <td className="num val-red">{formatMoney(usd)}</td>
                        <td><button className="btn-danger" onClick={() => store.removeExpense(it.propId, it.id)}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {addFor && <ExpenseForm withProperty properties={properties} propId={addFor} defaultCurrency={settings.defaultCurrency}
        onClose={() => setAddFor(null)} onSave={(d) => { store.addExpense(d.propId, d); setAddFor(null); }} />}
    </>
  );
};

// ── Rentals: Totals sub-view (property → building → grand) ──
const TotalsView = ({ store, month, rate }) => {
  const { properties } = store;
  if (properties.length === 0) {
    return <div className="empty-state"><div className="empty-icon">💰</div><div className="empty-title">No Data</div><div className="empty-sub">Add properties to see totals</div></div>;
  }
  const groups = groupByBuilding(properties, month, rate);
  const grand = grandTotal(properties, month, rate);

  return (
    <>
      <div className="section-head"><h2>Totals &amp; P&amp;L — {month}</h2></div>
      <div className="panel">
        <div className="panel-title">BY BUILDING → BY PROPERTY (USD / MXN)</div>
        <div className="table-scroll">
          <table className="pl-table">
            <thead><tr><th>Building / Property</th><th className="num">Income</th><th className="num">Expenses</th><th className="num">Net</th></tr></thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.building}>
                  <tr className="group-row">
                    <td>▸ {g.building}</td>
                    <td className="num val-green">{formatDual(g.income, rate)}</td>
                    <td className="num val-red">{formatDual(g.expenses, rate)}</td>
                    <td className={`num val-${g.net >= 0 ? 'cyan' : 'red'}`}>{formatDual(g.net, rate)}</td>
                  </tr>
                  {g.properties.map((r) => (
                    <tr key={r.id}>
                      <td className="indent">{r.name}</td>
                      <td className="num val-green">{formatDual(r.income, rate)}</td>
                      <td className="num val-red">{formatDual(r.expenses, rate)}</td>
                      <td className={`num val-${r.net >= 0 ? 'cyan' : 'red'}`}>{formatDual(r.net, rate)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>GRAND TOTAL</td>
                <td className="num val-green">{formatDual(grand.income, rate)}</td>
                <td className="num val-red">{formatDual(grand.expenses, rate)}</td>
                <td className="num val-cyan">{formatDual(grand.net, rate)}</td>
              </tr>
              <tr>
                <td className="dim">ANNUAL PROJECTION</td>
                <td colSpan={3} className="num val-cyan">{formatDual(grand.net * 12, rate)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
};

// ── Rentals: Options sub-view ──────────────────────────────
const OptionsView = ({ store }) => {
  const { settings, updateSettings, loadSample, clearAll } = store;
  const [rateInput, setRateInput] = useState(String(settings.usdMxn));
  useEffect(() => { setRateInput(String(settings.usdMxn)); }, [settings.usdMxn]);

  return (
    <>
      <div className="section-head"><h2>Options</h2></div>
      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panel-title">CURRENCY</div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="field">
            <label>USD → MXN exchange rate</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="number" min="0" step="0.01" value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                onBlur={() => updateSettings({ usdMxn: normalizeRate(rateInput) })} />
              <span className="dim" style={{ alignSelf: 'center' }}>1 USD = {settings.usdMxn} MXN</span>
            </div>
          </div>
          <div className="field">
            <label>Default input currency</label>
            <div className="seg">
              {CURRENCIES.map((c) => (
                <button key={c} className={`seg-btn ${settings.defaultCurrency === c ? 'active' : ''}`}
                  onClick={() => updateSettings({ defaultCurrency: c })}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">DATA</div>
        <div className="panel-body" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={loadSample}>Load sample fixtures</button>
          <button className="btn-danger" onClick={() => { if (window.confirm('Remove all properties? This cannot be undone.')) clearAll(); }}>Clear all data</button>
        </div>
      </div>
    </>
  );
};

// ── Rentals tab: lateral (Windows-style) sub-tabs ──────────
const RENTAL_SUBTABS = [
  { id: 'properties', label: 'Properties', icon: '🏠' },
  { id: 'expenses', label: 'Expenses', icon: '🧾' },
  { id: 'totals', label: 'Totals & P&L', icon: '💰' },
  { id: 'options', label: 'Options', icon: '⚙️' },
];

const RentalSubView = ({ view, store, month, rate }) => {
  switch (view) {
    case 'expenses': return <ExpensesView store={store} rate={rate} />;
    case 'totals': return <TotalsView store={store} month={month} rate={rate} />;
    case 'options': return <OptionsView store={store} />;
    case 'properties':
    default: return <PropertiesView store={store} month={month} rate={rate} />;
  }
};

const RentalsTab = ({ store, month, rate }) => {
  const [sub, setSub] = useState('properties');
  return (
    <div className="lateral">
      <nav className="lateral-nav">
        {RENTAL_SUBTABS.map((t) => (
          <button key={t.id} className={`lateral-tab ${sub === t.id ? 'active' : ''}`} onClick={() => setSub(t.id)}>
            <span className="lt-icon">{t.icon}</span>{t.label}
          </button>
        ))}
        <button className="lateral-tab popout" onClick={() => openPopout(sub)} title="Open this view in a new window">⧉ Pop out</button>
      </nav>
      <div className="lateral-content">
        <RentalSubView view={sub} store={store} month={month} rate={rate} />
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
  <div className="field"><label>{label}</label><input {...props} /></div>
);

const TextField = ({ label, ...props }) => (
  <div className="field"><label>{label}</label><textarea rows={2} {...props} /></div>
);

const CurrencyAmount = ({ label, amount, currency, onAmount, onCurrency }) => (
  <div className="field">
    <label>{label}</label>
    <div className="ca-row">
      <div className="seg">
        {CURRENCIES.map((c) => (
          <button key={c} type="button" className={`seg-btn ${currency === c ? 'active' : ''}`} onClick={() => onCurrency(c)}>{c}</button>
        ))}
      </div>
      <input type="number" min="0" value={amount} onChange={(e) => onAmount(e.target.value)} placeholder="0" />
    </div>
  </div>
);

const PropertyForm = ({ onClose, onSave }) => {
  const [f, setF] = useState({ name: '', building: '', address: '', notes: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Add Property" onClose={onClose} onSave={() => onSave(f)}>
      <Field label="Name" value={f.name} autoFocus onChange={set('name')} placeholder="Logan Heights Duplex" />
      <Field label="Building / Group" value={f.building} onChange={set('building')} placeholder="San Diego" />
      <Field label="Address" value={f.address} onChange={set('address')} placeholder="123 Main St, San Diego" />
      <TextField label="Notes" value={f.notes} onChange={set('notes')} placeholder="Anything worth remembering…" />
    </Modal>
  );
};

const UnitForm = ({ defaultCurrency = 'USD', onClose, onSave }) => {
  const [f, setF] = useState({
    label: '', tenant: '', rent: '', rentCurrency: defaultCurrency,
    capacity: '', fixtures: '', features: '', notes: '', leaseStart: '', leaseEnd: '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Add Unit" onClose={onClose} onSave={() => onSave(f)}>
      <div className="field-row">
        <Field label="Unit label" value={f.label} autoFocus onChange={set('label')} placeholder="Unit A" />
        <Field label="Tenant (blank = vacant)" value={f.tenant} onChange={set('tenant')} placeholder="Ana García" />
      </div>
      <CurrencyAmount label="Monthly rent" amount={f.rent} currency={f.rentCurrency}
        onAmount={(v) => setF({ ...f, rent: v })} onCurrency={(c) => setF({ ...f, rentCurrency: c })} />
      <Field label="Capacity" value={f.capacity} onChange={set('capacity')} placeholder="2BR / 1BA · 850 sqft" />
      <Field label="Fixtures" value={f.fixtures} onChange={set('fixtures')} placeholder="Range, fridge, in-unit W/D" />
      <Field label="Features" value={f.features} onChange={set('features')} placeholder="Parking, fenced yard" />
      <div className="field-row">
        <Field label="Lease start" type="date" value={f.leaseStart} onChange={set('leaseStart')} />
        <Field label="Lease end" type="date" value={f.leaseEnd} onChange={set('leaseEnd')} />
      </div>
      <TextField label="Notes" value={f.notes} onChange={set('notes')} placeholder="Voucher, special terms…" />
    </Modal>
  );
};

const ExpenseForm = ({ defaultCurrency = 'USD', withProperty = false, properties = [], propId, onClose, onSave }) => {
  const [f, setF] = useState({ propId: propId || properties[0]?.id || '', category: EXPENSE_CATEGORIES[0], amount: '', currency: defaultCurrency, notes: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Add Monthly Expense" onClose={onClose} onSave={() => onSave(f)}>
      {withProperty && (
        <div className="field">
          <label>Property</label>
          <select value={f.propId} onChange={set('propId')}>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label>Category</label>
        <select value={f.category} onChange={set('category')}>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <CurrencyAmount label="Monthly amount" amount={f.amount} currency={f.currency}
        onAmount={(v) => setF({ ...f, amount: v })} onCurrency={(c) => setF({ ...f, currency: c })} />
      <TextField label="Notes" value={f.notes} onChange={set('notes')} placeholder="e.g. Predial ÷ 12" />
    </Modal>
  );
};

// ── Clock ───────────────────────────────────────────────────
const Clock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="clock">
      <span className="clock-time">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      <span className="clock-date">{time.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</span>
    </div>
  );
};

// ── Pop-out helper ─────────────────────────────────────────
// Opens the requested rentals view in a new browser window. The new window
// loads the same app with ?popout=<view>; localStorage is shared so data
// stays in sync (the storage listener in useRentals propagates edits).
function openPopout(view) {
  const url = `${window.location.pathname}?popout=${encodeURIComponent(view)}`;
  window.open(url, `sdlare_${view}`, 'width=900,height=720,menubar=no,toolbar=no');
}

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
  const rate = store.settings.usdMxn;
  const metrics = useMemo(() => computeMetrics(store.properties, month, rate), [store.properties, month, rate]);

  // Pop-out mode: render a single rentals view, chrome-free.
  const popout = new URLSearchParams(window.location.search).get('popout');
  if (popout) {
    let view = popout;
    let title = popout;
    if (popout.startsWith('property:')) {
      const id = popout.slice('property:'.length);
      const only = { ...store, properties: store.properties.filter((p) => p.id === id) };
      const name = store.properties.find((p) => p.id === id)?.name || 'Property';
      return (
        <div className="popout-shell">
          <div className="popout-bar">SDLARE · {name}</div>
          <div className="popout-body"><PropertiesView store={only} month={month} rate={rate} /></div>
        </div>
      );
    }
    const meta = RENTAL_SUBTABS.find((t) => t.id === view);
    title = meta ? meta.label : view;
    return (
      <div className="popout-shell">
        <div className="popout-bar">SDLARE · {title}</div>
        <div className="popout-body"><RentalSubView view={view} store={store} month={month} rate={rate} /></div>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'rentals': return <RentalsTab store={store} month={month} rate={rate} />;
      case 'fx': return <FXTab />;
      case 'activity': return <ActivityTab activity={store.activity} />;
      case 'pl': return <div className="tab-content"><TotalsView store={store} month={month} rate={rate} /></div>;
      case 'overview':
      default: return <OverviewTab metrics={metrics} rate={rate} />;
    }
  };

  return (
    <div className="app">
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

      <nav className="top-nav">
        {TABS.map(tab => (
          <button key={tab.id} className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </nav>

      <main className="main">{renderTab()}</main>

      <nav className="bottom-nav">
        {TABS.map(tab => (
          <button key={tab.id} className={`bottom-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </nav>
    </div>
  );
}

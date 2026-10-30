# SDLARE
San Diego Lending and Real Estate - Operations Platform

## Rentals: property management app

A self-contained web app for managing rental properties: properties and units,
tenants, leases, rent collection, maintenance work orders and expenses.

**No dependencies.** It runs on Node.js 22.5+ using only the standard library
(`node:http` and the built-in `node:sqlite`). There is no build step.

```bash
npm run seed      # optional: load demo data (add `-- --reset` to wipe first)
npm start         # http://localhost:3000
npm test
```

Environment variables: `PORT` (default `3000`), `DB_FILE` (default `data/sdlare.db`).

### Features

- **Dashboard** — occupancy, scheduled vs. collected rent, outstanding balances,
  expenses, open work orders by priority, six-month cash-flow chart, leases
  ending within 60 days, and vacant units with a one-click "Lease it".
- **Rent roll** — every unit with its tenant, term, market vs. actual rent,
  deposit and balance; exports to CSV.
- **Leases** — per-lease ledger with running balance and "Record payment".
  Overlapping leases on the same unit are rejected.
- **Properties / units / tenants** — detail pages roll up related leases,
  payments, work orders and expenses.
- **Maintenance** — priority and status tracking; closing a work order stamps
  its close date.
- **Expenses** — categorized per property (repairs, utilities, insurance,
  property tax, HOA/other, …).
- **As-of date** — the date picker in the header recomputes balances, lease
  status and the dashboard for any day, past or future.

### Rent accounting

A lease charges its full `monthly_rent` on the same day of the month as its
start date (clamped for short months, e.g. Jan 31 → Feb 28), from the start
date through the earlier of its end date and the as-of date. A lease with no
end date is month-to-month and keeps accruing. Balance = charges − payments.
Proration, late fees and deposit refunds are not modeled yet.

### Layout

```
src/db.js         SQLite schema and read views
src/resources.js  Field specs + validation for each resource
src/api.js        REST routing, business rules
src/reports.js    Rent schedule, ledger, dashboard, rent roll
src/server.js     HTTP server + static files
public/           Single-page UI (vanilla JS)
scripts/seed.js   Demo data
test/             node:test API tests
```

### API

All endpoints are JSON under `/api`.

| Method | Path | |
| --- | --- | --- |
| GET | `/api/{resource}` | List. Resources: `properties`, `units`, `tenants`, `leases`, `payments`, `maintenance`, `expenses`. Filter with query params such as `?property_id=1`, `?status=current`. |
| POST | `/api/{resource}` | Create |
| GET / PATCH / DELETE | `/api/{resource}/{id}` | Read / partial update / delete |
| GET | `/api/leases/{id}/ledger` | Charges, payments and running balance |
| GET | `/api/dashboard` | Dashboard rollup |
| GET | `/api/rent-roll` | Rent roll |
| GET | `/api/meta` | Field definitions used to build forms |

Report and lease endpoints accept `?as_of=YYYY-MM-DD` (default: today).
Validation failures return `400` with `{ error, errors: { field: message } }`;
deleting a record that others still reference returns `409`.

> Note: there is no authentication yet. Run it on a trusted network or behind
> an authenticating proxy until user accounts are added.

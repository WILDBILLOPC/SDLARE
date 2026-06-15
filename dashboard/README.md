# SDLARE Dashboard

The SDLARE operations dashboard — a React app (Create React App) served locally
via PM2 at `localhost:3000` on the Mac mini.

## Tabs

| Tab | Status | Notes |
|-----|--------|-------|
| **Overview** | Live | Income, **collected-per-day**, net cashflow, open-task count; payment status; income/expenses; a **macro task list** across all properties; and an **FX converter** — all in USD **and** MXN. |
| **Rentals** | Live | Lateral (Windows-style) sub-tabs: Properties, Expenses, Totals & P&L, Options. |
| **FX Engine** | Live | USD base rates (MXN/EUR/GBP/CAD) from `api.frankfurter.dev`. |
| **Activity** | Live | Rolling log of property/unit/payment events. |
| **P&L** | Live | Building → property → grand-total profit & loss with an annual projection, dual currency. |

## Rentals sub-tabs

- **Properties** — add/delete properties (with a *Building / Group* label, address, notes) and
  units. Each unit captures tenant, **capacity, fixtures, features, notes**, lease dates, and
  monthly rent in **dollars or pesos**. Mark each unit's rent paid/outstanding per month. Each
  property has its own **task list** that rolls up into the Overview macro list.
- **Expenses** — log expenses one-by-one (category presets like Property Tax, currency, notes),
  with a by-category roll-up and a fully itemized table for analysis.
- **Totals & P&L** — income / expenses / net **by building, by property, and a grand total**,
  every figure shown in both USD and MXN, plus an annual projection.
- **Options** — set the USD→MXN exchange rate and default input currency, load sample
  fixtures, or clear all data.

Any rentals view (or a single property) can be **popped out into a new browser window**
via the ⧉ button; windows share data and stay in sync.

## Data

Rental data, settings and the activity log are persisted in the browser via
`localStorage` (keys `sdlare.rentals.v1`, `sdlare.settings.v1`, `sdlare.activity.v1`). No
backend is required for the single local dashboard. All financial calculations — including
dual-currency conversion and multi-level totals — live in `src/rentals.js` as pure functions
so they can be unit-tested.

## Develop

```bash
npm install
npm start          # dev server on :3000
npm test           # watch-mode unit tests
npm run test:ci    # single run with coverage
npm run build      # production build
```

## Tests

`src/rentals.test.js` covers the money math and persistence: metric
aggregation, occupied-vs-vacant handling, collected/outstanding splits,
month scoping, P&L per property, money/percentage formatting, and
load/save round-tripping (including corrupt-data fallback).

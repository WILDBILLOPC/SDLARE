# SDLARE Dashboard

The SDLARE operations dashboard — a React app (Create React App) served locally
via PM2 at `localhost:3000` on the Mac mini.

## Tabs

| Tab | Status | Notes |
|-----|--------|-------|
| **Overview** | Live | Income, expenses, net cashflow, outstanding, occupancy & collection — all derived from the rental portfolio. |
| **Rentals** | Live | Full property/unit/tenant management with lease dates, monthly expenses, and per-unit rent payment tracking. |
| **FX Engine** | Live | USD base rates (MXN/EUR/GBP/CAD) from `api.frankfurter.dev`. |
| **Activity** | Live | Rolling log of property/unit/payment events. |
| **P&L** | Live | Per-property profit & loss for the current month plus an annual projection. |

## Data

Rental data and the activity log are persisted in the browser via
`localStorage` (keys `sdlare.rentals.v1`, `sdlare.activity.v1`). No backend is
required for the single local dashboard. All financial calculations live in
`src/rentals.js` as pure functions so they can be unit-tested.

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

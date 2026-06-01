# SDLARE

**San Diego Lending and Real Estate — Operations Platform**

An internal operations app for managing the lending pipeline and real estate
listings. Track loans from lead to funded, manage property listings, and see
the whole portfolio on one dashboard.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** for styling
- **Prisma 7** ORM with a **SQLite** database (driver adapter), trivially
  swappable to **Postgres** for production
- **Server Actions** for all mutations; **server-side session auth**
  (signed JWT cookie via `jose`, passwords hashed with `bcryptjs`)

## Features

- **Auth** — email/password login with HTTP-only signed session cookies;
  every route and server action is gated server-side.
- **Dashboard** — active-pipeline count and volume, funded/closed volume,
  active listings, a pipeline-by-stage breakdown, and recent activity.
- **Loan pipeline** — create/edit/delete loans, filter by stage, and change
  a loan's stage inline from the list. Loans can be linked to a property.
- **Properties** — create/edit/delete listings with status, type, price,
  beds/baths/sqft, and linked loans.

## Getting started

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Configure environment
cp .env.example .env
# then set AUTH_SECRET in .env:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Create the database schema and seed a demo user + sample data
npm run db:migrate
npm run db:seed

# 4. Run the dev server
npm run dev
```

Open http://localhost:3000 and sign in with the seeded account:

```
email:    op@sdlare.com
password: password123
```

## Scripts

| Script               | Description                               |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Start the dev server                      |
| `npm run build`      | Generate Prisma client + production build |
| `npm start`          | Run the production server                 |
| `npm run lint`       | Run ESLint                                |
| `npm run db:migrate` | Apply Prisma migrations (dev)             |
| `npm run db:seed`    | Seed the demo user and sample records     |
| `npm run db:studio`  | Open Prisma Studio                        |
| `npm run db:reset`   | Reset the database and re-run migrations  |

## Moving to Postgres (production)

1. Set `provider = "postgresql"` in `prisma/schema.prisma`.
2. Point `DATABASE_URL` at your Postgres instance.
3. Swap the driver adapter in `src/lib/db.ts` (and `prisma/seed.ts`) to the
   Postgres adapter (`@prisma/adapter-pg`).
4. Run `npm run db:migrate`.

## Project layout

```
prisma/                 Prisma schema, migrations, seed script
src/
  app/
    (app)/              Authenticated area (dashboard, loans, properties)
    actions/            Server Actions (auth, loans, properties)
    login/              Login page + form
  components/           Shared UI (forms, badges, nav, etc.)
  generated/prisma/     Generated Prisma client (git-ignored)
  lib/                  db, auth, session, constants, validators, formatters
```

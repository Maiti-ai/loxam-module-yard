# Loxam Module Yard

Technical foundation for an internal Next.js application that will manage module inventory on a yard.

This repository is **not** the visual yard MVP yet. It connects the app to Supabase and provides the database, authentication, RLS, storage, and seed data the next agent needs.

Stack:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL, Auth, Storage)
- next-intl for Dutch (`nl`) and French (`fr`)
- ExcelJS for `.xlsx` export

## Project structure

```text
src/
  app/[locale]/          App Router pages (nl/fr prefixed routes)
  app/auth/callback/     Supabase Auth code exchange (no locale prefix)
  components/            Header, language switcher, login form
  features/              Domain folders for the future MVP
    auth/
    users/
    roles/
    modules/
    yard-locations/
    movement-history/
    module-photos/
    air-conditioning/
    inventory-export/
  i18n/                  Locale routing and messages loader
  lib/
    supabase/            Browser, server, admin, session, and status helpers
    storage/             Module photo path helpers
    excel/               Inventory workbook helper
    env.ts               Environment variable readers
  proxy.ts               next-intl routing + Supabase session refresh
  types/                 Shared TypeScript types, including Database
messages/                Dutch and French translation files
scripts/verify-supabase.mjs
supabase/
  config.toml
  migrations/            PostgreSQL, RLS, Storage, and fictitious seed
  seed.sql               Pointer to the seed migration for local resets
.env.example             Variable names only — never real keys
```

Placeholder operational routes still exist (`/modules`, `/yard`, `/movements`, `/inventory`). They are not the yard map.

## Run locally

```bash
npm install
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should be redirected to `/nl` or `/fr`.

Checks:

```bash
npm run lint
npm run typecheck
npm run build
npm run verify:supabase
```

## Environment variables

Place values in `.env.local` only. That file is gitignored.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Public client / publishable key |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | No | Defaults to `module-photos` |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Unused by this foundation. Never `NEXT_PUBLIC_`. |

Do not commit `.env.local`. Do not put a secret or `service_role` key in any `NEXT_PUBLIC_` variable.

## Connect the Supabase project

1. Open the project dashboard.
2. Copy **Project URL** into `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the **publishable** key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   Older dashboards show this as `anon` / `legacy anon`.
4. In **Authentication → URL configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/**` and `http://localhost:3000/auth/callback`

Clients:

- Browser: `src/lib/supabase/client.ts`
- Server: `src/lib/supabase/server.ts`
- Session refresh: `src/proxy.ts`
- Auth callback: `src/app/auth/callback/route.ts`

## Database structure

Yard occupancy is hierarchical:

`yard_blocks` → `yard_rows` → `yard_positions` → `yard_slots` (level)

Levels are `GROUND`, `LEVEL_1`, and `LEVEL_2`. Inserting a position automatically creates those three slots.

A module occupies at most one slot through `module_locations`. Two uniqueness rules prevent two modules from sharing the same cell:

- `yard_slots (block_id, row_id, position_id, level)` is unique
- `module_locations.slot_id` is unique

| Table | Purpose |
| --- | --- |
| `profiles` | One row per Auth user, including `app_role` |
| `module_types` | `6x3` and `3x3` |
| `yard_blocks` | Yard blocks |
| `yard_rows` | Rows inside a block |
| `yard_positions` | Positions inside a row |
| `yard_slots` | Concrete cell: block + row + position + level |
| `modules` | Inventory items (`AVAILABLE` or `RENTED`) |
| `module_locations` | Current slot for a module |
| `module_movements` | Append-only movement history |
| `module_photos` | Photo metadata; files live in Storage |
| `air_conditioning_units` | Brand, serial, internal number, maintenance date |
| `module_location_view` | Convenience view for later UI work |

`module_movements` cannot be updated or deleted. Changing `module_locations` appends a history row.

## Application roles

Stored on `profiles.role`. New users default to `PRODUCTION`.

| Role | Intended access |
| --- | --- |
| `ADMIN` | Users, yard layout, modules, moves, photos, airco |
| `OFFICE` | Rental status, photos, airco; cannot change module number/type or move modules |
| `FORKLIFT_DRIVER` | Read inventory; insert/update current locations (moves) |
| `PRODUCTION` | Read inventory; update airco maintenance fields only |

Promote the first user in the SQL editor after signup:

```sql
update public.profiles
set role = 'ADMIN'
where id = '<auth user uuid>';
```

Create users in **Authentication → Users**. Public signup is not part of the UI.

## RLS approach

Every business table has RLS enabled. `anon` has no table privileges. `authenticated` has privileges, and policies restrict them by `public.current_app_role()`.

Authorization is enforced in Postgres. Hiding buttons in the UI is not sufficient. Server helpers in `src/features/auth` and `src/features/roles` exist for later UI/server-action checks, but RLS remains the boundary.

Triggers add extra column-level protection:

- `OFFICE` cannot change `modules.module_number` or `module_type_id`
- `PRODUCTION` can only change airco maintenance fields
- Movement rows are immutable

## Migrations

Files in `supabase/migrations/`, applied in timestamp order:

1. `20260813140000_yard_schema.sql` — types, tables, constraints, triggers, view
2. `20260813140100_rls_and_storage.sql` — RLS, grants, private `module-photos` bucket
3. `20260813140200_seed_fictitious_dev_data.sql` — types, yard, 10 modules, airco, history

Apply them to the hosted project with one of these methods. Do **not** paste the database password into source code.

### Option A — Supabase CLI (preferred)

```bash
npx supabase login
npx supabase link --project-ref fafsrzadgisnlnpdjthy
npx supabase db push
```

The CLI will ask for the database password from **Project Settings → Database**.

For Cloud Agent or CI, store that password as an environment secret named `SUPABASE_DB_PASSWORD` (or a personal `SUPABASE_ACCESS_TOKEN` from [account tokens](https://supabase.com/dashboard/account/tokens)). Never commit it.

### Option B — Dashboard SQL editor

Open **SQL Editor** in the project and run the three migration files in order.

If a SQL Editor run of migration 1 fails partway, first run `supabase/scripts/cleanup_migration_1.sql`, confirm the verification query returns no rows, then rerun the three migrations in order. Do not paste a database password or `service_role` key into the repository.

Local reset (Docker):

```bash
npx supabase start
npx supabase db reset
```

After the schema is stable:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

## Seed data

The seed is fictitious development data:

- Module types `6x3` and `3x3`
- Blocks A and B, with rows, positions, and three levels each
- Modules `2000`–`2009`
- Mix of ground / level 1 / level 2, both blocks, `AVAILABLE` and `RENTED` to fake projects (`Project Atlas`, `Project Beacon`, `Project Harbor`)
- Airco brand, serial number, internal number, and maintenance date for each module
- Extra movement-history rows plus automatic history from current locations

No real customer data is included.

## Photo storage

- Bucket: `module-photos` (private)
- Bytes: Supabase Storage
- Metadata: `public.module_photos`
- Path helper: `src/lib/storage/module-photos.ts`
- Upload/read: authenticated `ADMIN` and `OFFICE` can write; all authenticated roles can read

## Authentication foundation

- Email/password login at `/nl/login` and `/fr/login`
- Session refresh in `src/proxy.ts`
- Auth callback at `/auth/callback`
- Header shows email, role, and sign-out when a session exists
- Profiles are created by a trigger on `auth.users`

Confirm email is enabled on this project (`mailer_autoconfirm` is false). For the first internal users, either confirm the email or temporarily disable **Confirm email** in Authentication settings for development.

## Recommended next step

1. Apply the three migrations to the hosted project.
2. Create an Auth user and promote that profile to `ADMIN`.
3. Sign in and confirm RLS: a forklift user must not be able to change rental status.
4. Then build the visual yard map and module workflow on this schema.

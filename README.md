# Loxam Module Yard

Technical foundation for an internal Next.js application that will manage module inventory on a yard.

This repository is **not** the MVP yet. It is a clean, runnable starting point so the next development agent can immediately build authentication, modules, yard locations, movement history, photos, air-conditioning data, and Excel export.

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
  components/layout/     Shared header, language switcher, placeholders
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
  i18n/                  Locale routing, navigation helpers, request config
  lib/
    supabase/            Browser, server, admin, and proxy/session clients
    storage/             Module photo path helpers
    excel/               Inventory workbook helper
    env.ts               Environment variable readers
  proxy.ts               next-intl routing + Supabase session refresh
  types/                 Shared TypeScript types, including Database
messages/                Dutch and French translation files
supabase/
  config.toml            Local Supabase CLI configuration
  migrations/            PostgreSQL and Storage migrations
  seed.sql               Local seed file (no real company data)
.env.example             Required variable names only
```

Placeholder routes exist so the architecture is visible, but they do not implement the real yard map or module workflow:

- `/nl` and `/fr` — landing page
- `/nl/login`, `/fr/login`
- `/nl/modules`, `/fr/modules`
- `/nl/yard`, `/fr/yard`
- `/nl/movements`, `/fr/movements`
- `/nl/inventory`, `/fr/inventory`

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local env file:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in the Supabase values described below. The app can start without them, but Auth, database, and Storage calls will not work until they are present.

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000). You should be redirected to `/nl` or `/fr`.

Useful checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Environment variables

Copy these names into `.env.local`. Do not commit secrets.

| Variable | Required | Where it is used |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes for Supabase | Browser and server clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes for Supabase | Browser and server clients |
| `SUPABASE_SERVICE_ROLE_KEY` | No for local UI | Server-only admin client |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | No | Defaults to `module-photos` |

`.env.local` is gitignored. `.env.example` is committed and contains names only.

## Connect the Supabase project

Create or open a Supabase project, then copy values into `.env.local`:

1. Open the project dashboard.
2. Open **Project Settings**.
3. Copy the **Project URL** into `NEXT_PUBLIC_SUPABASE_URL`.
   - You can also find this in the **Connect** dialog.
4. Open **API Keys**.
5. Copy the **publishable** key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - Older dashboards show this as `anon` or `legacy anon`.
   - This is a public client key. It is not a secret, but it is still project-specific.
6. Optionally copy the **service_role** key into `SUPABASE_SERVICE_ROLE_KEY`.
   - This key bypasses Row Level Security.
   - Never put it in a `NEXT_PUBLIC_` variable.
   - Never ship it to the browser.

Do not invent placeholder credentials. Leave the values empty until you copy them from the dashboard.

In **Authentication → URL configuration**, add:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/**`

The app uses the current recommended Next.js SSR packages:

- `@supabase/supabase-js`
- `@supabase/ssr`

Clients:

- Browser: `src/lib/supabase/client.ts` (`createBrowserClient`)
- Server Components / Server Actions / Route Handlers: `src/lib/supabase/server.ts` (`createServerClient`)
- Service-role admin: `src/lib/supabase/admin.ts`
- Session refresh: `src/proxy.ts` + `src/lib/supabase/middleware.ts`

## Database migrations

SQL migrations live in `supabase/migrations/`.

Current files:

- `20260813120000_init_foundation.sql` — roles, profiles, modules, yard locations, movements, photos metadata, air-conditioning
- `20260813120100_storage_module_photos.sql` — private `module-photos` bucket

Apply them to a linked hosted project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

For a local Supabase stack (Docker required):

```bash
npx supabase start
npx supabase db reset
```

`db reset` applies all migrations, then runs `supabase/seed.sql`.

After the schema is stable, generate TypeScript types and replace `src/types/database.ts`:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

## Seed data

`supabase/seed.sql` is intentionally empty of real records.

Use it later for generic local fixtures only. Do not seed customer names, live serial numbers, or production yard data.

## Photo storage

Module photo files are intended to live in the private Supabase Storage bucket `module-photos`.

- Bucket creation: `supabase/migrations/20260813120100_storage_module_photos.sql`
- Local CLI bucket config: `supabase/config.toml`
- Path helper: `src/lib/storage/module-photos.ts`
- Database metadata table: `public.module_photos`

Upload/download policies are not implemented yet. Keep the bucket private until authenticated upload rules exist.

## Internationalization

Dutch is the default locale. French is the second locale. Routes are prefixed:

- `/nl/...`
- `/fr/...`

Translation files:

- `messages/nl.json`
- `messages/fr.json`

Routing config lives in `src/i18n/`.

## Excel export

ExcelJS is installed and wrapped in `src/lib/excel/create-inventory-workbook.ts`.

No inventory export endpoint exists yet. The helper is ready for a later server-side `.xlsx` download.

## Recommended next step

Build authentication first:

1. Put real Supabase values in `.env.local`.
2. Push the migrations.
3. Add login with Supabase Auth.
4. Add RLS policies for profiles, modules, locations, movements, photos, and air-conditioning.
5. Then implement the module/yard MVP on top of this foundation.

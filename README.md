# Bookly

Salon booking and business management app (calendar, sales, clients, catalog, team).

Stack: TanStack Start + React 19, Vite, Tailwind v4, shadcn/Radix, Supabase. Hosted on Vercel.

## Run locally

Needs Node.js 22+.

```sh
npm install
cp .env.example .env   # then fill in your Supabase values
npm run dev            # http://127.0.0.1:8080
```

Use `127.0.0.1` rather than `localhost`: it's the address allowed in Supabase's auth redirect URLs.

## Database

The schema lives in `supabase/migrations`. For a brand-new Supabase project, run
`supabase/setup.sql` (all migrations concatenated) once in the SQL editor.

When you change the schema: add a new timestamped file to `supabase/migrations`, run it in the
Supabase SQL editor, then `npm run db:setup-sql` to refresh `setup.sql`.

## Deploy

Vercel builds from GitHub on every push to `main` (`npm run build`; Nitro detects Vercel
automatically). Environment variables are set in the Vercel project, matching `.env.example`.

# Bookly

- Deployed on Vercel from `main`; every push to `main` goes live. Do work on branches and open PRs.
- Don't force-push or rewrite pushed history.
- Database: Supabase. Schema changes go in a new file in `supabase/migrations`, then `npm run db:setup-sql`.
- Never commit secrets (service role key). Only `VITE_`-prefixed values reach the browser.

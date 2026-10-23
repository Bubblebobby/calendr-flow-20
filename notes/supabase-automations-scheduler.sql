-- Runs Bookly's automated emails (reminders and appointment updates) every 10 minutes.
-- Supabase's scheduler (pg_cron) calls https://bookly-taupe.vercel.app/api/cron/automations with
-- a secret, which must match CRON_SECRET in Vercel.
--
-- Before running:
--   1. Make a long random secret, e.g. in Terminal:  openssl rand -hex 32
--   2. Add it in Vercel as CRON_SECRET (Production, Sensitive) and redeploy.
--   3. Replace PASTE_YOUR_CRON_SECRET_HERE below with the same secret, then run this whole file.
-- Run supabase-update-2026-10-27-automations.sql first.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Keep the secret in Supabase Vault rather than in the job itself.
-- (If you run this file again, delete the old secret first: Project Settings → Vault.)
select vault.create_secret('PASTE_YOUR_CRON_SECRET_HERE', 'bookly_cron_secret', 'Bookly automations scheduler');

-- Replace any earlier version of the job, then schedule it.
select cron.unschedule(jobid) from cron.job where jobname = 'bookly-automations';
select cron.schedule(
  'bookly-automations',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://bookly-taupe.vercel.app/api/cron/automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'bookly_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- To check it's working after 10–20 minutes:
--   select status_code, content from net._http_response order by created desc limit 5;
-- 200 with {"sent":…} is good; 401 means the secret here and in Vercel don't match.

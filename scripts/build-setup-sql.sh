#!/bin/sh
# Concatenates supabase/migrations into supabase/setup.sql for a fresh Supabase project.
set -e
cd "$(dirname "$0")/.."
{
  echo "-- Bookly database setup: every migration in supabase/migrations, in order."
  echo "-- Paste into a NEW Supabase project's SQL editor and run once."
  echo "-- Regenerate with: npm run db:setup-sql"
  for f in supabase/migrations/*.sql; do
    echo
    echo "-- ===== $(basename "$f") ====="
    cat "$f"
    echo
  done
} > supabase/setup.sql

# Database updates for Lovable

Bookly's database is managed by Lovable, so new tables have to be created there.
Paste each block into Lovable's chat **as-is**. The Bookly code is already written
against these exact names; once a table exists, the matching calendar feature starts
working with no further code changes.

---

## 1. Blocked time (Calendar → Add → Blocked time)

> Create a `blocked_times` table in Supabase with these columns:
> `id uuid primary key default gen_random_uuid()`, `business_id uuid not null references businesses(id) on delete cascade`,
> `team_member_id uuid not null references team_members(id) on delete cascade`, `start_time timestamptz not null`,
> `end_time timestamptz not null` (check end_time > start_time), `title text`, `block_type text not null default 'custom'`,
> `description text`, `online_booking_allowed boolean not null default false`, `created_by uuid`, `created_at timestamptz not null default now()`.
> Add an index on (business_id, start_time). Enable RLS with the same policies `appointments` uses (business members can
> select/insert/update/delete rows for their business). Do not change any frontend code.

## 2. Waitlist (Calendar → Waitlist)

> Create a `waitlist_entries` table in Supabase:
> `id uuid primary key default gen_random_uuid()`, `business_id uuid not null references businesses(id) on delete cascade`,
> `client_id uuid references clients(id) on delete set null`, `service_id uuid references services(id) on delete set null`,
> `team_member_id uuid references team_members(id) on delete set null`, `preferred_date date`, `preferred_time text`,
> `status text not null default 'waiting'` (one of waiting, expired, booked), `notes text`, `created_by uuid`,
> `created_at timestamptz not null default now()`. Enable RLS with the same policies `appointments` uses. Do not change any frontend code.

## 3. Tips at checkout

> Add a column `tip_amount numeric not null default 0` to the `sales` table. Do not change any frontend code.

(Until this exists, the tip is written into the sale's note, e.g. "Tip ₦500.00 for Test".)

## 4. Cancellation reason

> Add a nullable column `cancellation_reason text` to the `appointments` table. Do not change any frontend code.

---

Still to come (later stages): repeating appointments, group appointments, a full appointment activity log,
preferred team member, extra (processing) time on services, saved filter sets.

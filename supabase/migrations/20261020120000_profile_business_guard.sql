-- Security: profiles.business_id decides which salon's data a login can read, and users may
-- edit their own profile row. Only let a signed-in user point it at a business they own.
-- Team invites are accepted server-side with the service key, which this doesn't restrict.

-- Not security definer on purpose: current_user must be the caller's role.
create or replace function public.guard_profile_business()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.business_id is not null
     and (tg_op = 'INSERT' or new.business_id is distinct from old.business_id)
     and not exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = auth.uid())
  then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_business_guard on public.profiles;
create trigger profiles_business_guard
  before insert or update of business_id on public.profiles
  for each row execute function public.guard_profile_business();

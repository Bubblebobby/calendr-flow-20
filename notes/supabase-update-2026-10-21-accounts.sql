-- Bookly update, 21 Oct 2026 (part 2): separate customer and business accounts.
-- Run after supabase-update-2026-10-21-security.sql. Safe to run more than once.

-- Two classes of user, like Fresha/Booksy: customer accounts (sign up at /sign-in) and business
-- accounts (owners and staff, sign up at /auth). One login belongs to one class:
-- customers can't create, join or link a business; business logins can't act as customers.
-- profiles.user_type is set once at sign-up (handle_new_user) and users can't change it.

create or replace function public.is_customer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select user_type = 'customer' from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_customer() from public, anon;
grant execute on function public.is_customer() to authenticated;

-- ── Customers never get a business ──
create or replace function public.guard_profile_business()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.business_id is not null
     and (tg_op = 'INSERT' or new.business_id is distinct from old.business_id)
  then
    -- Check the old type too: claiming a staff invite switches user_type to 'staff' in the same update.
    if new.user_type = 'customer' or (tg_op = 'UPDATE' and old.user_type = 'customer') then
      raise exception 'customer_account' using errcode = '42501';
    end if;
    if not exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = new.id)
       and not exists (select 1 from public.team_members t
                       where t.business_id = new.business_id and t.user_id = new.id and t.invite_status = 'active')
    then
      raise exception 'not_a_member_of_business' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_business() from public, anon, authenticated;

drop policy if exists "Owners can insert businesses" on public.businesses;
create policy "Owners can insert businesses" on public.businesses for insert to authenticated
  with check (auth.uid() = owner_id and not public.is_customer());

create or replace function public.link_my_business(p_business uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_customer() then raise exception 'customer_account' using errcode = '42501'; end if;
  if not exists (select 1 from public.businesses where id = p_business and owner_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.profiles set business_id = p_business where id = auth.uid();
end;
$$;
revoke all on function public.link_my_business(uuid) from public, anon;
grant execute on function public.link_my_business(uuid) to authenticated;

-- ── Customer features are for customer accounts only ──
create or replace function public.link_my_clients()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_count integer;
begin
  if not public.is_customer() then return 0; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null or v_email = '' then return 0; end if;
  update public.clients set user_id = auth.uid() where user_id is null and lower(email) = v_email;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

drop policy if exists "Customers manage their favourites" on public.favorite_businesses;
create policy "Customers manage their favourites" on public.favorite_businesses for all to authenticated
  using (user_id = auth.uid() and public.is_customer())
  with check (user_id = auth.uid() and public.is_customer());

-- my_appointments / my_wallet / submit_review only see client records linked to the caller,
-- and only customers can link, so unlinking non-customers below closes them too. The review
-- function also checks directly.
create or replace function public.submit_review(p_appointment uuid, p_rating integer, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_appt record;
  v_author text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not public.is_customer() then raise exception 'customer_account_required'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'invalid_rating'; end if;

  select a.id, a.business_id, a.status, c.first_name, c.last_name
    into v_appt
    from public.appointments a
    join public.clients c on c.id = a.client_id
   where a.id = p_appointment and c.user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  if v_appt.status <> 'completed' then raise exception 'not_completed'; end if;
  if exists (select 1 from public.reviews where appointment_id = p_appointment) then raise exception 'already_reviewed'; end if;

  select nullif(trim(full_name), '') into v_author from public.profiles where id = auth.uid();
  v_author := coalesce(v_author, concat_ws(' ', v_appt.first_name, v_appt.last_name));
  v_author := split_part(v_author, ' ', 1)
    || case when split_part(v_author, ' ', 2) <> '' then ' ' || left(split_part(v_author, ' ', 2), 1) || '.' else '' end;

  insert into public.reviews (business_id, appointment_id, user_id, author_name, rating, comment, services, team_member_name)
  select v_appt.business_id, p_appointment, auth.uid(), v_author, p_rating,
         nullif(trim(coalesce(p_comment, '')), ''),
         string_agg(coalesce(s.name, 'Service'), ', ' order by i.sort_order),
         (array_agg(t.first_name order by i.sort_order))[1]
    from public.appointment_items i
    left join public.services s on s.id = i.service_id
    left join public.team_members t on t.id = i.team_member_id
   where i.appointment_id = p_appointment
  returning id into v_id;

  perform public.notify(v_appt.business_id, 'review', 'New ' || p_rating || '-star review',
    v_author || coalesce(': ' || left(nullif(trim(coalesce(p_comment, '')), ''), 120), ''), '/calendar?appointment=' || p_appointment);
  return v_id;
end;
$$;
revoke all on function public.submit_review(uuid, integer, text) from public;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

-- ── Clean up links made before the classes were separate (e.g. testing with a business login) ──
update public.clients c set user_id = null
  where c.user_id is not null
    and not exists (select 1 from public.profiles p where p.id = c.user_id and p.user_type = 'customer');
delete from public.favorite_businesses f
  where not exists (select 1 from public.profiles p where p.id = f.user_id and p.user_type = 'customer');

-- A phone number and email clients can use to reach the salon, shown on the booking
-- confirmation and the manage-booking page.

alter table public.businesses
  add column if not exists contact_phone text,
  add column if not exists contact_email text;

alter table public.businesses
  drop constraint if exists businesses_contact_phone_check,
  add constraint businesses_contact_phone_check
    check (contact_phone is null or char_length(contact_phone) between 5 and 30),
  drop constraint if exists businesses_contact_email_check,
  add constraint businesses_contact_email_check
    check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

-- Public: only what a salon would print on a business card.
create or replace function public.get_business_contact(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', name,
    'phone', contact_phone,
    'email', contact_email,
    'website', website,
    'location', location)
  from public.businesses
  where booking_slug = lower(p_slug);
$$;

revoke all on function public.get_business_contact(text) from public;
grant execute on function public.get_business_contact(text) to anon, authenticated;

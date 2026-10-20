-- Each sold line's share of the cart discount, so commission and tax use what was actually charged.
-- Null on sales saved before this was recorded (pay runs estimate those).
alter table public.sale_items add column if not exists discount_amount numeric
  check (discount_amount is null or discount_amount >= 0);

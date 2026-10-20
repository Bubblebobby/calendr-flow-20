# Test data

## New Supabase project (lfzpkqqzbdasxskhcqeh), added 18 Oct 2026 for Catalog testing

Business 7b1ee6b5-b5c8-44fb-a3e9-226d5ebe39c0. Business address is a placeholder
("TEST address - replace in Settings, Lagos"): replace it with the real one.
Everything below is named "Test …" and has description "TEST DATA — delete after testing".

- service_categories: 3ae24610-6733-41d8-a77d-1389e0b320ff (Test Hair & styling), e52f703e-8394-432c-a905-4447ccb54082 (Test Nails)
- services: 757626c3-7e9d-45b2-a7ef-7751b283ec41 (Test Haircut), 3049fe9e-f6c8-44b3-bf0a-e86f6ce3dd41 (Test Hair Color),
  f1e34018-3640-45fb-9e27-9af63419befe (Test Blow Dry), 8840cd26-ab51-4702-bf5c-73809f486481 (Test Manicure),
  fc6396d2-35ad-43bf-bb6b-84bf5a17e096 (Test Haircut (copy), made by testing Duplicate)

- team_members: abc38ae4-a5ec-4cb5-a622-9c4e1c5a2342 (Test Stylist), 139cea81-84b7-4603-b7bd-ed9162c527d8 (Test Barber)
  (notes = 'TEST DATA — delete after testing'; the owner "Bobby Osagie" row is real, created automatically)

Cleanup: delete services where description = 'TEST DATA — delete after testing', then the two categories, then team_members where notes = 'TEST DATA — delete after testing'.

## Old Lovable Cloud database (no longer used), added 13 Oct 2026 for calendar testing

Delete all of this once calendar testing is finished. Business: Fab Saloon.
Everything is named "Test …"; the appointments are walk-ins (no client records were created).

## team_members
- 665e1b60-9c34-4b04-a291-a9e8470708b5 — Test Stylist
- 6192042a-8aed-4f6b-bb99-1d8ce19fe0ea — Test Barber

## service_categories
- ee097d1c-9a4f-4011-8ec3-0773c41af3bb — Test Category

## services
- 3e29e7b7-cd2d-4a46-85b1-2f2af1c17469 — Test Haircut (₦5,000, 1 hr)

## appointments (walk-ins, Tue 13 Oct 2026)
- 42fa1de4-8383-46af-a14f-f5c46a64125b — 13:00–14:00 Test Stylist, Test Haircut
- cd270a08-b9b2-4ed5-b0d5-073156b1d679 — 12:30–13:30 Test Barber, Test Haircut
- c8b86c2f-9779-428c-800a-c616184bbae1 — 11:15–12:15 Test Stylist, Test Haircut (checked out → completed)
  (42fa1de4… was rescheduled to 15:00–16:00 and set to "Arrived" during testing)

## sales (+ their sale_items)
- a043aa96-cfee-4bf2-8058-02a75a2035d2 — ₦5,000 cash, note "Tip ₦500.00 for Test", for appointment c8b86c2f…
- c080b280-d989-46ec-923d-9957fd79a877 — ₦5,000 cash, quick sale of Test Haircut (no appointment)

## clients
- 776b5dc0-2389-4909-926c-dd59d5d1300e — Test Client (test.client@example.com)
- appointment c7a1f8d2-cef1-4871-9270-396f6d14ea4e — 14:15–15:15 Test Barber, Test Haircut, for Test Client (via Book now)
- client_tags c173d4c5-3a85-46a7-811a-e9a0ee00dd1f — "Test Tag" (+ assignment 9f9885e9-05bf-43c0-8af3-fc54b369453c)

## Added 19–20 Oct 2026 (branch self-serve testing, live Supabase project)
- tax_rates 7f2a8cc9-70c6-4e79-bbd2-0229dc7851e5 — "Test VAT" 7.5%, set as businesses.default_tax_rate_id (clear that first)
- deals c5c00e47-79ee-48ab-8b6c-687674694e3d — "Test deal", code TEST10 (+ 2 deal_redemptions)
- products 60c6aa71-0d64-42a6-9277-ad94ffbfc90c — "Test Shampoo" (+ its stock_movements; stock now 2)
- packages c22ed657-8172-455f-8d32-2fb49d4d9d0b — "Test 3 Blow Dries"; client_packages 0f61af51-3622-46dd-bfc1-abcba295f38a (+ items, 1 package_redemption)
- memberships 9f270f43-1836-4e8a-bc8c-18265e386bb3 — "Test Gold"; client_memberships bf41f4bf-fd85-4f86-8301-d3d45bd4754b
- gift_cards code BAK3FXAM — "Test Recipient", ₦5,000 (₦1,000 left; + 1 gift_card_redemption)
- clients 10acb831-b714-41f6-8362-cf8a1d29eca1 — Test OnlineClient (test.online@example.com)
  - appointment a5cca56e-e003-44b7-9ad5-3a13bb7ce8f0 — booked online, rescheduled, cancelled
  - repeating series 32cc6b3b-58bd-4848-8075-495fcd81144f — 3 weekly Test Blow Dry appointments from Tue 20 Oct 12:00
- sales 0fed8b91-c971-4da4-9b57-4f28b626da5f, bcb35a55-9618-421e-9fcf-3d908e31bd0c, bc6f6d94-cdef-4136-ada0-123f5fc1644f and the 2250 sale after it (all 20 Oct)
- timesheets — Test Stylist: Mon 19 Oct 09:00–17:00 (note TEST DATA) and a seconds-long entry Tue 20 Oct 10:08
- team_members pay settings — Test Stylist hourly_rate 1000, commission 10% / 5% (set back to null)
- pay_runs e33d101c-5718-4fec-bf2c-ac247143ae19 — paid, so locked: delete it with
  `set session_replication_role = replica; delete from pay_runs where id = '…'; set session_replication_role = origin;`
- notifications — rows created by the tests above

## Added 20 Oct 2026 (customer accounts testing)
- clients 10acb831-b714-41f6-8362-cf8a1d29eca1 (Test OnlineClient): email changed to Bobby's login email and
  linked to Bobby's account (clients.user_id). Undo: `update clients set user_id = null, email = 'test.online@example.com' where id = '10acb831-b714-41f6-8362-cf8a1d29eca1';`
- appointment 32cc6b3b-58bd-4848-8075-495fcd81144f (first of the repeating series) set to completed
- reviews — one 5-star "TEST review" for that appointment (+ a 'review' notification)
- favorite_businesses — Bobby's account saved Sentence

## Cleanup order
sale_items → sales → appointment_items → appointments → client_tag_assignments → client_tags → clients → services → service_categories → team_members

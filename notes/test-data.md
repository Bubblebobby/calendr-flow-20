# Test data added for calendar testing (13 Oct 2026)

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

## Cleanup order
sale_items → sales → appointment_items → appointments → client_tag_assignments → client_tags → clients → services → service_categories → team_members

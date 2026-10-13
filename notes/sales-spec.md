# Sales: Fresha behaviour spec for Bookly

Recorded from Fresha on 13 Oct 2026. I created one draft sale there and discarded it; nothing was saved.

| Page | Fresha | Bookly status |
|---|---|---|
| Daily sales summary | Header with Export ▾ (PDF/CSV/Excel) and a black **Add new**; ‹ Today [date] › with "next" disabled for the future; Transaction summary card, then Cash movement card (stacked) | ✅ matched (export files come with Reports) |
| **Checkout** (Add new, calendar Checkout, resuming drafts) | Full-width screen. Left: Cart › Tip › Payment. Cart = search, tiles (Appointments, Services, Products, Packages, Gift cards), Quick sale grid (Edit). Tip = No tip/10/18/25%/Custom (3-col tiles). Payment = Cash, Redeem gift, Split payment, Other → amount keypad modal ("Add cash amount", rounded-up suggestions, "Cash received by", "Left to pay"/"Change", Add). Right: Add client card, cart lines (edit/remove), Total, To pay ›, ⋮ (Add tip, Add cart discount, Add receipt note, Add service charge, Save as draft, Cancel sale), Continue to payment / Save unpaid. Closing → "Discard draft sale?" (Save as draft / Discard). Appointment checkout opens at Tip. | ✅ built and tested; Bookly adds a Card tile; Products/Packages/Gift cards come with Catalog; service charge via Settings |
| Register | "INCLUDED IN YOUR PLAN" intro (open/close day, cash in/out, petty cash) | ✅ intro page; the register itself needs a table |
| Appointments | Export; search by ref/client; date range (16 presets + two-month calendar); Filters (team member, channel, status); sort; columns Ref #, Client, Service, Created by, Created date, Scheduled date, Duration, Team member, Price, Status | ✅ (already built; walk-in label and toolbar fixed) |
| Sales | Options ▾ (Sales settings), Add new; Sales / Drafts pill tabs; search by sale/client; date range; Filters (status: Unpaid, Part paid, Completed, Exchanged, Refunded, Voided; from/to amount; including items); Sort by | ✅ rebuilt; row → sale details (print, email*, refund); drafts reopen in checkout |
| Payments | Options; search; date range (default last 30 days); Filters (location, team member, type Sale/Refund/Deposit, amount, gift card/deposit redemptions) | ✅ built from sales |
| Gift cards / Packages / Memberships sold | Lists with empty states ("No packages created yet… Set up now") | ✅ empty states; need Catalog tables |

\* Email receipts depend on Marketing → Automations.

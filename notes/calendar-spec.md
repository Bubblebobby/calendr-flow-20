# Calendar: Fresha behaviour spec for Bookly

Recorded from Fresha's partner app on 13 Oct 2026, read-only (nothing saved there).
**DB?** means: ✅ works with Bookly's current tables · 🗄 needs a new table/column (must be created via Lovable).

## A. "Select a time" mode (Add → Appointment / Blocked time, Reschedule, Rebook, Group)
- Full-screen: the purple banner **replaces the top bar and the left rail**. Title centred ("Select a time to book" / "Select a time to block"), ✕ on the right.
- Toolbar stays, but Today, the date stepper and the view menu are greyed out.
- Existing appointments fade (light tint, grey text). For Reschedule, the appointment being moved keeps full colour plus a purple outline.
- Hovering shows the slot start time in a purple pill. Clicking opens the matching panel. ✅

## B. Empty-slot click
- Popover: grey header with **just the time** ("15:00") and ✕. Items: Add appointment · Add group appointment · Add blocked time · purple link "Quick actions settings".
- The clicked slot gets a purple outline with its time. ✅

## C. New appointment panel (drawer)
Left column **Select a client**:
- Collapsed state: "Add client / Or leave empty for walk-ins".
- Open state: search ("Search client or leave empty for walk-in"), **Add new client** (opens the full client form), **Walk-In**, then the client list (avatar initial, name, email). ✅

Right column:
1. **Select a service**: search, then services grouped by category (count badge), each row with a coloured left bar, name, duration, price. ✅
2. After a service is chosen:
   - Header "**Tue 13 Oct ▾**" opens a month calendar.
   - The line "**15:00 · Doesn't repeat**" opens "Edit repeating options" (Frequency: Doesn't repeat / Every day / Every week / Every month / Custom; "Apply changes"). Repeat series: 🗄
   - **Services** cards (grey, coloured left bar): name, "15:00 · 45min · New Man", price, ✏️ and 🗑. "+ Add service". ✅
   - ✏️ → **Edit service** sub-panel (← Back): service picker row, Team member (+ ♡ preferred team member), Service price, Discount, Start time, Duration, "+ Add extra time"; footer Total "45min NGN 40", 🗑, **Apply**. ✅ (preferred flag 🗄)
   - Footer: Total / **To pay ›** (expands Subtotal · Tax · Total) · ⋮ (Quick actions: Add a note, Add payment policy) · **Checkout** (outline) · **Save** (black). ✅
   - Add a note: modal with a rich-text editor and Save. ✅ (plain text into `appointments.notes`)
- Closing with changes shows "**You have unsaved changes**": "If you close the appointment now, the changes will be lost. Do you wish to exit?" Buttons: Go back / Yes, exit. ✅
- Floating round buttons beside the drawer: ✕ close, ⤡ minimise, ◎ focus appointment. ✅

## D. Existing appointment panel
- Left: client avatar, name, email · **Actions ▾** (Remove client, Messages, Add staff alert, Add allergy, Add patch test, Add tag, Edit client details, Block client, Delete client) · **View profile** · Add pronouns · Add date of birth · Created date.
- Right header (blue): date ▾, "11:00 · Doesn't repeat", **status pill ▾**: Booked · Confirmed · Arrived · Started · No-show · Cancel. ✅
- Services as in C. Footer: Total / To pay, ⋮, **Checkout**.
- ⋮ Quick actions: Add a note · Add a form 🗄 · View appointment activity · Set as repeating 🗄 · Add to group appointment 🗄 · Rebook · Reschedule · **No-show** · **Cancel**. ✅ unless marked
- **View appointment activity**: timeline ("Appointment created · Oct 13, 2026, 11:23 · Booked by New, reference 448E70E4"). The created entry is ✅ from `created_at`; full history 🗄
- **Cancel**: full-page "Are you sure you want to cancel?", policy notice, "Send a cancellation notification" checkbox, Cancellation reason (No reason provided / Duplicate appointment / Appointment made by mistake / Client not available), right card "Cancellation details: Appointment total, No fee will be charged", red **Cancel appointment**. ✅ status · reason 🗄
- **Reschedule**: select-a-time mode (A) with the appointment outlined. ✅
- **Rebook**: select-a-time mode, then a new appointment with the same client and services. ✅
- **Checkout**: stepper **Cart → Tip → Payment**. Tip per team member: No tip / 10% / 18% / 25% / Custom. ✅ uses `sales` / `sale_items`; tip column to check.

## E. Add menu
- Appointment → A then C. ✅
- Group appointment → drawer "Create new appointment / Select existing appointment", then C with a group id. 🗄
- Blocked time → A ("Select a time to block"), then the **Add blocked time** drawer: type cards (Custom, Lunch 30 min unpaid, Training 1 hr paid, Meeting 1 hr paid, New type), Title, Date, Start/End time (5-minute steps, "15 min duration" hint), Team member, Frequency, Description (0/255), "Online booking allowed during blocked time", Save. Shows on the grid as a grey "15:00 - 15:15 Blocked time" block. 🗄
- Sale, Quick payment → checkout without an appointment. ✅ (sales tables)

## F. Toolbar drawers
- **Visibility filters** ("All filters", Saved filters ▾): Appointment status (Booked, Confirmed, Arrived, Started, Completed, No-show), Type, Channel, Payment status, Services (Edit), Appointment creation date, Requested team member, Client segments; ⋮ · Clear filters · Apply. ✅ (client-side)
- **Calendar settings** ("Your calendar settings"): Calendar zoom slider (default "Medium small"), "Show quick actions on calendar" toggle, Apply changes. ✅ (saved per browser)
- **Waitlist**: tabs Waiting / Expired / Booked, All upcoming ▾, sort ▾, ⋮, Add → wizard Client › Date and time (Date, Start time "Any time", + Add another time) › Service › Service add-ons. 🗄

## G. Hover card on an appointment ✅ (already built)

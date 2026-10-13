# Fresha partner app: full teardown

Explored 13 Oct 2026 on a new Fresha trial account ("New Stylers", Lagos, NGN).
The account held sample data only: team members *New Man* (owner) and *Wendy Smith (Demo)*,
4 services, 3 sample appointments. Everything was viewed read-only: nothing was saved.

**Legend for "Bookly":** ✅ built · 🟡 partly built · ❌ missing

---

## 0. App shell

| Element | What it does |
|---|---|
| Left icon rail | Home · Calendar · Sales · Clients · Catalog · Online booking · Marketing · Team · Reports · Add-ons · Settings · Help (bottom). Clicking a section with sub-pages opens a **flyout sub-menu** next to the rail; the same sub-menu then stays as a collapsible second column on that section's pages. |
| Top bar | "Continue setup" (onboarding checklist) · Search · Performance insights (chart icon) · Notifications (badge) · Fresha Connect (messages) · Avatar/user menu |
| Drawers | Almost every detail/edit view is a **right-side drawer with its own URL** (e.g. `/calendar/drawer/view-appointment/:id`, `/team/team-members/drawer/team-member/:id/personal`). Deep-linkable, and the back button works. |
| Upsell pages | Unused features show a full-page "INCLUDED IN YOUR PLAN" or paid add-on promo with a **Start now** button instead of an empty table. |
| Onboarding | Guides drawer (News / Help / Guides) with a gamified 3-step checklist: create account ✅ → create first appointment → check out an appointment. Sample data is seeded at signup. |

Bookly: 🟡 rail plus second-column sub-nav exist (`components/nav`); no drawers-with-URLs, global search, notifications or upsell/empty-state pattern.

---

## 1. Home (`/dashboard`)

Card grid:
- **Recent sales**, last 7 days: total sales, appointment count and value, line chart (Sales vs Appointments). Filter menu.
- **Upcoming appointments**, next 7 days: chart, or "Your schedule is empty".
- **Appointments activity**: feed of latest bookings (date badge, status pill, service, client, duration, staff).
- **Today's next appointments**: same card style.
- **Top services**: table of this month vs last month.
- **Top team member**: table of this month vs last month.

Bookly: 🟡 `home-dashboard.tsx` has Recent sales, Upcoming appointments and Appointments activity. Missing: Today's next, Top services, Top team member.

---

## 2. Calendar (`/calendar`)

**Toolbar:** Today · ‹ date › · Team selector · Visibility filters · Calendar settings (gear) · Waitlist · Refresh/reset view · View (**Day / 3 day / Week / Month**) · **Add ▾**

- **Columns:** one per team member, with avatar and name.
- **Grid:** hatched grey outside working hours; red **now-line** with a time pill.
- **Appointment blocks:** time, client name and service. Hovering shows a popover card with status, client, service, price and staff.
- **Team selector:** search; *Scheduled team* / *All team* / *Me*; checkboxes per team member.
- **Visibility filters drawer:** Appointment status, Type, Channel, Payment status, Services, Creation date, Requested team member, Client segments; saved filters; Clear / Apply.
- **Calendar settings drawer:** zoom slider; "Show quick actions on calendar" toggle.
- **Waitlist drawer:** tabs Waiting / Expired / Booked; filter All upcoming; sort; Add.
- **Add ▾:** Appointment · Group appointment · Blocked time · Sale · Quick payment.

**New appointment flow**
1. Add → Appointment switches to a "**Select a time to book**" mode with a purple banner and a "View available times" button. Or click any empty slot directly.
2. A drawer opens. Left: **Add client** ("or leave empty for walk-ins"). Right: **Select a service** (searchable, grouped by category, with duration and price).
3. Then edit time, staff and repeat, and Save.

**Appointment drawer** (`/calendar/drawer/view-appointment/:id`)
- **Left, client panel:** avatar, name, email, pronouns, date of birth, created date. **Actions ▾**: Remove client, Messages, Add staff alert, Add allergy, Add patch test, Add tag, Edit client details, Block client, Delete client. Plus **View profile**.
- **Right, header:** date (editable), "11:00 · Doesn't repeat", **status dropdown**: Booked · Confirmed · Arrived · Started · No-show · Cancel.
- **Services list:** service, time, duration, staff, price; Edit/Remove; **+ Add service**.
- **Footer:** Total, To pay, **⋮ menu** (Add a note, Add a form, View appointment activity, Set as repeating, Add to group appointment, Rebook, Reschedule, No-show, Cancel), and **Checkout**.

**Checkout** (`/calendar/drawer/new-sale/...`): stepper **Cart → Tip → Payment**.
- **Cart:** items, Add to cart.
- **Tip:** for each staff member: No tip / 10% / 18% / 25% / Custom.
- **Payment:** method.

Bookly: 🟡 `day-calendar.tsx` plus appointment dialog/detail exist. Missing: 3-day/week/month views, now-line, hatched hours, team selector, filters, waitlist, blocked time, group appointments, status workflow, the appointment ⋮ actions, and tips in checkout.

---

## 3. Sales

| Page | Contents | Bookly |
|---|---|---|
| Daily sales summary | Date picker; **Transaction summary** (Services, Add-ons, Products, Shipping, Gift cards, Packages, Memberships, Late-cancel fees, No-show fees, Refunds, Total) and **Cash movement** (Cash, Other, Gift card redemptions, Payments collected, Of which tips). Export, Add new. | ✅ |
| Register | Cash drawer: open/close day, cash in/out, petty cash, float. (Upsell page until started.) | ❌ placeholder |
| Appointments | Table: Ref #, Client, Service, Created by, Created date, Scheduled date, Duration, Staff, Price, Status. Search, Month to date, Filters, Sort, Export. | ✅ |
| Sales | Tabs **Sales / Drafts**; search, date, filters, sort; Create new sale. | ✅ |
| Payments | Payment transactions in a date range; search, filters. | ❌ |
| Gift cards sold | List, with an Options menu. | ❌ |
| Packages sold | Search, status filter. | ❌ |
| Memberships sold | Search, Export. | ❌ |

---

## 4. Clients

| Page | Contents | Bookly |
|---|---|---|
| Clients list | Count badge; **Import your client list** banner; search (name/email/phone); Filters; sort; table: Client name, Mobile, Reviews, Sales, Created at; bulk-select checkboxes; Options, Add. | ✅ list and form (also has addresses and tags) |
| Client profile | Pronouns, DOB, alerts, allergies, patch tests, tags, block, messages (see appointment drawer). | 🟡 `client.$clientId` route |
| Client segments | **Standard** auto-segments: New clients (last 30 days), Recent clients, First visit, Loyal (2+ sales in 5 months), Lapsed (3+ sales in 12 months, none in 2 months), High spenders (> ₦500 in 12 months), Upcoming birthdays. **Custom**: Booked online, Upcoming appts, With sales, Imported. Each with a live count and Actions. | ❌ |
| Client loyalty | Paid add-on: points, tiers, referrals (₦22,500 per location per month). | ❌ (later) |
| Online reputation | Overall rating, total reviews, response rate, 5→1 star breakdown, All reviews tab, **Connect Google**. | ❌ |

---

## 5. Catalog

| Page | Contents | Bookly |
|---|---|---|
| Service menu | Categories sidebar (with counts, Add category); services grouped by category (name, duration, price, ⋮); search; Filters; **Manage order** (drag); Add ▾ = Single service / Bundle / Category. | ✅ (services, bundles, categories) |
| Packages | Bundles of sessions sold up front (e.g. "Spa Package: 6 sessions, ₦40,000, save ₦10,000"). | ❌ |
| Products | Retail inventory: brands, categories, low-stock alerts, sell at checkout. | ❌ |
| Stocktakes / Stock orders / Suppliers | Inventory counts, purchase orders, supplier directory. | ❌ (later) |

**Edit service** (full-page form with a left tab list; each tab is a `?section=` URL):
- **Basic details:** name, menu category, treatment type (marketplace taxonomy), description (with "Generate with AI").
- **Pricing and duration:** price type (Free / From / Fixed), price, duration (5 min to 12 hr), **Add extra time** (processing/blocked), Options.
- **Team members:** "All team members" or a checkbox per person.
- **Resources:** rooms and equipment the service needs.
- **Service add-ons:** add-on groups that clients can choose.
- **Online booking:** enable toggle; available for All / Female only / Male only; **Upselling** (service, membership, package); **Limit availability** (date range; days of week and time of day).
- **Portfolio images.**
- **Forms:** attach consultation forms with a policy (e.g. "every time they book").
- **Commissions:** per-staff commission toggle and table.
- **Settings:** require patch test; aftercare instructions; **rebook reminder** (e.g. 4 weeks after); sales tax.

Bookly: 🟡 service form, team members and portfolio images exist. Missing: extra time, resources, add-ons, online-booking rules, forms, commissions, rebook reminder, tax.

---

## 6. Online booking

| Page | Contents | Bookly |
|---|---|---|
| Marketplace profile | Public listing on the Fresha app/marketplace (photos, rating, hours, services). | ❌ placeholder |
| Reserve with Google | Book from Google Search/Maps (currently redirects to Add-ons). | ❌ |
| Facebook and Instagram bookings | "Book now" button on social pages. | ❌ |
| **Link builder** | "Link to everything" (one link covering all bookable items) and "Link to services" (specific services, locations or staff), with **QR codes**. | ❌ ← quick win |
| Smart Website | Auto-updating salon website (paid add-on, ₦13,500/month). | ❌ |

---

## 7. Marketing

| Page | Contents | Bookly |
|---|---|---|
| Blast campaigns | Email/SMS campaigns to all clients, segments or individuals, with reporting. | ❌ |
| **Automations** | Prepaid **communication balance** with auto top-up. Message categories: **Reminders** (3 days / 24 h / 1 h before); **Appointment updates** (new, rescheduled, canceled, no-show, thank-you with review link); **Waitlist** (joined, slot available); **Increase bookings** (rebook reminder, birthdays, win back lapsed clients, reward loyal clients); **Milestones** (welcome new clients); **Client messages**; **Loyalty**. Each has an Enabled/Enable toggle. Channels: text, WhatsApp, email, app push. | ❌ |
| Messages history | Log of every message sent. | ❌ |
| Deals | Discount codes, flash sales, last-minute offers. | ❌ |
| Smart pricing | Peak/off-peak price rules by time of day. | ❌ |
| Reviews | Same as Clients → Online reputation. | ❌ |

---

## 8. Team

| Page | Contents | Bookly |
|---|---|---|
| Team members | Table: Name, Contact, **Permission role**; search, filters, custom order; Add; free-trial banner. | ✅ list, form and invite |
| Team member drawer | Header (name, photo, Actions, "has role X → Grant access"). Tabs: **Overview** (performance: sales, appointments, clients, occupancy, retention vs previous period), **Personal** (name, email, phone, DOB, country, gender, pronouns, **calendar color**, job title; employment start, employment type, team member ID), **Workspace** (services provided, calendar bookings on/off, permission role, linked calendars, locations), **Pay** (wages and timesheets, commissions, pay-run settings). | 🟡 |
| **Scheduled shifts** | Weekly roster grid: one row per staff member with total hours, cells like "10:00–19:00" or "Not working", daily totals, week navigation; Add, Options. Note: "roster is separate from business opening hours". | ❌ placeholder |
| Timesheets | Clock in/out, breaks, attendance. | ❌ |
| Pay runs | Wages, commissions and tips combined into payroll. | ❌ |

---

## 9. Reports (`/reports`)

59 reports: 3 dashboards, 49 standard, 10 premium. Left list: All, Favourites, Dashboards, Standard, Premium, Custom, Folders, Data connector. Category tabs: Sales · Finance · Appointments · Team · Clients · Inventory. Search, star favourites.

Key reports to copy first:
- **Dashboards:** Performance, Online presence, Loyalty.
- **Sales:** summary, list, by time period, log detail; gift card, membership and package lists and summaries.
- **Finance:** finance summary, payments summary, payment transactions, cash-flow, taxes, discounts, liabilities, prepayments, cash register.
- **Appointments:** summary, list, cancellations and no-shows, waitlist.
- **Team:** working hours, breaks, attendance, wages, fees, pay summary, scheduled shifts, time off, tips, commissions.
- **Clients:** summary, list, insights.
- **Inventory:** stock on hand, stock movement, products, ordered stock.

Bookly: ❌ no reports section.

---

## 10. Add-ons (`/add-ons`)

- **Add-ons:** Payments, Premium Support, Insights, Google Rating Boost, Client Loyalty, Data Connector, Client Connect (2-way inbox), Smart Website, Team Connect (team chat), Bookable Resources.
- **Integrations:** Xero, QuickBooks, Facebook/Instagram bookings, Meta Pixel, Google Analytics, Google Ads.

Bookly: ❌. A marketplace like this is probably a later concern.

---

## 11. Workspace settings (`/setup`)

Card grid with tabs **Settings · Online presence · Marketing · Other**. Each card opens a page with its own left sub-nav:

| Card | Sub-pages |
|---|---|
| Business setup | Business details (name, country, currency, tax calculation "retail prices include tax", team and client language, social links) · Locations · Service menu · Product list · Memberships · Packages · Clients list |
| Scheduling | Time and calendar (timezone, 12/24 h, first day of week, appointment color source, show processing/blocked time) · Waitlist · **Blocked time types** · Resources · **Cancellation reasons** · **Appointment statuses** · **Closed periods** · Online booking: Dynamic assignment, Availability, Booking options |
| Sales | Pay now · Tax rates · Receipts · Registers · Tipping · Service charges · Gift cards · Custom checkout methods · Payment settings |
| Clients | **Client sources** (Contact page, Referral link, Walk-in, Instagram, Imported, Google, Marketplace, Facebook, Book Now link) · Client tags · Client Connect |
| Billing | Billing details · Payment methods · Communication balance · Invoices and fees · Subscriptions |
| Team | **Permission roles** (Basic, Low, Medium, High, Owner, No access, each a bundle of section-level access) · Time-off types · Timesheets · Shifts · Pay runs · Commissions · PIN switching |
| Forms | Form templates (e.g. COVID-19 consultation form) |
| Payments | Payment policy (prepay, no-show and late-cancel fees) · Payment methods · Card terminals |

Bookly: 🟡 Business details, Business hours, Locations, Billing (sub-nav). Missing most of the scheduling, sales, clients, team and payments settings above.

---

## Suggested build order for Bookly

Ordered so each step makes the next one useful:

1. **Calendar core:** week/3-day views, now-line, hatched non-working hours, team selector, status workflow (Booked → Confirmed → Arrived → Started → Completed / No-show / Cancel), blocked time.
2. **Scheduled shifts** (weekly roster). The calendar's working hours and online availability depend on it.
3. **Appointment drawer actions:** notes, reschedule, rebook, repeat, activity log. Then **checkout with tips**.
4. **Client profile depth:** alerts, allergies, tags, block. Then **client segments**, which are all computable from existing data.
5. **Online booking:** public booking page plus the **Link builder** (shareable links and QR codes).
6. **Automations:** reminders (3 days / 24 h / 1 h) and appointment update messages. Email first; SMS/WhatsApp later.
7. **Settings:** cancellation reasons, closed periods, tax rates, tipping, client sources, permission roles.
8. **Reports:** start with Sales summary, Appointments summary, Cancellations and no-shows, and Team performance.
9. Later: Payments, Gift cards and Packages, Products and inventory, Deals, Smart pricing, Loyalty, Pay runs, Add-on marketplace.

**Design patterns worth copying everywhere:** URL-addressable drawers; an "upsell/intro" page for every unused feature instead of an empty table; seeded sample data at signup; an onboarding checklist in the top bar.

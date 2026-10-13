# Clients: Fresha behaviour spec for Bookly

Recorded from Fresha on 13 Oct 2026, read-only.

| Area | Fresha | Bookly |
|---|---|---|
| Sub-menu | Clients: Clients list, Client segments · Engage: Client loyalty, Online reputation | ✅ same structure (`/clients?tab=…`) |
| Clients list | Count badge; Options ▾ (Import clients, Merge clients, Export: Excel, CSV); black Add; dismissible "Import your client list" banner; search "Name, email or phone"; Filters drawer (Client segments, Client group, Blocked clients, Fresha verified, Gender); sort; columns ☐, Client name (avatar, name, email), Mobile number, Reviews, Sales, Created at | ✅ CSV export works; filters: gender, client source, tag; Import/Merge/Excel later |
| Add client | Full-page form: Profile, Addresses, Emergency contacts, Settings; Close / Save (black) | ✅ already existed; Save now black |
| Client profile | Full-screen: left = avatar, name, email, **Actions ▾** (Messages, Sell, Add staff alert, Add simple note, Add allergy, Add patch test, Add tag, Add reward, Edit client details, Merge profiles, Block client, Delete), **Book now**, pronouns, birthday, created. Middle menu = Overview, Appointments (count), Sales, Client details, Items, Records ▾ (Notes, Allergies, Patch tests, Client forms, Files), Wallet, Loyalty, Reviews | ✅ built. Working: Overview stats, Appointments timeline with Checkout, Sales (Sell, resume drafts), Client details (+ tags add/create/remove, addresses), Items (services sold), Notes, Book now → calendar with client prefilled, Sell → checkout, Delete. Need DB: staff alerts, allergies, patch tests, forms, files, block, rewards |
| Client segments | Standard: New clients, Recent clients, First visit, Loyal, Lapsed, High spenders, Upcoming birthdays. Custom: booked online, upcoming appointments, with sales, imported. Each with count + Actions | ✅ live counts from Bookly data; Actions → View clients / Send a campaign*; custom segments need DB |
| Client loyalty | Paid add-on intro | ✅ intro page |
| Online reputation | Overview/All reviews, overall rating, total reviews, response rate, star breakdown, Connect Google | ✅ page; reviews arrive with online booking |

\* Campaigns arrive with Marketing.

Bugs fixed while here: Clients page crashed ("Invalid time value") after visiting the Add/Edit client form (the form's referral picker shared the list's cache key); side-menu highlighted every sub-item that shared a page, and the sub-menu didn't follow route changes.

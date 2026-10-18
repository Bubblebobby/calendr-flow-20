# Catalog: Fresha reference (captured 17 Oct 2026)

Measured at 1440×900 on partners.fresha.com/catalogue/services.

## Service menu
- Page bg #f5f5f5; content 1024px wide (x 348–1372). Title 28/36/600, subtitle 15/20 #767676 + purple "Learn more".
- Options (white, 1px #d3d3d3) and Add (black) pills: 48px, 17px/600.
  - Options: Quick booking link, Set menu order, Set booking sequence, Bulk edit services, Settings | Download PDF, Download Excel, Download CSV (all with icons).
  - Add: Single service, Bundle | Category.
- Toolbar card: white, radius 12, inset 1px #e5e5e5 ring, padding 16. Search pill 36px ("Search service name"), Filters chip; Manage order chip on the right.
- Categories card: 296px, white, radius 12, padding 24/32. "Categories" 20/28/600. Rows 44px, radius 8, padding 12/16, 15/500; active #f0f0ff. Count badge 20px, rgba(19,19,19,.05), 13/600 #767676. "Add category" row in purple.
- Right column at x 676 (32px gap). Category heading 20/28/600 + Actions chip (36px): Edit, Add service, Add bundle, Archive, Permanently delete (red #d4163a).
- Service card: 696×96, white, radius 12, inset ring #e5e5e5, 8px category-colour stripe on the left (Blue = #a5dff8). Name 17/24/500, duration 15/20 #767676, price 15/20/500, 36px ⋮ button. 12px between cards.
  - ⋮ menu: Edit, Duplicate, Quick booking link | Archive, Permanently delete.
- Menu items: 40px, padding 8/12, radius 8, 15/20/500.
- Confirm modals: 512px, radius 16, title 20/28/600, close ×, one line ("Are you sure you want to archive this service?"), Cancel + Archive (black) / Delete (red), equal width, 48px.
- Filters modal (512px): Status (All statuses/Active/Archived), Type (All types/Services/Bundles), Team member, Online bookings, Commissions, Resource requirements, Employee requirements; Cancel/Apply.
- Add category: 720px modal, URL /catalogue/services/categories/add. Title 28px. Category name ("e.g. Hair Services") + Appointment color (17 named colours: Blue, Dark Blue, Jordy Blue, Indigo, Lavender, Purple, Wisteria, Pink, Coral, Blood Orange, Orange, Amber, Yellow, Lime, Green, Teal, Cyan), Description 0/255. Cancel/Add.
- Manage order: full-screen /catalogue/services/reorder. Close/Save top right; "Set menu order" title; "Define the order that services will appear to clients when booking online."; "Categories and services" dropdown; card with draggable category + service rows (colour stripe + handle).

## Edit service (/catalogue/services/service/edit/:id?section=…)
- Page bg #f5f5f5; 72px top bar (Close / Save, 48px pills). H1 "Edit service" 40/44/700 at x 128.
- Left nav card 296px at x 128 (items 44px, 15/500, active #f0f0ff; "Settings" group heading 17/24/600; count badges).
  Sections: Basic details, Team members, Resources, Service add-ons | Settings: Online booking, Portfolio images, Forms, Commissions, Settings.
- Section cards: 792px at x 520, white, radius 16, 1px #e5e5e5, padding 32/40; titles 24/32/600. Labels 15/600, inputs 48px radius 8 border #d3d3d3, helper 13/16 #767676, counters 15px #767676.
- Pricing and duration: Price type (Free/From/Fixed), Price (NGN), Duration (5 min – 12 hr). "Add extra time" menu: Processing time / Blocked time / Extra servicing time (each with a one-line explanation). Options: Add variant, Advanced pricing and duration.
- Settings section: Require patch test; Aftercare instructions; Reminder to rebook (Weeks/Days after); Sales tax; Cost of service (NGN or %); SKU (0/20).

## Bookly status
Done: everything on the Service menu above, Manage order (pointer drag), Duplicate, Archive/Delete with confirm, category CRUD + archive, exports, Edit service styling.
Placeholders: Quick booking link, Set booking sequence, Bulk edit, menu Settings; Filters for online booking/commissions/resources; Resources, Add-ons, Online booking, Forms, Commissions and Settings sections of the service form; Packages/Products/Inventory need their own tables.

# Home dashboard

## What I’ll build
- Replace the Home placeholder with a light-mode, two-column grid matching the supplied dashboard reference.
- Add six compact cards: Recent sales, Upcoming appointments, Appointments activity, Today’s next appointments, Top services, and Top team member.
- Use real appointment, service, client, and team-member data for the current business only.
- Keep sales honestly at zero until sales data exists, while calculating appointment counts and appointment value from booking items.
- Add localized currency, status treatments, empty states, Calendar navigation, and three-dot “Coming soon” actions.

## Data behavior
- Recent sales covers the last seven days and excludes cancelled appointments.
- Upcoming appointments covers the next seven days and excludes cancelled appointments.
- Activity is newest first; today’s list is chronological.
- Top services compares appointment counts in the current calendar month with the previous calendar month.
- All date ranges use the business timezone where available, and all money uses the business currency.

## Technical details
- Load the dashboard through the existing browser database client so current row-level access rules enforce business isolation.
- Use the existing chart package and semantic design tokens; no new database tables or sales calculations will be introduced.
- Add loading and error states, then verify type checks, preview build status, and the visible layout at desktop and mobile widths where authentication permits.

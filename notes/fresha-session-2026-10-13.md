# Fresha walkthrough — 13 Oct 2026

Reference notes from exploring Fresha's partner app, for comparison with Bookly.

> The click-by-click recording was lost when the browser moved from `www.fresha.com`
> to `partners.fresha.com`, so the steps below are reconstructed from the final page
> URL and screen, not recorded directly.

## Path taken

1. **www.fresha.com/appointments**: started on Fresha's customer-facing site.
2. **partners.fresha.com**: moved into the business ("partner") app.
3. **Onboarding → "partner recommendation source"**: an onboarding step asking how
   the business heard about Fresha. (Bookly has the same idea: `heard-about-step.tsx`.)
4. **Calendar (Day view, Tue 13 Oct)**: landed on the calendar after onboarding.
5. **Side drawer → Resources → Guides**: opened the "Learn how to use your new
   Fresha account" guide panel.

## What the screen showed

**Calendar**
- Day view with Today / ‹ › date controls, one column per team member.
- A single team member column, "New Man" (initials avatar "NM"). Fresha creates a
  starter team member, so the calendar is never empty.
- **Sample appointments come pre-filled:** 11:00–11:45 *John Doe, Haircut* and
  13:00–14:15 *Jane Doe, Hair Color*.
- Hours outside business hours are hatched grey; a red line marks the current time (11:24).

**Left nav (icons):** Home, Calendar, Sales (tag), Clients (smiley), Catalog (book),
Team/profile, Marketing (megaphone), Team, Reports (chart), Add-ons, Settings, Help.

**Guides drawer** (tabs: News / Help / Guides)
- Gamified header: "Legendary Learner" with badge icons.
- Intro video ("selfcare just got fresha").
- 3-step checklist: ✅ Create your Fresha account → Create your first appointment →
  Check out an appointment. Plus "Skip this guide".
- Help center link below.

## Ideas for Bookly

| Fresha does | Bookly today | Idea |
|---|---|---|
| Seeds a starter team member + sample appointments | Calendar shows "No team members yet" empty state | Auto-create the owner as the first team member during setup, and optionally add demo appointments |
| Current-time line, hatched closed hours | Calendar has day view; not checked yet | Add a now-line and shade time outside business hours (data already exists in Settings → Business hours) |
| In-app guide drawer with a 3-step checklist | "Continue setup" button in the header | Turn "Continue setup" into a checklist: account → first appointment → first checkout |
| Marketing and Reports sections in nav | Not present | Future sections to consider |

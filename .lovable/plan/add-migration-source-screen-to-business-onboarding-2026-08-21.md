# Add migration-source screen to business onboarding

## Goal
Add a new onboarding screen that asks which booking/appointment software the business is currently using. Store the answer for later use; the actual migration import will be built later. Fresha must be included in the list. The screen sits within the existing Step 5 group (location + migration + future substeps), so the top 5-segment progress bar stays unchanged and Step 5 remains active.

## What will be built

### 1. Database schema
- Add `migration_source` (text, nullable) to `public.businesses`.
- No data migration required; the column is nullable and write-once during onboarding.

### 2. New UI component
- Create `src/components/migration-source-step.tsx`.
- Display a single-select radio list matching the screenshot:
  - Acuity, Booksy, Calendly, Fresha, Goldie, Jane App, Mindbody, Salon Iris, Setmore, Shortcuts, Square, Styleseat, Timely, Treatwell, Vagaro, Zenoti.
  - "I'm not using any software".
  - "Other" with an input field that appears when selected.
- Allow users to skip by selecting "I'm not using any software" or clicking a Close/skip button (saves `null`).
- Continue button saves the selection and advances to the next substep.

### 3. Step 5 rework in `src/routes/business-setup.tsx`
- Convert Step 5 from a single screen into a multi-substep group while keeping the 5-segment progress bar.
- Substep 5a: Venue location (existing).
- Substep 5b: Migration source (new).
- Substep 5c+: placeholder for future screens.
- Persist the business record after each substep, including `setup_step` so users can resume.
- Update the final completion guard so the user is not prematurely sent to the dashboard until all Step 5 substeps are complete.
- Adjust the Continue/Back button logic so Back moves between substeps within Step 5 and then back to Step 4 as before.

### 4. Copy and style
- Use the existing onboarding copy style ("Account setup", large bold heading, muted subtext, rounded cards, primary ring on selection).
- Match the clean white layout and pill-shaped Continue button already in the wizard.

## Out of scope
- Actual data import from the selected platform.
- API integrations with third-party booking systems.
- Any change to the total number of progress-bar segments.

## Verification
- After implementation, a new user completing the onboarding will see the migration screen after setting their location, be able to select/skip it, and land on the next planned substep (currently a placeholder or the final dashboard if no further substeps are defined yet).
- `businesses.migration_source` will persist the selected value and be readable via the MCP `get_business` tool.

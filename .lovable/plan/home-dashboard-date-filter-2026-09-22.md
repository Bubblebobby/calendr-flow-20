# Home dashboard date filter

## What I’ll change
- Replace the Recent sales three-dot placeholder with the compact popover shown in the reference.
- Include a “Time period” label, period selector, outlined Close button, and dark Apply changes button.
- Keep the selected period temporary until Apply changes is pressed; Close dismisses it without changing dashboard data.
- Update the sales summary, appointment totals, and chart to reflect the applied period while keeping Sales at an honest zero.
- Refine the Home dashboard typography and spacing to match the reference’s clean, rounded, medium-weight appearance while retaining the existing Plus Jakarta Sans family.

## Periods
- Last 7 days
- Last 30 days
- This month
- Last month

## Technical details
- Continue using business-scoped appointment data, the business timezone, and locale-aware business currency.
- Use the existing popover, select, and button components with semantic design tokens.
- Keep the Upcoming appointments menu unchanged because its data range remains specifically “Next 7 days.”

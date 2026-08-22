# Fit the onboarding flow to the viewport

Make the sign-in, profile onboarding, and business setup screens always occupy exactly one screen height, with scrolling appearing only when the content genuinely cannot fit (small phones, short laptop windows, large text settings).

## What changes

**Business setup wizard (steps 1-7 and the success screen)**
- Turn the page into a fixed-height shell: progress bar and the back/continue header stay pinned at the top, and only the step content area scrolls when it overflows.
- Content area is vertically centred when it fits, top-aligned when it does not, so short steps (business name, team size) no longer sit high with dead space below.
- Remove the fixed bottom padding that currently forces the page to be taller than the screen.

**Step content density**
- Fluid heading sizes: smaller on short/narrow viewports, current size on desktop.
- Tighten the vertical rhythm between heading, description, and fields at small heights.
- Category grid, option cards, and the location map shrink in height on small viewports instead of pushing the page long.

**Profile onboarding and sign-in shell**
- Same treatment already applied to the shared auth shell, extended so the form column centres when it fits and scrolls internally when it does not, at every breakpoint.

**Mobile**
- Single-column stacking, full-width pill controls, comfortable tap targets, and the setup header collapsing to a compact row on narrow screens.

## Technical notes

- Use `100svh`/`100dvh` based heights so mobile browser chrome does not cause an unwanted scrollbar.
- Layout pattern per screen: outer `h-[100svh] flex flex-col overflow-hidden`, pinned header, then `flex-1 min-h-0 overflow-y-auto` content wrapper with a centring inner container (`my-auto`).
- Fluid type via `clamp()` on the step headings rather than adding new breakpoints everywhere.
- Presentation-only work: no changes to step logic, validation, or database writes.

# Plan: Fill the right section of the auth screen with the salon image

## Goal
Update the split-screen auth layout so the uploaded salon interior photo fills the entire right column edge-to-edge, with no card frame or caption text overlay.

## Current state
`src/components/auth-shell.tsx` renders the right column as a centered card (`surface-flat`) containing the image plus a caption block (`Built for service businesses / Salons, spas...`). The image is constrained to `h-[420px]` and sits inside the card.

## Changes
1. **Remove the card wrapper** in `src/components/auth-shell.tsx`:
   - Drop the `<figure>` and `<figcaption>` elements.
   - Remove the secondary-colored background and padding from the right column.
   - Replace with a full-bleed `<img>` that covers the right column.

2. **Make the image fill the right column**:
   - Apply `w-full h-full object-cover` to the image.
   - Ensure the right column itself is `relative overflow-hidden` and fills the full height of the viewport (`min-h-screen` inherited from the grid).

3. **Preserve accessibility**:
   - Keep the descriptive `alt` text on the image.

## Files to modify
- `src/components/auth-shell.tsx`

## Out of scope
- No changes to the left (form) column, auth logic, or color tokens.
- No new assets or dependencies.

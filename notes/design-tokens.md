# Bookly design tokens (measured from Fresha, 13 Oct 2026)

Values read with getComputedStyle on Fresha's partner app and applied in `src/styles.css`.

| Token | Value | Used for |
|---|---|---|
| `--foreground` | `#0d0d0d` | Text, primary buttons (`bg-ink`), side rail |
| `--muted-foreground` | `#767676` | Subtitles, secondary text |
| `--primary` | `#6950f3` | Links, active rail item, focus, accents |
| `--accent` | `#f0f0ff` | Active sub-menu item, avatar circles |
| `--border` | `#e5e5e5` | Dividers, table row lines, top bar, sub-menu edge |
| `--input` | `#d3d3d3` | Secondary buttons, chips, inputs, checkboxes |
| `--secondary` | `#f5f5f5` | Hover on menus/secondary buttons |
| `--toolbar` | `#f9f9f9` | Filter bars, calendar toolbar, table row hover |
| `--surface` | `#f5f5f5` | Home dashboard background (list pages are white) |
| `--radius` | `12px` | Cards, filter bars |

**Type scale** (Tailwind classes defined in `styles.css`, measured with a text census of Fresha pages):

| Class | Size / line | Weights used | Roles |
|---|---|---|---|
| `text-display` | 28 / 36 | 600 | Page & drawer titles, big amounts |
| `text-title` | 20 / 28 | 600 | Card titles, empty-state titles, banner titles |
| `text-heading` | 17 / 24 | 600 · 500 | Section & sub-menu group headings, header buttons, list item names (600), service names & prices in panels (500), menu headings |
| `text-body` | 15 / 20 | 400 · 500 · 600 | Body, table cells (400), sub-menu items, menu items, chips (500), table headers, form labels (600) |
| `text-caption` | 13 / 16 | 400 · 500 · 600 | Status pills (500), calendar blocks, helper text, badges |

Colours: text `#0d0d0d`; secondary `#767676`; placeholder `#bfbfbf`; links `#6950f3` (weight 400); destructive `#d4163a`. Bold (700) is not used except the logo.
Avatars: client initials 17/600 `#6950f3` on `#f0f0ff`; team/top-bar initials 16–17/600 `#0075a8` on `#ebf8fe`.
`cn()` is configured (src/lib/utils.ts) so `text-body text-foreground` keeps both size and colour.

**Buttons:** primary = black, white 17px semibold label, 48px tall, fully rounded (header); toolbar chips = 36px, white, `#d3d3d3` border, 15px medium; icon buttons in toolbars are 36px circles.

**Layout:** top bar 64px white with `#e5e5e5` bottom border; rail 72px `#0d0d0d`, 44px items with 8px radius, active `#6950f3` + white icon, help icon at the bottom, no logo; sub-menu 208px with 1px right border, 24px top padding, 44px items, 8px radius; content padding 32px.

**Tables (`.data-table`):** headers 13px bold, 56px tall, 1px `#e5e5e5` bottom border; cells 16px padding; row hover `#f9f9f9`; no outer card border; "Viewing x - y of z results" centred below.

**Checkboxes:** 20px, 4px radius, `#d3d3d3` border; checked = purple.

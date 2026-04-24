# Handoff: Global Search Bar in Topbar

## Overview
Add a **persistent global search trigger** to the portal's topbar that opens a ⌘K command palette. The trigger is visible on every page, sits to the left of the notification bell, and gives users a single obvious entry point for searching files, jumping to pages, and running actions.

This is the "always-on" surface for what is otherwise a keyboard-only pattern — it makes the command palette discoverable to non-power users while keeping the topbar clean.

## About the Design Files
The file in `design-reference/Portal UX Enhancements.html` is a **design reference created in HTML** — a prototype showing the intended look and behavior. It is **not production code to copy directly**. The task is to recreate this design inside the existing Next.js + Tailwind codebase at `src/components/layout/topbar.tsx`, reusing the codebase's established patterns, CSS variables (`--surface`, `--border`, `--accent`, etc.), and the `cn()` helper from `@/lib/utils`.

The relevant artboard in the HTML file is labelled **"Global search in topbar — the ⌘K surface, always visible"** in the "Navigation + findability" section.

## Fidelity
**High-fidelity.** Colors, spacing, type scale, and interactions are final. Match the pixel values exactly when implementing.

## Scope of this handoff
Two pieces:
1. **The search trigger button** in the topbar (always visible).
2. **The ⌘K command palette modal** that opens when the trigger (or ⌘K / Ctrl+K) is pressed.

The actual search backend (Supabase query, index, etc.) is **out of scope** — wire the UI to a mock `searchItems()` function that the backend team can replace.

---

## Component 1 — Search Trigger in Topbar

### Location in codebase
`src/components/layout/topbar.tsx` — insert between the bell icon's wrapping `<div>` and the existing title block, as the first element inside the right-hand flex group.

### Layout
- Horizontal button, 36px tall
- Sits to the **left of the notification bell** in the topbar's right-hand flex group
- Width: flexible, `min-width: 220px`, `max-width: 320px`

### Visual spec
- **Height**: 36px
- **Padding**: `0 12px`
- **Border radius**: 8px (`rounded-lg`)
- **Background**: `var(--surface)` (i.e. `#111113`)
- **Border**: `1px solid var(--border)` (`#27272a`)
- **Text color**: `var(--foreground-muted)` (`#a1a1aa`)
- **Font size**: 12px (`text-xs`)
- **Hover**: background shifts to `var(--surface-2)` (`#1a1a1e`), border to `var(--foreground-subtle)` at 40% opacity
- **Focus-visible**: 1px `var(--accent)` ring, 30% opacity

### Contents (left to right)
1. **Search icon** — `Search` from `lucide-react`, 14px, `var(--foreground-muted)`
2. **Placeholder text** — "Search everything…" — `text-xs`, `var(--foreground-muted)`
3. **Spacer** — `margin-left: auto` on the kbd group so the shortcut hugs the right edge
4. **Kbd group** — two `<kbd>` elements side-by-side, `gap: 2px`:
   - Each kbd: `9px` font, `2px 5px` padding, `1px solid var(--border)` border, `3px` radius, `ui-monospace` font, `var(--foreground-muted)` color
   - Contents: `⌘` and `K` (on Windows/Linux, show `Ctrl` and `K` — detect via `navigator.platform`)

### Accessibility
- `<button>` element with `aria-label="Open search (Command+K)"`
- `aria-haspopup="dialog"` and `aria-expanded={isOpen}`
- Keep in the tab order

---

## Component 2 — Command Palette Modal

### Trigger
- Clicking the topbar search button
- Global keyboard shortcut: **⌘K** (Mac) or **Ctrl+K** (Windows/Linux) — listen on `window`, only when no input is focused, `preventDefault()` the browser's default
- **Esc** closes it
- Clicking the backdrop closes it

### Layout
- Full-viewport fixed overlay
- **Backdrop**: `rgba(0, 0, 0, 0.6)` with `backdrop-filter: blur(4px)`
- **Modal panel**: centered horizontally, `padding-top: 100px` from the top
- **Panel width**: 620px, `max-width: calc(100vw - 32px)`
- **Panel background**: `var(--surface)` (`#111113`)
- **Panel border**: `1px solid var(--border)`
- **Panel radius**: 14px
- **Panel shadow**: `0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(237,1,148,0.08)` — the inner pink ring is subtle brand reinforcement
- Mount via portal (`createPortal`) to `document.body`

### Panel structure (top to bottom)

#### 1. Search input row
- Padding: `16px 18px`
- Border-bottom: `1px solid var(--border)`
- Layout: `flex`, `gap: 12px`, `items-center`
- **Search icon** (lucide `Search`, 16px, `var(--foreground-muted)`)
- **Input**: transparent bg, no border, no outline, flex-1, `text-sm`, `color: var(--foreground)`, placeholder `"Search or jump to…"`, placeholder color `var(--foreground-subtle)`
- **ESC kbd** on the right: `10px` font, `3px 6px` padding, `1px solid var(--border)`, `4px` radius, `var(--surface-2)` bg, `var(--foreground-muted)` color
- Input should be `autoFocus` when modal opens

#### 2. Results area
- `max-height: 420px`, `overflow-y: auto`
- Padding: `8px 0`
- Grouped by category — each group has:
  - **Group header**: `padding: 6px 18px`, `10px` font, `uppercase`, `letter-spacing: 1.5px`, `color: var(--foreground-subtle)`, `font-weight: 600`
  - **Group items**: each is a row, `padding: 10px 18px`, `gap: 12px`, `flex items-center`, `font-size: 13px`
    - Icon (15px, lucide): `var(--foreground-muted)` default, `var(--accent)` when selected
    - Label: `flex: 1`, matched portion of query highlighted in `var(--accent)` bold (case-insensitive)
    - Trailing meta: `font-size: 11px`, `color: var(--foreground-subtle)`, `ui-monospace` font — shows either the route (`/assets`) or a keyboard hint (`⇧ U`)
  - **Selected/hover row**: background `var(--accent-subtle)` (`rgba(237,1,148,0.1)`)

#### 3. Footer bar
- Padding: `10px 18px`
- Border-top: `1px solid var(--border)`
- Background: `var(--surface-2)`
- Font: `10px`, `color: var(--foreground-subtle)`
- Flex row with gap 16px
- Contents:
  - `[↵] open`
  - `[↑↓] navigate`
  - Pushed right: `[⌘][K] anywhere`
- Each bracketed key is a `<kbd>` with: `9px` font, `2px 5px` padding, `1px solid var(--border)` border, `3px` radius, `ui-monospace` font

### Result categories (seed data)
Three groups, in this order:

**Go to** (navigation — all sidebar routes)
- One entry per nav item from `sidebar.tsx` — pull from the same nav arrays so this stays in sync
- Icon: the nav item's icon
- Meta: the route path (e.g. `/assets`)

**Actions**
- `Upload new brand asset` — Upload icon — kbd hint `⇧ U`
- `Submit new ticket` — Plus icon — kbd hint `N T`
- `Invite teammate` — UserPlus icon
- `Request new content` — MessageSquare icon

**Recent** (last 5 touched items — pull from a `recent_items` table or localStorage; empty if none)
- Icon by type (Image, FileText, Scroll, Chart)
- Meta: the section name (e.g. "Brand Assets")

### Filtering
- Case-insensitive substring match on `label` OR `group` name
- Hide groups that have zero matches
- If query is empty, show everything
- No fuzzy matching needed for v1

### Keyboard nav inside the palette
- **↑ / ↓** move selection between visible rows (skip group headers)
- **Enter** activates the selected row
- Selection auto-scrolls into view on move
- Default selection: first visible row
- Re-set selection to first row whenever `query` changes

### Row activation
- `Go to` rows: `router.push(route)` then close modal
- `Action` rows: call the action handler then close
- `Recent` rows: `router.push(route)` then close

### Focus management
- On open: focus the input
- On close: return focus to the trigger button
- Trap focus inside the modal while open

---

## Interactions & Behavior
- **Open**: modal fades + slides up 4px (`animate-fade-in` keyframe already exists in `globals.css`)
- **Close on Esc, backdrop click, or row activation**
- **Scroll lock** the body while open
- **Re-opening** restores the previous query? **No** — clear it on each open for predictability.
- **Global shortcut** should NOT fire if the active element is an `<input>`, `<textarea>`, or `[contenteditable]` — UNLESS the input is our own palette input.

## State Management
Suggested: a lightweight Zustand store OR a React Context + hook `useCommandPalette()`:
```ts
{
  open: boolean;
  query: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (q: string) => void;
}
```
Mount the palette once in the portal layout (`src/app/(portal)/layout.tsx`) so it's available on every page. The topbar trigger just calls `open()`.

## Design Tokens (from `globals.css` — all already defined)
| Role | Variable | Hex |
|---|---|---|
| App background | `--background` | `#09090b` |
| Panel surface | `--surface` | `#111113` |
| Hover surface | `--surface-2` | `#1a1a1e` |
| Border | `--border` | `#27272a` |
| Subtle border | `--border-subtle` | `#1f1f23` |
| Foreground | `--foreground` | `#fafafa` |
| Muted text | `--foreground-muted` | `#a1a1aa` |
| Subtle text | `--foreground-subtle` | `#52525b` |
| Accent (brand pink) | `--accent` | `#ed0194` |
| Accent subtle | `--accent-subtle` | `rgba(237,1,148,0.1)` |

### Type
- Font family: `var(--font-geist-sans)` (already wired up in `layout.tsx`)
- Monospace: `var(--font-geist-mono)` for kbds and route paths

### Spacing / radii
- Trigger button radius: `8px` (match existing nav items)
- Modal radius: `14px`
- Kbd radius: `3–4px`

## Assets
- Icons from `lucide-react` — already a dependency. Icons used: `Search`, `Upload`, `Plus`, `Image`, `FileText`, `ScrollText`, `BarChart3`, `LayoutDashboard`, `FolderOpen`, `CalendarDays`, plus any additional sidebar icons.
- No new images or SVGs required.

## Files to change
- `src/components/layout/topbar.tsx` — add the trigger button
- `src/components/ui/command-palette.tsx` **(new)** — the modal component
- `src/lib/use-command-palette.ts` **(new)** — the store/hook
- `src/app/(portal)/layout.tsx` — mount `<CommandPalette />` once

## Reference files in this handoff
- `design-reference/Portal UX Enhancements.html` — open this and look at the **"Global search in topbar"** artboard and the **"⌘K Command Palette"** artboard (first one in the canvas). Both are needed.
- `design-reference/components.jsx` — JSX mock of the palette and trigger with exact inline styles. Useful as a pixel-level reference.

## Acceptance criteria
- [ ] Search trigger visible in the topbar on every portal page
- [ ] Clicking it opens the command palette
- [ ] ⌘K / Ctrl+K opens it from anywhere (except when typing in another input)
- [ ] Esc and backdrop click close it
- [ ] Typing filters results live, with accent-colored match highlighting
- [ ] ↑ / ↓ / Enter navigation works
- [ ] Selecting a `Go to` item routes and closes the modal
- [ ] Matches the existing dark + pink aesthetic — no new colors introduced

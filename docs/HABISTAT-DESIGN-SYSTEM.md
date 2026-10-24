# Habistat — Design System

Tokens: `packages/tokens/src/index.ts` (mobile) is mirrored by `packages/web-ui/src/theme.css` (web, Tailwind v4 `@theme`). Change both together.

## Identity

- **Primary:** deep navy `#1A2D5E` (navy-700). Darker navy-900 `#0B1633` for the owner/admin sidebar.
- **Background:** warm off-white `#F6F5F1`. **Cards:** white with a 1 px `#E4E3DD` border and a very soft shadow.
- **Text:** ink-900 `#0D1730`, with muted ink-500 `#5A6479`.
- **Status:** success `#1C7A50`, warning `#A8650F`, danger `#B4321F`, info `#26579E`, each with a pale background tint. These are used only to show state.
- **Brand accent:** marigold `#D99A2B`, used sparingly (wordmark dot, highlights). It is never used for status.
- Not used: gradients, glassmorphism, neon, playful palettes.

## Type

- Display and headings: **Plus Jakarta Sans** (600–700). Body text: **Inter**.
- Numbers use tabular figures in dashboards.
- Scale: 32 / 24 / 19 / 16 / 15 / 13 / 11.

## Core components

| Component | Where |
|---|---|
| `RoomCard` | Owner rooms, vacancies, Discover, public property page, admin listings |
| `StatTile` | Owner/admin dashboards |
| `AttentionItem` | Owner "Needs attention", with exactly one action per item |
| `StatusPill` | Bed, listing, invoice, lead and maintenance statuses |
| `AmenityList` | Room and property amenities |
| `EmptyState` / `ErrorState` / `Skeleton` | Every list and screen |
| `Sidebar` + `PropertySwitcher` | Owner shell |

## Copy rules

Copy is short and human:

| Use | Not |
|---|---|
| "Rooms & Beds" | "Property inventory management" |
| "₹8,500 due" | "Outstanding financial obligation" |
| "List on Habistat" | "Create a new inventory listing" |
| "Share Room" | "Generate public room URL" |
| "Request sent ✓" | "Maintenance request has been successfully submitted" |

Errors read "We couldn't load this right now." with a **Try again** button. Raw error codes are never shown.

## States

Every screen has a skeleton for loading (not a lone spinner), a meaningful empty state ("No vacant rooms — your property is fully occupied."), an error state with retry, and an offline banner ("Connection lost. Your information is safe.").

## Motion

Motion is subtle: transitions of 150–200 ms on hover, press and sheet open, and `prefers-reduced-motion` is respected. There are no decorative animations.

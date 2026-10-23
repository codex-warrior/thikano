# THIKANO — Product

**THIKANO is the operating system for PGs and hostels.**

Students use THIKANO to discover real available rooms, compare PGs, enquire, and move in. Residents use it to manage everyday life inside their PG. Owners use it to manage their property, showcase rooms, fill vacancies, manage residents, and earn from services. THIKANO connects the entire lifecycle.

Scope: PGs, hostels and student accommodation only. Hotels, Airbnb-style stays, generic rentals, serviced apartments, real estate and commercial property are **out of scope**.

## Surfaces

| Surface | App | Users |
|---|---|---|
| THIKANO Discover | `apps/mobile` (Discover mode) + `apps/web` public pages | Students |
| THIKANO Resident | `apps/mobile` (Resident mode) | Residents |
| THIKANO Owner | `apps/owner` | Owners, managers, staff |
| THIKANO Admin | `apps/admin` | THIKANO team |
| THIKANO Core | `packages/domain`, Firebase, `functions` | Shared |

## The loop

Student → discover → see the actual room → live availability → enquire → visit/apply → approval → booking → move-in → resident → daily use (rent, food, laundry, maintenance, community, parcels, services) → move-out → next PG through THIKANO.

## Core differentiator

> "Room 204 is vacant. Here is what it looks like, the rent, the amenities, the location, and a link you can send directly to a student."

## Promises

- **Student:** "I can actually see what room I'm getting."
- **Resident:** "Everything I need while living here is in THIKANO."
- **Owner:** "I can run my PG and fill my vacant beds from one place."
- **Admin:** "I can control and understand the entire THIKANO marketplace."

## Non-negotiables

1. Owners never enter the same information twice. Publishing simply exposes existing inventory.
2. Availability is derived from bed assignments, never typed in.
3. A property is publicly searchable only after admin verification.
4. Public pages show only intentionally published information.
5. No fake production functionality. Missing credentials mean an interface, a mock, and documentation.
6. Engagement comes from genuine utility, with no manipulative gamification.

See `THIKANO-ROADMAP.md` for phases and status.

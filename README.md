# BookMeet

An internal scheduling tool for booking AirOps onboarding meetings. Admins create shareable links; customers book via a public page. Supports two meeting formats with Google Calendar integration.

## Meeting types

**Weekly Sync** — 30 min, recurring weekly for 5 weeks. Customer picks a day and time; a single recurring calendar event is created with EXDATE exceptions for any OOO weeks.

**Cohort** — 60 min, 5 sessions over ~3 weeks (2/2/1 structure). Customer picks a M/W or T/Th track, a starting week, and a time. Events are created individually. If the AirOps team is OOO on a session date, that session is automatically rescheduled to the next available slot on the same track — always 5 sessions, no skips.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS v4 |
| Backend | [Convex](https://convex.dev) (queries, mutations, actions, HTTP routes) |
| Calendar | Google Calendar API via `googleapis` in Convex Node actions |
| Email | Gmail API — branded HTML notification on each booking |
| Auth | Google OAuth (admin only) |

## Local development

Both servers must run simultaneously:

```bash
npm run dev          # Vite dev server → localhost:5173
npx convex dev       # Convex backend (watches + auto-deploys)
```

## Environment variables

**Convex** (set via `npx convex env set <KEY> <VALUE>`):

```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
FRONTEND_URL
```

**Frontend** (auto-generated in `.env.local` by `npx convex dev`):

```
VITE_CONVEX_URL
VITE_CONVEX_SITE_URL
```

## Project structure

```
convex/
  schema.ts            # Tables: schedulingLinks, bookings, adminTokens, availabilityCache
  http.ts              # Google OAuth redirect + callback
  googleCalendar.ts    # Availability checks, event creation, email notifications
  cohortDates.ts       # computeCohortDates, computeRescheduledCohortDates
  availability.ts      # Public getSlots + getCohortSlots actions (5-min cache)
  schedulingLinks.ts   # CRUD + archive/reactivate/remove
  bookings.ts          # Booking action + queries
src/
  components/
    ui/                # Button, Card, Badge, Input, Select
    layout/            # AdminLayout, Sidebar
    calendar/          # CalendarGrid, TimeSlotList, TimezoneSelector, CohortCalendarPreview
    booking/           # BookingForm
  pages/
    admin/             # Login, Dashboard, CreateLink
    booking/           # BookingPage, Confirmation
  lib/utils.ts         # Shared date/timezone helpers, cohort date utilities
```

## Key behaviors

- **OOO handling (Weekly Sync):** OOO weeks are excluded via RRULE EXDATE; the recurring event count is extended to compensate so 5 meetings always occur.
- **OOO handling (Cohort):** Sessions landing on OOO dates are pushed forward to the next available M/W or T/Th slot. The wrap-up week extends if needed.
- **Availability check:** Admin calendar uses `events.list` (distinguishes OOO from real conflicts). Co-host uses `freebusy` (works cross-Workspace without calendar sharing).
- **Conference links:** Zoom add-on preferred; falls back to Google Meet.
- **Re-booking:** Links support multiple bookings. Customers see a confirmation prompt if the link was already used.
- **Link lifecycle:** `active → booked → archived` with archive/reactivate/delete controls.

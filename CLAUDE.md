# STS-BSC Manager — Claude Code Instructions

## What This App Is
Web app for managing Secondary Traumatic Stress Breakthrough Series Collaboratives. Built for CTAC (Center on Trauma and Children) at the University of Kentucky. Collects assessments from frontline workers, provides dashboards/reports for team leaders, and admin tools for CTAC staff.

## Tech Stack
- **Frontend:** React 19 + Vite, inline styles (no CSS framework), Recharts for charts
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Hosting:** Vercel (auto-deploys from `main` branch), root dir = `frontend`
- **Routing:** React Router v7
- **Export:** jspdf + xlsx for PDF/Excel reports

## Brand Colors
- Navy: `#0E1F56` (headers, primary)
- Teal: `#00A79D` (accents, buttons)
- Use `COLORS` object from `frontend/src/utils/constants.js`

## Key Conventions
- Inline styles everywhere — no CSS modules, no Tailwind
- Shared styles: `cardStyle`, `cardHeaderStyle` from `constants.js`
- Modals follow the pattern in `AddTeamModal.jsx` (overlay + stopPropagation)
- Data fetching: `useState` + `useEffect` + `supabase.from().select()` — no realtime subscriptions
- Role checks via `useAuth()` which exposes `isSuperAdmin`, `isAgencyAdmin`, `user`, `profile`

## Roles
- `super_admin` — CTAC staff, full access, sees AdminDashboard
- `agency_admin` — Team leaders, sees TeamDashboard, scoped to their team
- `team_leader` — Same access as agency_admin (legacy name)
- Future: `team_member` — read-only dashboard + resources + forum

## Database Gotchas
- **Assessment query pattern:** Always join through `assessment_responses`. Never query `demographics`/`stss_responses`/etc. by `team_code_id` directly — they link via `assessment_response_id`.
- **RLS helper functions:** `is_super_admin()` and `user_collaborative_id()` are `SECURITY DEFINER` functions that bypass RLS to avoid recursion.
- **Gender values:** 'M', 'F', 'NB', 'not_listed' — NOT 'male'/'female'
- **STSI-OA columns:** Use `item_1` through `item_37` format (not `item_1a`)
- **Resources domains:** Stored as `TEXT[]` array, e.g. `{'resilience','safety'}`
- **Forum threads:** Scoped per collaborative via `collaborative_id` FK

## Supabase Project
- Project ref: `jhnquklmwoubpbbmnrjf`
- Edge Functions deployed with `--no-verify-jwt` (gateway JWT check disabled)
- Storage bucket: `resources` (private, signed URLs for downloads)

## Deployment
- Vercel project: `sts-bsc-manager` at `https://sts-bsc-manager.vercel.app/`
- Auto-deploys on push to `main`
- Vercel root directory: `frontend`, framework: Vite
- `frontend/vercel.json` has SPA rewrite rule for React Router

## File Organization
```
frontend/src/
  pages/          — Full-page views (one per route)
  components/     — Reusable UI (modals, forms, route guard)
  config/         — Assessment instrument definitions (questions, scales)
  contexts/       — AuthContext (single context for auth state)
  utils/          — Supabase client, constants, data loaders, export helpers
  assets/         — Logo PNGs
```

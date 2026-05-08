# STS-BSC Manager — Claude Code Instructions

## What This App Is
Web app for managing Secondary Traumatic Stress Breakthrough Series Collaboratives. Built for CTAC (Center on Trauma and Children) at the University of Kentucky. Collects assessments from frontline workers, provides dashboards/reports for team leaders, and admin tools for CTAC staff.

> **See [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md)** for the live production stack — domains, DNS, email pipeline, hosting, and operational gotchas. Update that doc when infrastructure changes.

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
- Role checks via `useAuth()` which exposes `isSuperAdmin`, `isAgencyAdmin`, `isTeamMember`, `user`, `profile`
- All pages use `maxWidth: 1200px` with `margin: '0 auto'` for consistent centering
- `index.css` has been cleaned up from Vite defaults — no flex/place-items on body

## Roles
- `super_admin` — CTAC staff, full access, sees AdminDashboard
- `agency_admin` — Team leaders, sees TeamDashboard, scoped to their team, can invite team members
- `team_leader` — Same access as agency_admin (legacy name)
- `team_member` — Read-only dashboard access + resources + forum participation. Cannot edit SMARTIE goals, checklists, or team settings.

## User Invitation Flow
- **Edge Function:** `invite-team-leader` (generalized — handles all role invites)
  - Accepts `role` param (`agency_admin`, `team_leader`, `team_member`)
  - Accepts `agency_role`, `is_senior_leader`, `resend` params
  - Agency admins can invite to their own team; super admins can invite to any team
  - On `resend: true`, deletes existing user and re-invites with fresh token
- **Email flow:** Supabase `inviteUserByEmail()` → user clicks link → `AuthRedirectHandler` catches `type=invite` hash → redirects to `/set-password` → user sets password → redirects to `/admin`
- **Redirect URL:** Hardcoded to `https://bsc.ctac.app/set-password`
- **Rate limits:** Custom SMTP via Resend is configured (see `INFRASTRUCTURE.md`). Auth email rate limit raised from 2/h to 30/h. If hitting that ceiling, raise it in Supabase Auth → Rate Limits.

## Database Gotchas
- **Assessment query pattern:** Always join through `assessment_responses`. Never query `demographics`/`stss_responses`/etc. by `team_code_id` directly — they link via `assessment_response_id`.
- **RLS helper functions:** `is_super_admin()`, `user_collaborative_id()`, and `user_team_id()` are `SECURITY DEFINER` functions that bypass RLS to avoid recursion.
- **Teams RLS:** Uses `is_super_admin() OR id = user_team_id()` — works for all roles with a team.
- **user_profiles RLS:** Users can read own profile + profiles from own team (via `user_team_id()`). Super admins can read all.
- **Role constraint:** `user_profiles_role_check` CHECK allows: `super_admin`, `agency_admin`, `team_leader`, `senior_leader`, `team_member`
- **Gender values:** 'M', 'F', 'NB', 'not_listed' — NOT 'male'/'female'
- **STSI-OA columns:** Use `item_1` through `item_37` format (not `item_1a`)
- **Resources domains:** Stored as `TEXT[]` array, e.g. `{'resilience','safety'}`
- **Forum threads:** Scoped per collaborative via `collaborative_id` FK
- **user_profiles columns:** `id`, `email`, `full_name`, `role`, `team_id`, `is_active`, `agency_role`, `is_senior_leader`, `invite_accepted_at`, `created_at`, `updated_at`
- **collaborative_trainers** join table for who's a trainer/coordinator on a collaborative. Columns: `id`, `collaborative_id`, `user_id`, `is_coordinator`. Unique partial index `WHERE is_coordinator = true` enforces one coordinator per collab. Source of truth for the Trainer Dashboard.
- **`pg_cron` is enabled.** A job named `close-expired-sessions` runs every minute and calls `public.close_expired_sessions()`, which deactivates `session_links` for any event whose `end_time + 30 min` (computed in the event's stored timezone, default `America/New_York`) has passed and bulk-stamps `session_attendance.signed_out_at` for stragglers. The "Close now" button on `CollaborativeDetail.jsx` runs the same logic on demand. Sessions without `end_time` never auto-close; UI surfaces this.

## Supabase Project
- Project ref: `jhnquklmwoubpbbmnrjf`
- Edge Functions deployed with `--no-verify-jwt` (gateway JWT check disabled)
- Storage bucket: `resources` (private, signed URLs for downloads)
- Supabase: Free plan with custom SMTP via Resend (email rate limits effectively bypassed). Vercel: Pro plan.

## Deployment
- Vercel project: `sts-bsc-manager` at `https://bsc.ctac.app/`
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

## Routes
```
Public:
  /                         — TeamCodeEntry (assessment anonymous entry)
  /demographics, /stss, /proqol, /stsioa, /complete — Assessment flow
  /login, /set-password     — Auth flows

Protected (all via ProtectedRoute):
  /admin                    — DashboardRouter (super_admin → AdminDashboard, others → TeamDashboard)
  /admin/collaboratives     — CollaborativesList
  /admin/collaboratives/:id — CollaborativeDetail
  /admin/completion         — CompletionTracking
  /admin/data-visualization — DataVisualization
  /admin/team-report/:teamId — TeamReport
  /admin/smartie-goals/:teamId — SmartieGoals
  /admin/resources          — Resources
  /admin/forum              — ForumThreadList
  /admin/forum/:threadId    — ForumThread
  /admin/change-framework   — ChangeFramework
  /admin/staff              — StaffDirectory
  /admin/team/:teamId/members — TeamMembers
```

## Test Accounts
- `jafish0@uky.edu` — super_admin (Josh's account)
- `test@uky.edu` / `1234` — agency_admin for "Bluegrass Family Services" team

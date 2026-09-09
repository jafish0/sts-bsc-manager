# STS-BSC Manager — Claude Code Instructions

## What This App Is
Web app for managing Secondary Traumatic Stress Breakthrough Series Collaboratives. Built for CTAC (Center on Trauma and Children) at the University of Kentucky. Collects assessments from frontline workers, provides dashboards/reports for team leaders, and admin tools for CTAC staff.

> **See [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md)** for the live production stack — domains, DNS, email pipeline, hosting, and operational gotchas. Update that doc when infrastructure changes.
>
> **See [`WORKING_NOTES.md`](WORKING_NOTES.md)** for a running log of recently shipped features (so you don't have to re-read git log) and a drafts section where Josh + Claude Code can hand off prompts to Claude.ai for implementation. Append-only — read it on session start, append to it as features ship or ideas crystallize.

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
- `super_admin` — CTAC director-level (Josh, Ginny). God mode: sees every collaborative, every team, every assessment. Lands on AdminDashboard.
- `trainer_admin` — CTAC trainer/faculty. **Definition locked by Josh, 2026-09-09:** *"She gets her assigned collaboratives and everything inside them, her standalone trainings, registrations for her events, the Forum for her collaboratives, and resource management for her programs only. She does not get cross-collaborative analysis, staff management, or anything spanning cohorts she isn't on."* Scoped to the collaboratives they're listed on in `collaborative_trainers` (and standalone trainings in `event_trainers`). **Lands on `/admin/trainer` (TrainerDashboard)**, with AdminDashboard one click away; there the resource-library tiles show only their programs (`myAdminProgramTypes`), Completion Tracking and Data Visualization are scoped to their collaboratives, and cross-collab tools (Strategy Ideas, Change Framework, Staff Directory, STS-PAT Overview, Self-Rating Engagement, Unmatched Attendees) are hidden. Cannot create new collaboratives or modify trainer assignments — only super_admins can.
  - ⚠️ **Scoping trap:** never scope on `myAdminCollaborativeIds` / `myAdminProgramTypes` alone. For a super_admin those are their *own* trainer assignments (1 for Josh, **0 for Ginny**), not "everything". Always `isSuperAdmin ? <unscoped> : <scoped>`, or use `canAdminCollaborative(id)`.
- `agency_admin` — Team leaders, sees TeamDashboard, scoped to their team, can invite team members
- `team_leader` — Same access as agency_admin (legacy name; zero users, but seven live code paths treat it as a synonym — keep it)
- `team_member` — Read-only dashboard access + resources + forum participation. Cannot edit SMARTIE goals, checklists, or team settings.
- ~~`senior_leader`~~ — **removed from the role CHECK 2026-09-09.** The concept is the `is_senior_leader` boolean (live: badges, invite param, `senior_leader_call` events). The three dead `can_*` permission columns were dropped the same day.

### Role helpers
- DB: `is_super_admin()` and `is_admin_for_collaborative(uuid)` — both `SECURITY DEFINER`. Use the latter in RLS policies that gate per-collab data; it returns true for super_admins (regardless of arg) and for trainer_admins on the given collab. There is also `user_admin_collaborative_ids()` which returns `setof uuid` of the caller's assigned collabs.
- Frontend: `useAuth()` exposes `isSuperAdmin`, `isTrainerAdmin`, `isAdminLevel` (either), `myAdminCollaborativeIds`, and `canAdminCollaborative(collabId)`. Use `canAdminCollaborative` anywhere a page is scoped to a single collab.

## User Invitation Flow
- **Edge Function:** `invite-team-leader` (generalized — handles all role invites)
  - Accepts `role` param — team roles (`agency_admin`, `team_leader`, `team_member`, require `team_id`) AND CTAC staff roles (`super_admin`, `trainer_admin`, no team, **super_admin callers only**; `collaborative_ids[]` assigns a trainer via `collaborative_trainers`, rolled back atomically on failure)
  - Accepts `agency_role`, `is_senior_leader`, `resend` params
  - Agency admins can invite to their own team; super admins can invite to any team
  - On `resend: true`: **refuses** if the account already accepted/signed in (`409 already_accepted` → offer a password reset) or holds any `collaborative_trainers`/`event_trainers` rows (`409 has_assignments` — both cascade on user delete); only a never-accepted, unassigned account is deleted and re-invited
  - Frontend: team invites from team pages; staff invites via the Admin Dashboard "Add CTAC Staff" card (`InviteStaffModal`). **Never email a password** — the invite link → `/set-password` flow is the deliberate design.
- **Email flow:** Supabase `inviteUserByEmail()` → user clicks link → `AuthRedirectHandler` catches `type=invite` hash → redirects to `/set-password` → user sets password → redirects to `/admin`
- **Redirect URL:** Hardcoded to `https://bsc.ctac.app/set-password`
- **Rate limits:** Custom SMTP via Resend is configured (see `INFRASTRUCTURE.md`). Auth email rate limit raised from 2/h to 30/h. If hitting that ceiling, raise it in Supabase Auth → Rate Limits.

## Database Gotchas
- **Assessment query pattern:** Always join through `assessment_responses`. Never query `demographics`/`stss_responses`/etc. by `team_code_id` directly — they link via `assessment_response_id`.
- **RLS helper functions:** `is_super_admin()`, `user_collaborative_id()`, and `user_team_id()` are `SECURITY DEFINER` functions that bypass RLS to avoid recursion.
- **Teams RLS:** Uses `is_super_admin() OR id = user_team_id()` — works for all roles with a team.
- **user_profiles RLS:** Users can read own profile + profiles from own team (via `user_team_id()`). Super admins can read all.
- **Role constraint:** `user_profiles_role_check` CHECK allows: `super_admin`, `trainer_admin`, `agency_admin`, `team_leader`, `team_member` (`senior_leader` removed 2026-09-09)
- **Gender values:** 'M', 'F', 'NB', 'not_listed' — NOT 'male'/'female'
- **STSI-OA columns:** Use `item_1` through `item_37` format (not `item_1a`)
- **Resources domains:** Stored as `TEXT[]` array, e.g. `{'resilience','safety'}`
- **Forum threads:** Scoped per collaborative via `collaborative_id` FK
- **user_profiles columns:** `id`, `email`, `full_name`, `role`, `team_id`, `is_active`, `agency_role`, `is_senior_leader`, `invite_accepted_at`, `phone`, `organization`, `bio`, `photo_path`, `unsubscribe_token`, `notifications_unsubscribed_at`, `last_login`, `created_at`, `updated_at`
- **⚠️ `user_profiles` write surface (locked down 2026-09-09 after a proven self-escalation to super_admin):** `anon` has no UPDATE; `authenticated` holds column-level UPDATE on exactly `full_name, phone, organization, bio, photo_path, invite_accepted_at` under the self-only policy (`USING/WITH CHECK auth.uid() = id`). A `BEFORE UPDATE` trigger (`user_profiles_guard_privileged_columns`) additionally refuses changes to `role`, `team_id`, `is_active`, `agency_role`, `is_senior_leader`, `email`, `id` from anyone but a super_admin / the service role / SECURITY DEFINER RPCs — so a re-added blanket `GRANT UPDATE` at the 2026-10-30 grants cutover would not reopen the hole. **Every admin-acting-on-someone-else write is an RPC:** `set_user_active(p_target, p_active)` (super_admin, trainer on the team's collab, or same-team leader; refuses self), `set_person_bio(...)` (below), `unsubscribe_set`. Do not add a super_admin UPDATE policy.
- **⚠️ A Supabase `.update()` / `.delete()` without `.select()` cannot tell you RLS blocked it.** A statement that matches zero rows because of RLS returns `error: null`, indistinguishable from success. Every admin-acting-on-someone-else write must either chain `.select()` and assert a row came back, or go through a SECURITY DEFINER RPC that raises. Found three times: `/unsubscribe` (anon could not read `user_profiles` so the page always said "invalid"), `TeamMembers.handleDeactivate` (no UPDATE policy admitted an admin — "Remove from team" reported success for months and did nothing), and the `user_profiles` escalation audit.
- **Bios + photos (2026-09-09, option B):** two parallel bio systems, deliberately kept and LINKED. `bsc_staff.user_id` (nullable FK → `user_profiles`, unique) links a directory row to an account; `photo_path` exists on both tables. **The one resolution rule lives in SQL — `staff_directory_resolved()`** (SECURITY DEFINER; linked row → account's `bio`/`photo_path`, unlinked → its own; visibility mirrors `bsc_staff` RLS). `StaffDirectory` reads it; never render `bsc_staff.bio` directly. Writes go through `set_person_bio(p_target_user | p_staff_id, p_bio, p_photo_path, p_update_bio, p_update_photo)` — self or super_admin; a linked `p_staff_id` writes the ACCOUNT; returns `old_photo_path` for cleanup. Editor: `PersonBioEditor` (Trainer Dashboard card, super_admin inline in the Trainer tab, `AddStaffModal`). Photos: **public** bucket `trainer-photos` (2 MB, jpeg/png/webp, random filenames, client downscales to ~512px via `utils/trainerPhoto.js`; replace = upload → RPC swap → delete old; DELETE policy admits super_admin, the uploader, or any staff for an **unreferenced** object via `trainer_photo_is_unreferenced()`). `PersonAvatar` renders initials when there is no photo — never a broken image. Jessica Eslinger and Stephanie Gusler have directory rows and no accounts by design; Ginny/Josh/Alex were linked BY ID (their emails differ between the two tables).
- **`collaboratives.hub_display_name`** (nullable): the TIPE hub's title, `coalesce(hub_display_name, name)` inside `hub_lookup` (also returns `collaborative_name`). Nothing else reads it — registration, rosters, reports and emails keep using `name`. Edited from the Participant Hub panel ("Rename hub", super_admin).
- **`/admin/forum?collaborative=<uuid>`** selects that collaborative's forum (falls back to the alphabetical default when absent/unreadable). Every collaborative page has a Forum card that deep-links this way; `ForumThread`'s back button returns to the same collaborative. Without the param the page silently showed the wrong LC's threads.
- **collaborative_trainers** join table for who's a trainer/coordinator on a collaborative. Columns: `id`, `collaborative_id`, `user_id`, `is_coordinator`. Unique partial index `WHERE is_coordinator = true` enforces one coordinator per collab. Source of truth for the Trainer Dashboard.
- **`pg_cron` is enabled.** Four scheduled jobs:
  - `close-expired-sessions` — every minute; deactivates session_links 30 min after event end_time and bulk-stamps `session_attendance.signed_out_at` for stragglers. Sessions without `end_time` never auto-close.
  - `day-before-reminders` — daily at 13:30 UTC (~9:30 AM ET in summer); calls `fire_day_before_reminders()` which finds events 1 day out and posts to the `send-event-reminder` edge function via `pg_net`.
  - `week-before-reminders` — daily at 15:00 UTC (~11:00 AM ET in summer); same pattern, 7 days out.
  - `imminent-reminders` — every 5 minutes; calls `fire_imminent_reminders()` which dispatches `hour_before` (events starting within 60 min) and `starting_now` (start within -10/+5 min of now) reminders. Idempotent via `event_reminder_log` on both the SQL and edge-function side.
  All reminder crons require `vault.secrets` row named `service_role_key` (one-time manual setup; documented in INFRASTRUCTURE.md — done 2026-05-08). Without it, they no-op silently.
- **`event_rsvps`, `event_reminder_log`, `event_parking_lot_items`, `smartie_goal_comments`** — auxiliary tables for the May 8 feature batch (RSVP buttons in reminder emails, idempotent reminder dispatch, per-event off-topic tracker, trainer feedback on goals). All RLS-scoped via `is_admin_for_collaborative` except `event_rsvps`, which has public SELECT/UPDATE policies so anonymous email recipients can flip their status by `rsvp_token`.
- **`user_profiles.unsubscribe_token` / `notifications_unsubscribed_at`** — every user gets a stable hex token (16 bytes); the `/unsubscribe/:token` public page sets `notifications_unsubscribed_at` and the reminder/email edge functions skip those users.
- **Collaborative hub (TIPE teamless model, 2026-08-26):** **TIPE-only by decision** — the hub panel renders only for `program_type='tipe_lc'` and `hub_collab_for_token` refuses non-TIPE tokens server-side. `collaboratives.hub_token` (UNIQUE, generated on demand, RETAINED when the hub is toggled off so printed QRs survive) + `hub_enabled` (DEFAULT false — opt-in). TIPE also replaces Teams/Team Rosters on CollaborativeDetail with the registrations-sourced `LearningCollaborativeRoster` (UI-only hiding; team rows kept). All hub reads/writes go through token-scoped SECURITY DEFINER RPCs (`hub_lookup`, `hub_resources`, `hub_forum_threads/thread`, `hub_post_thread/reply/parking_lot`); do NOT broaden anon grants for hub features. The future-materials gate lives in `hub_lookup`'s SQL. `forum_threads`/`forum_posts`/`event_parking_lot_items` carry nullable `author_name/author_district/author_role` for accountless posts (`created_by` NULL; email never stored there).
- **`event_trainers`** (standalone trainings' assigned trainers, mirrors `collaborative_trainers`): `created_by` stays the owner/audit field; `can_admin_bsc_event`'s standalone branch admits super_admin OR creator OR assigned trainer. Triggers keep every standalone training with ≥1 trainer and exactly one lead (creator auto-seeded on insert; last-trainer delete refused; lead auto-promoted). Switch leads via `set_event_lead_trainer()`, not two UPDATEs. Names/bios/photos for pickers/columns come from `staff_for_trainer_assignment()` (user_profiles RLS hides other staff from trainer_admins); the public hub reads `training_hub_trainers(hub_token)` (name, bio, is_lead, photo_path) — **never expose an email on the hub**. `user_profiles` UPDATE RLS is still self-only (no super_admin policy) — but as of 2026-09-09 super_admins DO edit other people's bios/photos, through the `set_person_bio` RPC (Josh's decision, reversing the earlier "owner only" stance). Trainers edit their own on the Trainer Dashboard; the Trainer tab in `StandaloneTrainingModal` is read-only for them.
- **`bsc_event_documents.document_type`** CHECK allows: `general`, `agenda`, `slides`, `handout`. `agenda` also drives the AgendaBanner. Exactly three named categories by decision — do not add more.
- **Resources RLS:** super_admins manage everything; **trainer_admins manage resources whose `program_type` matches a collaborative they're assigned to** (plus matching storage INSERT/DELETE on the `resources` and `event-documents` buckets). `AddResourceModal` must always set `program_type` — the DB default is `sts_bsc` and unscoped inserts land in the wrong library.
- **⚠️ Storage/RLS policy trap (bitten twice now):** a policy expression's subquery runs under the CALLER's own privileges/RLS — an anon-facing policy that SELECTs from a table anon can't read always evaluates false. Route the lookup through a SECURITY DEFINER helper (`resource_file_is_hub_visible`, `team_code_is_valid` are the precedents).
- **⚠️ No public token link may write on page load.** Any `/:token` page reachable from an email (`/unsubscribe`, `/rsvp`, `/cancel-registration`, `/set-password`, session sign-in) must treat a page load as a **read**. Mail security scanners fetch and fully render these URLs before the human ever sees them, and they execute JavaScript — verified against Microsoft's scanner on 2026-09-08 (it consumed single-use invite tokens 19s after send and called `/auth/v1/user`). Writes belong behind a click, or behind typed input for anything credential-shaped (`/set-password` verifies its `token_hash` only on password submit). `CancelRegistrationPage.jsx` is the reference implementation. The one deliberate exception: `/rsvp/:token?status=attending` still auto-applies (Josh's one-click constraint; a false "attending" is visible and self-correcting) — declines require the click, and `send-event-reminder` suppresses only declines with `confirmed_at` set (a human click; `responded_at` is trigger-stamped on any status change and cannot carry that meaning).
- **`session_attendance` anon writes:** none. Sign-out goes through `sign_out_by_email`, the eval stamp through `mark_evaluation_completed` (both SECURITY DEFINER, status-string-only). The always-true anon UPDATE policy and anon's column grants are gone — don't reintroduce a direct anon UPDATE.

## Future migrations: explicit Data API grants

> **Deadline: 2026-10-30.** Supabase is removing auto-grants to the Data API roles (`anon`, `authenticated`, `service_role`) for new `public`-schema tables. Existing tables keep their grants — verified via audit 2026-05-08, all 41 public tables fully granted on all three roles. The forward-looking change is the only thing that matters for this codebase.

Every `apply_migration` that creates a new `public`-schema table touched by `supabase-js` (PostgREST / GraphQL / Realtime) **must include explicit `GRANT` statements alongside the `CREATE TABLE` and RLS policies**, or after the cutover those tables will return `42501` to the frontend even with correct RLS.

RLS still does the actual access gating. Grants are the visibility layer the Data API needs to see the table at all.

**Standard pattern for full-CRUD tables** (most app-data tables fit here):

```sql
CREATE TABLE public.your_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);

GRANT SELECT                         ON public.your_table TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO service_role;

ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY ...
  ON public.your_table FOR ...
  USING (...);
```

**Tune verbs per table:**
- Write-only intake from anon (e.g. an assessment-response table the public assessment flow inserts into): `GRANT INSERT ON ... TO anon` only — no SELECT to anon means nobody can scrape submissions.
- Public read by token (e.g. RSVP / cancel-registration tokens): `GRANT SELECT, UPDATE ON ... TO PUBLIC` (or to `anon` specifically) — RLS filters by token.
- Admin-only / service-role-only (e.g. queue or audit tables that only edge functions touch): `GRANT ALL ON ... TO service_role` and nothing else.

If unsure, default to the "Standard pattern" above. RLS will refuse anything the policy doesn't allow — over-granting on the Data API layer without matching RLS is safe; under-granting silently breaks.

## Supabase Project
- Project ref: `jhnquklmwoubpbbmnrjf`
- Edge Functions **live in the repo** under `supabase/functions/<slug>/index.ts` — the repo is the source of truth; never edit one in the dashboard. Intended deploy flag is `--no-verify-jwt` (gateway JWT check disabled, each function authorizes its own callers). **When deploying via the Supabase MCP tool you must pass `verify_jwt: false`** — that parameter defaults to `true`, so omitting it flips the flag on. See INFRASTRUCTURE.md → Edge functions.
- Storage bucket: `resources` (private, signed URLs for downloads)
- Supabase: **Pro plan** ($25/mo — 8 GB DB, 100 GB file storage, daily backups, higher egress) with custom SMTP via Resend (email rate limits effectively bypassed). Vercel: **Pro plan**. Resend: **paid plan** (free-tier daily/monthly sending caps lifted — comfortable headroom for invites, reminders, registration + RSVP emails, trainer digests).

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
  /hub/:token               — CollaborativeHub (+ /forum, /forum/:threadId, /resources) — TIPE's
                              accountless participant hub; static URL all cycle, token-scoped RPCs,
                              posting via identity-lite (localStorage), reading needs nothing
  /login, /set-password     — Auth flows

Protected (all via ProtectedRoute):
  /admin                    — DashboardRouter (super_admin → AdminDashboard, trainer_admin → TrainerDashboard, others → TeamDashboard)
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
- `joshuafisherkeller@gmail.com` — **`agency_admin`** (team leader), team **Center on Trauma and Children**, collaborative **STS-BSC Demo** (`0817ebbd-8828-497b-95b1-8080d75e4e0e`). Created 2026-09-09.
- `joshuafisherkeller+bscmember@gmail.com` — **`team_member`** ("Testy McTesterpants"), **same team**, so team-scoping is testable by comparing the two. Created 2026-09-09.
- ⚠️ **Never record a password here.** Both are Josh's Gmail (plus-addressing, one inbox); ask him if a session is needed.
- ⬜ `test@uky.edu` / `1234` is long gone (verified 2026-07-29). Do not rely on it.

**✅ Resolved 2026-09-09.** The two accounts above end the long-standing gap where every team-scoped and admin-gated item shipped with verification deferred to Josh. **Claude Code should now click-through verify that UI itself** rather than writing "⬜ admin-gated, not verified" and handing it back. Both live on a demo collaborative, never a real cohort, so exercising them is safe.

Two caveats worth keeping in mind. `agency_admin` is scoped to its own team, so it cannot stand in for `super_admin` or `trainer_admin` checks. And STS-BSC Demo is team-based and assessment-driven, so these accounts exercise nothing on the TIPE side, which is teamless and has no participant accounts at all by design.

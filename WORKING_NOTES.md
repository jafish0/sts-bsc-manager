# Working Notes — BSC Manager

A bidirectional scratchpad shared between Josh, Claude Cowork (Claude desktop chat, used for thinking through ideas), and Claude Code (CLI, used for implementation).

> Both Claude Cowork and Claude Code should read this file when starting a session in this repo. `CLAUDE.md` points here for project conventions + recent context; `INFRASTRUCTURE.md` covers production stack and one-time ops follow-ups.
>
> **Append-only conventions:**
> - "Recently shipped" — newest at top. One bullet per commit, with hash + date + one-line summary. Claude Code updates this after each push.
> - "Ideas / drafts" — drop polished prompts here for the next Claude Code session, or rough ideas you want Claude Cowork to help you refine. No deletion needed; once a draft ships, move it (verbatim) into "Recently shipped" so the history stays intact.

---

## ⬇ Recently shipped (Claude Code → Claude Cowork)

> What's been built recently, so Claude Cowork has the running context without re-reading the entire git log.

- **2026-06-10 `b733257`** — Registration hardening (4 fixes from INFRASTRUCTURE follow-ups; draft preserved at `2554861`). **Fix 1:** capacity-decrease guard in `RegistrationLinkModal.handleSave()` — blocks lowering capacity below the count of confirmed (`status='registered'`) registrations; waitlisted don't count. **Fix 2:** `event_registrations.confirmation_sent_at` column; `send-registration-email` v2 stamps it on successful confirmation/promotion sends; roster shows "⚠ not sent" badge + "✉ Resend" button on NULL rows. **Fix 3:** admin cancel in `RegistrationRosterModal` now POSTs to the `cancel-registration` edge function by `cancel_token` (atomic cancel + waitlist auto-promotion + both emails) instead of a direct status UPDATE. **Fix 4:** "Create registration link →" button on EventDetail (collab events only) → `/admin/registrations?prefill_collab=<id>`; `RegistrationsAdmin` preselects from the query param.
- **2026-06-01 `350ea1a`** — Sign-in / sign-out / eval enabled for Learning Calls (`all_team_call` + `senior_leader_call`). New `hasSignIn` flag in `CollaborativeDetail` (replaces the `isLS`-only gate on the session-link controls block + "X attended" / "X evals" badges; `isLS` stays for the type-badge color). `TeamDashboard` Session Attendance card widened from `.eq('event_type','learning_session')` to `.in('event_type', [...])`. `team_consultation`, `assessment_window`, and `other` intentionally still un-signed.
- **2026-06-01 `edccdf6`** — Demo collab sign-in polish (live for the 6/2 pre-training call). **Agency capture (universal):** new `attendee_agency` column on `session_attendance` + `unmatched_attendees`, `sign_in_to_session` RPC extended with `p_attendee_agency text DEFAULT NULL` (stale 6-arg overload dropped), required "Agency" field added to `SessionSignIn` between Email and Role, Agency column surfaced on `AttendanceReport` (screen + PDF + Excel exports) and on `EventDetail`'s `StandaloneAttendanceList`. **Demo-collab redirect suppression (scoped):** `DEMO_COLLABORATIVE_ID` constant in `SessionSignIn` (temporary hardcode), 4s auto-redirect timer skipped + "Redirecting you to sign in..." copy + "Go to Dashboard Sign-In" button hidden when `eventInfo.collaborative_id` matches the demo collab. All other collabs and `standalone_training` events behave unchanged.
- **2026-05-10 `f8b826b`** — Standalone Training Manager (the "Polish from Sprang demo" sibling draft). New `kind='standalone_training'` discriminator on `bsc_events` + supporting columns (`end_date`, `hub_token`, structured location fields, `training_hub_intro`, `created_by`) + `user_profiles.bio`. New helper `profile_is_trainer_admin()`. RLS rewritten to handle both kinds; trainer admins get read-only access to all standalone trainings; public read by hub_token on `bsc_events` + scoped public read on `bsc_event_documents` + public SELECT on event-documents storage. New AdminDashboard tile, `/admin/trainings` listing page, `StandaloneTrainingModal` (Basics / Delivery / Trainer / Hub intro tabs with inline bio editor), and public `/training/:hub_token` hub (three-condition gate: hub_token + time window + sessionStorage flag, with markdown trainer bio and intro via `react-markdown`, Zoom button or Google Maps link, agenda + materials downloads, auto-refresh every 5 min). `EventDetail` gracefully adapts to standalone events (flat `StandaloneAttendanceList` replaces per-team roster; Coordinator card hidden). `SessionSignIn` redirects to the hub after sign-in. New dep `react-markdown@10`.
- **2026-05-08 `fd399e0`** — Doc-only convention update for the 2026-10-30 Supabase Data API grants change. New "Future migrations: explicit Data API grants" section in `CLAUDE.md` with the standard `GRANT` pattern and per-table verb tuning. Open follow-up in `INFRASTRUCTURE.md` with the inline audit query for future re-verification. Audit ran the same day confirmed all 41 existing public tables fully granted on all three Data API roles — nothing in production breaks at the cutover.
- **2026-05-08 `3f47132`** — Dark-mode bug pass (Item 4 of Dr. Sprang's demo-feedback batch). Extended `index.css` with attribute-substring selectors that retroactively map hardcoded inline colors (`white`, `#f9fafb`, `#0E1F56`, `#374151`, `#6b7280`, `#e5e7eb`, `#d1d5db`, etc.) to theme variables in dark mode — ~280 inline styles across the codebase covered without touching JSX. Widened form-input theming to include url/number/tel/date/time/datetime-local. Hand-fixed AdminDashboard + TeamDashboard ActionCard hover-out handlers (was imperatively setting `borderColor = '#d1d5db'`, now uses `var(--border-light)`).
- **2026-05-08 `646616f`** — Team Rosters card on CollaborativeDetail (Item 2 of demo-feedback batch). New collapsible "👥 Team Rosters" section below Teams: each team expands to show leaders + members with name, email (mailto), role badge, and "📋 Copy" buttons. New `fetchTeamMembers()` pulls all active user_profiles in one query. EventDetail roster table merges name+email into a single cell with a dedicated copy column.
- **2026-05-08 `913a076`** — ProQOL Secondary Traumatic Stress subscale dropped (Item 1 of demo-feedback batch) per Dr. Sprang — STSS measures it more rigorously. PROQOL_ITEMS no longer includes the 10 STS items; PROQOL_INFO drops the STS subscale entry; ProQOL.jsx stops including secondary_trauma_score in inserts (column stays NULL on new rows). DataVisualization, TeamReport, exportPdf, exportExcel all drop STS from display; dataRecommendations drops STS-based strengths/growth-areas. Existing proqol_responses data preserved.
- **2026-05-08 `0d284cb`** — Eval flow auto-sign-out fix (Item 3 of demo-feedback batch). Split SessionEvaluation handleSubmit into independent try blocks so a transient attendance-update failure can no longer swallow the post-submit navigate. After successful eval insert, navigation to `/session/:token/signout` always fires regardless of attendance update outcome.
- **2026-05-08 `72936d5`** — Centralized registration creation on a new `/admin/registrations` page (admin-tier only) instead of inside each CollaborativeDetail. New AdminDashboard tile "📝 Registrations". Page has a pick-a-collab dropdown (with `(N links)` badge per collab — no filtering, multiple links per collab are legitimate) + Create button on top, and a sortable cross-collab table (Title / Collaborative / Status / Registered / Waitlisted / Capacity / Created) below with Roster + Edit actions. Extracted `RegistrationRosterModal.jsx` as a shared component used by both the new admin page and the per-collab list. CollaborativeDetail's Registrations panel keeps the list + Edit + View Roster but the Create button is replaced by a "Manage all registrations →" link to the new page.
- **2026-05-08 `13386f9`** — Full event registration system (per-collaborative). New tables `event_registration_links`, `event_registration_link_events`, `event_registrations` + atomic `cancel_registration_and_promote(uuid)` SQL helper. Three edge functions: `mint-registration` (capacity + waitlist + idempotent-on-duplicate-email + honeypot), `send-registration-email` (confirmation/cancellation/promotion templates with .ics calendar attachment), `cancel-registration` (atomic cancel + waitlist auto-promotion + dual emails). Public pages `/register/:token` (dynamic form rendering from form_schema across 9 field types) and `/cancel-registration/:token`. Admin UI: `RegistrationLinkModal` component with three sections (Basics / Events covered / Form fields with reorder + system-vs-custom protection + common-field presets), and a Registrations panel + roster modal on CollaborativeDetail with searchable/filterable table, CSV export, manual promote-from-waitlist + cancel actions. QR check-in extension on SessionSignIn that links matching registrations to attendance and flips status to checked_in. RLS gates public reads/updates by token; admin CRUD via `is_admin_for_collaborative`. Full draft spec preserved in git history (see `git show bfdc330:WORKING_NOTES.md`).
- **2026-05-08 `d384107`** — Zoom links in Create Collaborative modal + post-launch event edit UI (admin-only "Edit" button on each event row); participant-side Parking Lot widget on TeamDashboard (loosened RLS so team members can submit/read/delete-own); SMARTIE goal comments **deactivated** (hidden behind `ENABLE_GOAL_COMMENTS = false` flag in `SmartieGoals.jsx`, schema kept).
- **2026-05-08 `f7e066d`** — Automated event reminder system: `event_rsvps` + `event_reminder_log` tables, `notifications_unsubscribed_at` + `unsubscribe_token` on user_profiles, pg_cron jobs for T-1 day (13:30 UTC) and T-1 week (15:00 UTC) reminders. New `send-event-reminder` edge function (per-recipient email, .ics calendar attachment, RSVP buttons, unsubscribe link). Refactored existing `send-event-email` to per-recipient (no more BCC) so unsubscribe is per-user. New public pages `/rsvp/:token` and `/unsubscribe/:token`. Trainer Dashboard "📨 RSVPs" expandable section.
- **2026-05-08 `56745fa`** — Trainer-side tools: Bright Spots widget (8 most recent completed goals across teams), Disengagement Alerts (teams idle 14+ days), Parking Lot tab on EventDetail (admin-only initially), SMARTIE goal comments inline on goal cards, realtime attendance roster (Supabase Realtime + 30s polling fallback).
- **2026-05-08 `a37c9ef`** — Zoom link column on bsc_events + 🎦 button across dashboards; agenda banner (collapsible orange bar via `document_type='agenda'` flag on `bsc_event_documents`, surfaced on EventDetail and TeamDashboard); drag-and-drop multi-file uploader on EventDetail.
- **2026-05-07 `220b784`** — `trainer_admin` role with collaborative-scoped access. New helpers `is_admin_for_collaborative(uuid)` + `user_admin_collaborative_ids()`. ~14 RLS policies widened. AuthContext exposes `isTrainerAdmin`, `isAdminLevel`, `myAdminCollaborativeIds`, `canAdminCollaborative(collabId)`. Cross-collab tiles on AdminDashboard hidden for trainer_admins.
- **2026-05-07 `55e164f`** — Auto-close sessions 30 min after `end_time` via pg_cron `close-expired-sessions` (every minute). "Close Session" button renamed "Close now" with auto-close ETA status line. `is_active` gate added to SessionEvaluation; soft-handle on SessionSignOut.
- **2026-05-07 `5bca568`** — Downloadable QR codes for session sign-in + eval/sign-out links. New `qrcode` dep, `QrCodeModal` component, "📱 QR" buttons on each learning-session row in CollaborativeDetail.
- **2026-05-07 `7f1591d`** — Per-event evaluation deep-dive (Phase 6): bar chart of mean Likert scores, NPS distribution, collapsible verbatim free-text lists, single-event PDF download.
- **2026-05-07 `973e101`** — Server-sent event emails (Phase 5): `send-event-email` edge function (Resend-backed). "Email all participants" / "Email team" / "Message coordinator" composers on EventDetail.
- **2026-05-07 `957b0b3`** — Event documents (Phase 4): `bsc_event_documents` table + `event-documents` Storage bucket + Session Materials card on TeamDashboard.
- **2026-05-07 `25e49ba`** — Event detail page (Phase 3): `/admin/event/:eventId` with roster grouped by team, live attendance polling, per-team email + view-team-dashboard buttons.
- **2026-05-07 `b73c5f0`** — Trainer Dashboard shell + Recent Evaluations + PDF generator (Phase 2).
- **2026-05-07 `33a7c6b`** — `collaborative_trainers` foundation table + assignment UI in CreateCollaborativeModal (Phase 1).

---

## ⬆ Ideas / drafts for the next Claude Code session (Claude Cowork → Claude Code)

> Drop polished prompts here for the next Claude Code session to pick up. When Josh starts a new session with Claude Code, he'll say "read WORKING_NOTES.md, the latest draft is at the bottom" and Claude Code will work from there. Drafts can also be rough — Claude Cowork can help refine them in place before handing off.

<!-- Add new drafts BELOW this line, newest at the bottom so Claude Code works through them in submission order. -->

_(none — most recent draft "Registration system hardening" shipped 2026-06-10 as `b733257`. The draft WAS committed first this time (`2554861`) — recover the full spec via `git show 2554861:WORKING_NOTES.md`. Workflow gap closed; keep committing drafts when they're added.)_

<!-- Archived original draft section follows for posterity. Future drafts replace the placeholder above; this stays as a record of the spec. -->

### 2026-05-10 — Standalone Training Manager (super_admin + trainer_admin)

**Goal.** A new feature in BSC-Manager for managing one-off trainings that are NOT tied to a learning collaborative. Reuses ~85% of existing event infrastructure (registration, sign-in/out/eval, QR codes, reminders, email composer, drag-and-drop materials, realtime attendance roster) and adds a participant-facing "training hub" page that's only accessible after on-site sign-in.

V1 scope: single-trainer (creator is the owner), single-day OR multi-day via date range, in-person OR online (Zoom), no recordings, no certificates, no CEUs.

#### Permission model

- Creation + management: `super_admin` + `trainer_admin` (use existing `isAdminLevel` boolean from AuthContext)
- Creator is the default and only trainer on the event for V1
- Co-trainer support deferred to V2 (would mirror `collaborative_trainers` via a new `event_trainers` table)

#### Data model changes

**`bsc_events`** (existing table — additive changes only):
- Drop NOT NULL on `collaborative_id` (or whatever the current constraint is — make it nullable)
- ADD `kind text NOT NULL DEFAULT 'collaborative_event'` — values: `'collaborative_event'` | `'standalone_training'`. Existing rows backfill to `'collaborative_event'`.
- ADD `end_date date` — NULL for single-day; populated for multi-day. (Existing `event_date` is the start date.)
- ADD `hub_token text UNIQUE` — generated at creation, used as public URL token for the training hub
- ADD structured location fields, all nullable: `location_name text`, `address text`, `city text`, `state text`, `zip text`, `room text`, `parking_notes text`, `accessibility_notes text`
- ADD `training_hub_intro text` — markdown content shown on the hub above the agenda/materials

**`user_profiles`** (existing table):
- ADD `bio text` — markdown. Universal field that surfaces on the training hub, StaffDirectory, and future "about the team" pages.

No new tables. Registration, sessions, attendance, materials, evaluations all key off `event_id` and work for both kinds of events.

#### New routes

| Route | Auth | Purpose |
|---|---|---|
| `/admin/trainings` | super_admin + trainer_admin | List + manage standalone trainings |
| `/admin/trainings/:eventId` | super_admin + trainer_admin | Manage page (adapts EventDetail; hides collab-only UI) |
| `/training/:hub_token` | public — requires successful sign-in | Participant training hub |

#### Admin dashboard tile

New tile on AdminDashboard: **"📚 Standalone Trainings"**, gated to `isAdminLevel`. Mirrors the existing dashboard-tile styling.

#### `/admin/trainings` listing page

- Lists trainings the user has admin access to (super_admin sees all; trainer_admin sees their own created events)
- Columns: Title, Date(s), Mode (in-person / online), Registered count, Status (Upcoming / In Progress / Closed)
- Per-row actions: Manage, View Roster, Copy Sign-In Link, Edit
- "+ Create Training" button opens the StandaloneTrainingModal

#### StandaloneTrainingModal (create/edit)

Single modal with collapsible sections, mirroring the `RegistrationLinkModal` UX:

**Basics**
- Title (text, required), Description (textarea, optional)
- `is_multi_day` checkbox (default unchecked)
- Date(s): single `event_date` if not multi-day, OR `event_date` + `end_date` if multi-day
- Start time, end time (applies to each day's window in multi-day)
- `training_hub_intro` markdown editor

**Delivery mode**
- Radio: In-person | Online
- If Online: Zoom link field (reuses existing pattern from `a37c9ef`)
- If In-person: structured location fields (all optional) — `location_name`, `address`, `city`, `state`, `zip`, `room`, `parking_notes`, `accessibility_notes`

**Trainer**
- Defaults to the creator. Display their name + bio (from `user_profiles.bio`).
- Co-trainer add UI deferred to V2.

**Materials + Agenda**
- Reuse the existing drag-and-drop multi-file uploader from EventDetail (`a37c9ef`)
- Reuse the agenda banner pattern (`document_type='agenda'`)
- For multi-day: single agenda spans all days; materials are all uploaded at once (no per-day separation in V1)

**Save behavior:** generates a random 16-char alphanumeric `hub_token` at creation.

#### `/admin/trainings/:eventId` manage page

Adapts the existing `EventDetail.jsx` for standalone events. The collaborative-tied sections (cohort, team list, learning-session context) are hidden when `kind='standalone_training'`. Everything else (event documents, attendance roster, email composer, registration link section) renders as-is.

ADD: **collapsible "👥 Live Roster" bar at the top of the page.**
- Default expanded during the event window (start to end+30min); default collapsed otherwise.
- Shows name, email, agency, role, sign-in time per participant.
- Updates in real-time (reuse Supabase Realtime + 30s polling fallback from `56745fa`).
- Collapse state persists in localStorage per event.

#### `/training/:hub_token` — participant training hub

Public route, no auth. Renders if AND ONLY IF all of:
1. `hub_token` matches a `bsc_events` row with `kind='standalone_training'`
2. Current time is within the active window: from `event_date` start time through `(end_date OR event_date) + 30 minutes after end_time`
3. Client-side sessionStorage flag `signedInForEvent_{event_id}` is set (set at successful sign-in)

If any condition fails, render an appropriate state:
- "Training has not started yet" (with start date/time) if before window
- "This training has ended" if after window
- "Please sign in first" (with explanation that QR codes / sign-in URLs are at the training venue) if sessionStorage flag missing
- Generic "Training not found" if hub_token invalid

When all conditions hold, render the hub:
- **Hero:** training title, date(s), start/end times, delivery mode badge (In-person / Online)
- **Trainer info:** name + bio (from `user_profiles.bio`)
- **Location info** (if in-person, only show fields that are populated): render nicely from the structured fields; show a Google Maps link if `address` is populated
- **Zoom link** (if online): prominent "Join Zoom" button
- **`training_hub_intro`** rendered as markdown above the agenda
- **Agenda:** rendered from the agenda document (markdown / PDF inline or download)
- **Training materials:** list of downloadable files from `bsc_event_documents` for this event

Hub auto-refreshes every 5 minutes to pick up the time-based access state change (so it can transition to "Training has ended" without a manual reload).

#### Sign-in flow (existing — minor extension)

Existing `/session/:token` flow:
1. Participant arrives via QR or shared link
2. Fills sign-in form (name, email, agency, role) — existing
3. Submits → attendance logged — existing

NEW: After successful sign-in:
- Look up `session_link.event_id` → `bsc_events.kind`
- If `kind = 'standalone_training'`:
  - Fetch the event's `hub_token`
  - Set `sessionStorage.signedInForEvent_{event_id} = true`
  - Redirect to `/training/:hub_token`
- If `kind = 'collaborative_event'`: existing post-sign-in behavior preserved

#### Sign-out / evaluation (existing — no changes)

Same flow as today. Hub remains accessible until auto-close (30 min after final end_time per existing pg_cron).

#### Registration (existing — no changes)

The existing registration link system already works for any event. Creating a standalone training and then creating a registration link off it via `/admin/registrations` works as-is. The registration link points at the event_id, captures registrations, sends confirmation emails with .ics calendar attachment, supports capacity + waitlist.

**Critical:** confirmation emails for standalone trainings do NOT include a hub link. Per Dr. Sprang, participants must not have material/agenda access before on-site sign-in. The confirmation email keeps its current shape (registration confirmed + .ics attachment + cancel link). No change needed to `send-registration-email` because the existing template doesn't link to a hub anyway.

#### RLS policies

`bsc_events`:
- Existing collaborative-event policies preserved (filter by `collaborative_id` via `is_admin_for_collaborative`)
- ADD: super_admin can SELECT/INSERT/UPDATE/DELETE any standalone training
- ADD: trainer_admin can SELECT all standalone trainings, INSERT new ones (becomes their owned event via `created_by`), UPDATE/DELETE only their own (`created_by = auth.uid()` AND `kind = 'standalone_training'`)
- Public SELECT on standalone trainings is gated by `hub_token` match — same pattern as registration links

`user_profiles.bio`:
- Existing user_profiles RLS covers it; no changes needed

#### Edge cases / business rules

- **Multi-day event with gap between days:** Hub remains open across days (the access window spans the full event start to final end + 30min). Participants who signed in Day 1 can review materials on Day 1 evening.
- **Participant signs out then back in:** Existing behavior — same email re-signs in, attendance row is idempotent. sessionStorage flag gets re-set. Hub access continues.
- **Participant arrives at `/training/:hub_token` directly without signing in:** sessionStorage flag missing → "Please sign in first" page.
- **Trainer changes end_date mid-event:** Auto-close cron picks up the new value on next firing. Hub window adjusts.
- **No registration link for a standalone training:** Walk-ins still work — trainer mints session_links manually and shares the QR / URL at the venue.
- **Per-day attendance in multi-day:** Each day's `session_link` is a separate row (existing pattern). Participant scans the new QR each day. Attendance is per day. Hub access stays continuous.

#### Out of scope for V1 (deferred)

- Co-trainers / multiple trainers per event
- Recordings posted on the hub after the event
- Certificates of completion
- **CEU / CE credit issuance** — needs manual verification step; design session pending (see Cowork memory `backlog_ceu_credits_standalone_trainings.md`)
- Hub access for registrants before the event (Dr. Sprang explicit restriction)
- Pricing / paid trainings
- Recurring trainings / templates
- Per-day agenda + per-day materials in multi-day events (V1 = one agenda + one materials library)
- Speaker bios beyond the `user_profiles.bio` field

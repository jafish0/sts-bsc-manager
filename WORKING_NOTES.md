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

_(none — most recent draft "Full event registration system" shipped 2026-05-08 as `13386f9`. Full spec preserved in git history at `git show bfdc330:WORKING_NOTES.md`.)_

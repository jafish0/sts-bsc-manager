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

- **2026-07-17 `28940db`** — Per-team "Data Visualization" button on the admin CollaborativeDetail team list (next to "View Report"), deep-linking to `/admin/data-visualization?collaborative=<id>&team=<id>`. DataVisualization now honors those query params and pre-selects the collaborative + team for any admin role (incl. trainer_admin, who has no team selector), so an admin sees a specific team's TIC-OSA (or STS) charts straight from the team list. (Josh: wanted the team viz reachable from the admin view, not just the team-leader view.)
- **2026-07-17 `b13544a`** — Fix: Data Visualization for team leaders. The page defaulted `selectedCollaborative` to the alphabetically-first collaborative; since agency_admins/team_members have the team selector hidden + their team pre-selected, a TIC/TIPE team leader (real or via View-As) landed on "STS-BSC Demo" with their team filtered out → empty. STS-BSC leaders only worked by luck (sorts first); item 4's TIC-OSA branch exposed it. Now team leaders/members resolve their team's `collaborative_id` and select that. (Reported by Josh: Necco/TIC LC team-leader view showed no Data Visualization.)
- **2026-07-17 — Anchor Lab demo prep batch (4 items, draft `b48b632`), one commit each:**
  - **`2fd7a30` (item 4)** — TIC-OSA Data Visualization for tic_lc. `DataVisualization` + `reportDataLoader` + `TeamReport` now render the Agency Self-Assessment instead of empty STSS/ProQOL/STSI-OA cards. New `TIC_OSA_DOMAIN_META` in `ticOsa.js` (5 domains + item counts) drives a comparable **% of maximum** view (domains range 12→132 raw, so raw bars aren't comparable). DataViz: domain bar chart + M(SD) table for the selected timepoint (Timepoint/Team filters give baseline-vs-endline + per-team). TeamReport: longitudinal line chart (% of max per domain) + per-timepoint domain table showing baseline→endline change. DNK/NA excluded, matching `TicOsa.jsx`. **STS-hardcoded PDF/Excel exports hidden for tic_lc** ("export coming soon" note) — flagged, not shipped broken. sts_bsc unchanged; tipe_lc stays empty (no instrument yet). Verified domain math against demo data (baseline ~60% → endline ~70% of max).
  - **`e9cce6c` (item 1)** — Program-aware "needs development" placeholders. New `ProgramPlaceholder` component; **Change Framework, Strategy Ideas, and Recommendations** short-circuit to it for tic_lc/tipe_lc instead of showing STS content. `reportDataLoader` now surfaces `team.programType` (Recommendations had zero program awareness before). Entry-point cards/tiles stay visible; STS-BSC + FourC unchanged. Fires correctly under View-As preview of a TIC/TIPE team. **Other STS-carryover audit (as requested):** TeamDashboard's STS-PAT + Supervisor Self-Rating cards are already program-gated (`hasStsPat`/`hasSupervisorSelfRating` branding flags) so they DON'T leak; the assessment flow + SMART/SMARTIE goal labels are already program-aware. Remaining STS-specific bits to triage next round: **TeamReport STS-PAT section** (not explicitly program-gated — renders only if a tic team had PAT assessments, which demo tic teams don't, so currently harmless) and the **DataViz/TeamReport PDF+Excel exporters** (STS-hardcoded — hidden for tic in item 4, still need TIC versions).
  - **`b3f1da6` (item 3)** — "View as CTAC Admin" (trainer_admin) in the View-As switch — collaborative-scoped (no team pick); AuthContext derives the full scoped trainer_admin boolean set so AdminDashboard shows the scoped trainer experience. **RLS caveat (as requested):** front-end preview only — pages that filter on `myAdminCollaborativeIds`/`canAdminCollaborative` look right; any page gated only by RLS would still read as the real super_admin (broader data). Cross-collab dashboard tiles are hidden in preview, so the main entry points are scoped.
  - **`8e3ec98` (item 2)** — "Other Training Faculty will appear here" copy on StaffDirectory (persistent note) + the Project Staff card/tile descriptions, so the thin directory reads as intentional.
- **2026-06-10 `bac319c`** — ⚠️ **Full demo rebuild executed** (destructive; draft `c73451f`, Josh confirmed). Wiped ALL prior collaboratives via one cascade `DELETE FROM collaboratives` (the old 4 collabs incl. the interim `STS-BSC 2026`/`TIC LC 2026` — superseded by the CTAC team below). **Preserved:** 278 TIPE resources, resource_categories, all 6 user accounts (`user_profiles.team_id` is SET-NULL not deleted). Rebuilt exactly **3 `is_demo` collaboratives** — **STS-BSC Demo**, **TIC LC Demo**, **TIPE LC Demo** — each with its program's default events; **18 teams** total. New `teams.demo_roster jsonb` (display-only spoofed rosters, no auth accounts) rendered in the CollaborativeDetail Team Rosters card when a team has no real members. Mock data (anon path, baseline+endline, endline improves on baseline): STS-BSC 5 mock teams × all 4 instruments = **634**; TIC-LC 6 teams demographics+TIC-OSA = **704** (1,338 responses). TIPE teams: rosters only, no data. **STS-BSC "Center on Trauma and Children" team**: no roster, no mock data, **4 active real survey codes** for CTAC staff (baseline `UYWLJT`, endline `3AJ4HQ`, followup_6mo `QRC5NW`, followup_12mo `6H3AAR`; enter at bsc.ctac.app root). `scripts/rebuild_demo.py` (emit structure.sql → Claude runs via execute_sql after wipe; load posts bulk data via anon) reuses the existing seed generators. Verified: 3 demo collabs, 18 teams, 1,338 responses, 0 bad/orphan demographics, resources + users intact.
- **2026-06-10 `a2d3cbf`** — Activated the TIPE LC program tile on AdminDashboard (flipped `active: false` → `true`). Removes the "Coming Soon" badge, restores full-color styling, and makes the tile clickable (→ `/admin/collaboratives`) like STS-BSC/TIC LC — TIPE is now built out (resources loaded, SMART goals filled, selectable in create). FourC stays Coming Soon (intentionally not built). Note: the tile's `active` flag is a hardcoded list in `AdminDashboard.jsx`, independent of the resource load — that's why it still read "Coming Soon" after the library upload.
- **2026-06-10 `5cedac2`** — CSV export on the feedback triage dashboard (draft at `d149751`). "⬇ Export CSV (N)" button in the `/admin/feedback` header (super_admin-gated) downloads the **currently-filtered** rows (respects status/category/severity/submitter/collab filters + search, so it matches what's on screen) with all fields — `id, created_at, user_email, user_role, category, severity, route, page_label, program_type, collaborative_id, message, status, admin_notes, resolved_at` — pairing each row's triage decision with its content for synthesis. Client-side blob download, RFC-4180 quoting (commas/quotes/newlines escaped), UTF-8 BOM for Excel; disabled when 0 rows. No backend change. Escaping verified in isolation; live UI check deferred to Josh (super_admin login).
- **2026-06-10 `66293f0`** — Follow-up fixes to `seed_tipe_resources.py` after Josh's run: (1) **idempotency** — the insert loop now fetches existing `tipe_lc` file_paths up front and skips files already loaded, so a re-run no longer duplicates the 249 rows or re-pushes files (the docstring had promised this; the code hadn't done it); (2) **`resource_type` from the real extension** (Josh's mid-run patch, now committed) instead of literal `'file'`. Verified against the live DB (249 distinct hashed paths → a re-run would skip all 249).
- **2026-06-10 (data op — Cowork + Josh)** — TIPE resource library **LOADED**. Josh ran `scripts/seed_tipe_resources.py --commit`: **249 files** → `resources` bucket, **26 categories**, 16 multi-category files correctly multi-tagged. Live DB now: 278 tipe_lc resources (249 file-backed + 24 YouTube embeds + 5 non-YouTube links) + the source PDF. One constraint change made live during the run: `resources_resource_type_check` broadened to allow html/xlsx/jpg/webp/common types (the zip has those; it previously only allowed pdf/docx/pptx/doc/youtube/link). The **Videos** category's YouTube/link rows were added via SQL (the script's pypdf embed step didn't run). Follow-up code fixes committed at `66293f0` (idempotency + resource_type-from-extension) — the earlier ⚠️ caveats are resolved.
- **2026-06-10 `14ad573`** — Sign-in-gated session materials for collaborative sessions (draft at `1549808`). New `/session/:token/materials` page (agenda + event documents, downloadable; Zoom link if present), landed on after signing into a collaborative session link instead of bouncing to `/login` — mirrors the standalone training hub. Soft-gated on the per-device `signedInForEvent_<id>` flag; the session link's own `is_active`/`expires_at` is the open window (auto-closed 30 min post-event by the existing cron). `SessionSignIn` post-sign-in routing unified into one redirect effect (standalone→hub, collaborative→materials); the old `/login` auto-redirect + demo-collab redirect-suppression branch removed (everyone gets materials now). New scoped public-read RLS policy on `bsc_event_documents` for collaborative-event docs whose event has an active session link (the `event-documents` bucket was already publicly readable). **Verified in browser as an anon participant:** sign-in → materials with agenda + handout (confirms anon RLS read returns rows), clearing the device flag shows the "please sign in first" gate, no console errors.
- **2026-06-10 `774416a`** — "View as" preview switch for super_admin (draft at `1549808`). Front-end-only preview (NOT an RLS sandbox): `AuthContext` gains a `viewAs` override (role + collaborative/team/program, persisted in sessionStorage); the exposed `profile` + all role booleans derive from the simulated role while previewing, so participant pages (TeamDashboard, Resources, ForumThreadList, …) render the simulated experience and admin tiles hide. New global `ViewAsControl` (renders only for real super_admins): bottom-left launcher → role/collab/team picker, persistent top banner with Exit while previewing. `realProfile` keeps the true profile; `setViewAs` guarded to real super_admins; `signOut` clears it. Resources program-switcher falls out for free (its `profile.team_id && !isSuperAdmin` effect resolves the simulated team's program). Build-verified; live UI check deferred to Josh (needs a super_admin login).
- **2026-06-10 `37d5bd1`** — Two pre-testing config guardrails (drafts at `1549808`). (1) `CREATABLE_PROGRAM_TYPES = [sts_bsc, tic_lc, tipe_lc]` — the create-collaborative dropdown maps over it instead of `PROGRAM_TYPE_COLORS`, so **FourC can no longer be selected** (it has no assessment routes/score columns → broken dashboards); `PROGRAM_TYPE_COLORS` keeps fourc so existing collaboratives/badges still render. (2) `PROGRAM_BRANDING.tipe_lc.goalFields` filled with Leah's 5-field SMART template (was `[]`), mapped onto the shared goal column keys; `goalType`/`goalLabel` unchanged.
- **2026-06-10 (data op, no app code)** — Seed demo data + two empty real collaboratives (draft preserved at `2624ed2`; seed scripts committed in `scripts/`). **Found already done:** 'Demo 2026' was fully seeded by a prior session (3 teams × 4 timepoints, 954 responses, all four instruments) — left untouched, exceeds the baseline+endline ask. **Seeded new:** 3 TIC teams in the TIC-LC demo collab (Cumberland River Behavioral Health / Harbor of Hope, Family Nurturing Center / Safe Roots Collective, Mountain Comprehensive Care Center / Resilience Rising) with 320 anonymous respondents (52–58 baseline, 50–54 endline per team), each a complete **demographics + TIC-OSA** set — NOT all four instruments: the `tic_lc` program flow administers only those two (per `programAssessments.js`), so STSS/ProQOL/STSI-OA rows would never render for TIC teams. Endline improves over baseline per team (e.g. mean TIC-OSA total 245→282); ~6% Do-Not-Know/N/A responses excluded from domain scores exactly like `TicOsa.jsx` scoring; domain-score recompute + demographics range checks passed; the collab's 9 events / 6-2 sign-in setup untouched. Baseline team-code expiry was temporarily extended for the RLS-gated insert and restored after. **Part B:** new collabs 'STS-BSC 2026' (`0bd200d6`) + 'TIC LC 2026' (`13a4b757`), `is_demo=false`, one empty 'CTAC Staff' team each, zero data/events — team codes to be generated when Josh is ready. Also flipped 'Demo 2026' to `is_demo=true` (both demo collabs now suppress the sign-in redirect; the draft designates both as the demos).
- **2026-06-10 `ae1fd09`** — ProQOL burnout-only (drafts preserved at `4735813`). Mirrors the `913a076` STS-removal pattern: the 10 Compassion Satisfaction items removed from `PROQOL_ITEMS` (burnout item IDs keep original ProQOL 5 values), `PROQOL_INFO` + copy now describe a single 10-item burnout subscale, insert no longer includes `compassion_satisfaction_score` (column stays, NULL on new rows; no migration). DataVisualization + reportDataLoader now filter stats on `burnout_score` (so new burnout-only rows count); TeamReport chart/table, exportPdf, and exportExcel are burnout-only (the Excel sheet's leftover STS columns also removed — they'd have crashed on the new loader shape); dataRecommendations drops CS strengths/growth, CS cross-cutting insights, and `summary.proqolCS` (banner metric removed in DataRecommendations.jsx). All existing `proqol_responses` rows preserved. **Flag for Josh (per draft, not a blocker):** ProQOL is now a ~10-item burnout-only scale; the ProQOL copyright asks the measure not be altered for free use — CTAC already administers a shortened version.
- **2026-06-10 `00f15ce`** — Feedback triage dashboard (drafts preserved at `4735813`). New `/admin/feedback` page, **super_admin only** (gated `isSuperAdmin`; trainer_admins blocked + tile hidden): status-count pill filters, category/severity/program/submitter/collaborative dropdowns + free-text message search (client-side), newest-first table. Detail modal (AddTeamModal overlay pattern) shows full message + captured context + screenshot via 1-hour signed URL from the private `feedback-screenshots` bucket (null path handled); status select (new → triaged → incorporated → declined) + `admin_notes`, stamping `resolved_at` on incorporated/declined (preserved if already set, cleared on move back). "🐞 Feedback Triage" tile on AdminDashboard.
- **2026-06-10 `a52463d`** — Demo/UAT contextual feedback widget (drafts preserved at `ddb75e6`). New `app_feedback` table (explicit GRANTs, no anon; RLS: admin-level INSERT own / read own / super_admin reads + triages all) + private `feedback-screenshots` bucket. Global `FeedbackWidget` (admin-level only): floating "💬 Feedback" button → html2canvas viewport screenshot (captured before the panel paints, widget self-excluded), route→page-label map, collab-id from scoped routes, category/severity/message, user-agent + viewport. Screenshot failure never blocks submission. Triage dashboard is Cowork's (separate artifact over the table). Dep `html2canvas` promoted to direct.
- **2026-06-10 `9b01b22`** — CEU course-correction (revises `886245a`; drafts at `ddb75e6`). In-app .docx certs failed the uneditable-PDF requirement → the app now exports an Excel roster (`Name / Email / Hours Attended / Hours Total`, included participants only) and the desktop Training Manager tool issues PDFs. **Kept:** `ceu_eligible`, `evaluation_completed_at`, eval-flow change, strict credit rule, Configure + Review screens. **Rolled back:** `send-ceu-certificate` (tombstoned 410 — delete from dashboard when convenient), JSZip merge engine + approval constants + bundled template + `jszip` dep; dropped `collaborative_ceu_config` + `ceu_certificates` tables. **Desktop tool** (first commit of `TrainingEventManager.py` to the repo): new "Precomputed Roster (App)" picker + "Date Range (roster mode)" entry on the LC tab, `_lc_get_participants()` helper unifying review/test/send (roster mode bypasses Qualtrics parsing entirely), roster hours used verbatim in approval texts, `build_attendance_html` degrades to a one-line summary with empty session_data. Verified: py_compile clean on the tool's Python 3.14 + app-format .xlsx round-trips the parser.
- **2026-06-10 `886245a`** — CEU certificate issuance for learning collaboratives (batch item 4/4; drafts preserved at `8e4ed3c`). New `bsc_events.ceu_eligible` + `session_attendance.evaluation_completed_at`; new `collaborative_ceu_config` + `ceu_certificates` tables (explicit GRANTs + admin RLS). Credit rule: signed-in + eval-completed + explicit sign-out (`sign_out_method='manual'`), all three per session; admin review screen allows per-session manual overrides. **Eval-flow change:** SessionEvaluation now stamps `evaluation_completed_at` and leaves sign-out to the signout page (which stamps `'manual'`) — previously eval stamped `'evaluation'` and the signout page's update never ran. CEU engine in `utils/ceu.js`: six approval texts ported verbatim from `TrainingEventManager.py`, `buildLcAttendance` mirror, JSZip-based docx merge validated against the real template (8/8 placeholders, images byte-identical, multi-line approvals via `<w:br/>`). New page `/admin/ceu/:collaborativeId` (Configure / Review / Generate) with "🎓 CEU Certificates" button on CollaborativeDetail; bulk ZIP download + per-participant email via new `send-ceu-certificate` edge function. **Output is merged .docx, not PDF** (browser-side docx→PDF infeasible; desktop tool had the same fallback). Template bundled at `frontend/public/templates/`. New dep `jszip`.
- **2026-06-10 `ed0a543`** — Trainer analytics (batch item 1/4). (a) Active Participation Index: `utils/participationIndex.js` single-source formula (forum posts + goal activity normalized against max-across-teams + all-time checklist rate, equal weights, trailing 30 days) + ranked TrainerDashboard widget with visible component breakdown. (b) Resource Utilization: new `resource_downloads` table (anon INSERT-only, authenticated SELECT+INSERT, admin-read RLS) + `utils/logDownload.js` fire-and-forget logger in all four signed-URL download paths + most-downloaded / by-domain widget. (c) Weekly trainer digest: new `send-trainer-digest` edge function (one email per trainer, all their collabs, prior-week goals/PDSAs/evals/parking-lot; skips quiet weeks + unsubscribed) + `weekly-trainer-digest` pg_cron Mondays 13:00 UTC.
- **2026-06-10 `2ac9993`** — T-1 hour + starting-now reminders (batch item 3/4). New `fire_imminent_reminders()` + `imminent-reminders` pg_cron every 5 min: `hour_before` for events starting within 60 min, `starting_now` in a -10/+5 min window. Idempotent via `event_reminder_log`; vault key pattern. CLAUDE.md cron inventory now lists four jobs.
- **2026-06-10 `70414c2`** — Demo-mode flag (batch item 2/4). `collaboratives.is_demo` column (backfilled for the current demo collab) replaces the `DEMO_COLLABORATIVE_ID` hardcode. Narrow `event_collab_is_demo(p_event_id)` SECURITY DEFINER RPC exposes only the boolean to anon sign-in visitors. "Demo collaborative" checkbox (super_admin only) in CollaborativeDetail's edit form.
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

**Anchor Lab demo prep batch (4 items) — ✅ ALL SHIPPED 2026-07-17** (`8e3ec98`, `b3f1da6`, `e9cce6c`, `2fd7a30`; see Recently shipped for details incl. the STS-carryover audit + RLS caveat). Two features remain ⏳ **blocked on Ginny** (see the callout directly below). _(Shipped 2026-06-10: full demo rebuild `bac319c`, TIPE tile `a2d3cbf`, CSV export `5cedac2`, TIPE seed fixes `66293f0`, TIPE library LOADED; config guardrails `37d5bd1`, View-as `774416a`, session materials `14ad573`; earlier: demo-data seed `2624ed2`, feedback triage `00f15ce`, ProQOL burnout-only `ae1fd09`, CEU course-correction `9b01b22`, feedback widget `a52463d`.)_

### ⏳ AWAITING GINNY — resolve ASAP (blocks 2 features)

> **Josh action item:** these two are the only things standing between us and building two more features. Both need input from Ginny (or an RA she delegates) — they're research-methods decisions, not engineering ones. Nothing here can be scoped or built until she delivers the specifics. Ping her with the two concrete asks below.

1. **Data-cleaning rules list** → unblocks the **Data-cleaning stage** feature (full spec in the ⛔ draft below). **Ask Ginny for:** the normalized "how we clean the data" ruleset — valid ranges per field (e.g. age min/max), junk-pattern definitions (straight-lining, etc.), and duplicate/blank handling. Seeds already surfaced: straight-lining, out-of-range age typos. Once the list exists, the app operationalizes each rule as a flag + manual review-and-resolve step (with an audit trail).
2. **Percentile basis for STSI-OA + STSS** → unblocks a **percentiles display** feature. Ginny asked (demo meeting) for percentiles shown for STSI-OA and STSS. **Ask Ginny for:** what the percentiles are computed against — an external normative reference (provide the norm tables / means+SDs), or within-cohort ranking? Can't build until the basis is defined. (The ProQOL "burnout-only" part of that same meeting note is already shipped — `913a076` + `ae1fd09`.)

### 2026-06-10 — Data-cleaning stage for STS-BSC assessment data ⛔ BLOCKED (do not implement yet)

> ⛔ **Not ready for Claude Code — skip this.** Blocked until Ginny (or an RA) delivers the "how we normally clean the data" rules list — that's research-methods domain and is explicitly one of Ginny's app-review jobs. This entry captures ONLY the **machinery requirements** gleaned from the demo meeting with Ginny (recovered from a closed-caption transcript). The actual cleaning rules are hers to define and are deliberately NOT invented here.

**Machinery the conversation established (app's responsibility):**
- A distinct **data-cleaning stage between collection and publishing to teams** — cleaning must finish BEFORE a team sees its dashboard/reports (ties into the publish-before-teams-see gate; cf. `admin_reviews` / `CLAUDE-1.md`).
- **Flag, don't auto-fix:** apply defined rules and flag records/fields that "need manual review."
- **Rule-based, not AI:** specific rules they define; no ML.
- **Manual resolution UI:** reviewer clicks through flagged items and resolves/edits them "like track changes" → implies an **audit trail** of changes (research-integrity requirement).
- **Hybrid:** automated flagging + manual resolution; some checks may stay fully manual.

**Only concrete rule examples that surfaced (from Ginny/Josh — seeds for her list, NOT a complete ruleset):**
- **Straight-lining** — respondent selected the same answer (e.g., "1") for everything.
- **Out-of-range / implausible values** — esp. **age** typos ("2" instead of 20-something), which have slipped through before and embarrassed on the dashboard.

**Blocked on:** Ginny/RA producing the normalized cleaning-rules list (valid ranges per field, junk-pattern definitions, duplicate/blank handling, etc.). Once delivered, the app operationalizes each rule as a flag + review-and-resolve step. Do not scope implementation before that list exists.

**Adjacent notes from the same meeting (capture only, separate from this feature):** Ginny wants **percentiles** shown for STSI-OA and STSS; on **ProQOL she wants ONLY the burnout subscale** — drop secondary traumatic stress (shipped `913a076`) AND compassion satisfaction (shipped `ae1fd09`).

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

---

### 2026-07-17: Anchor Lab demo prep batch (4 items) — ✅ SHIPPED (8e3ec98, b3f1da6, e9cce6c, 2fd7a30) — spec kept for reference

> **Context:** Ginny, Alex, and Leah (all super_admin testers) begin structured feedback on the live app shortly. Josh's own pre-testing pass found STS-BSC content leaking into TIC LC / TIPE LC contexts, plus one real build gap. Items ordered smallest to largest. Prefer one commit per item so partial shipping is clean. STS-BSC behavior must be unchanged by items 1, 2, and 4.

#### Item 1: Program-appropriate placeholders for TIC LC + TIPE LC (stop STS-BSC carryover)

The Change Framework, Strategy Ideas, and Recommendations surfaces currently show STS-BSC-specific content no matter the program. For collaboratives/teams whose `program_type` is `tic_lc` or `tipe_lc`:

- **Keep the entry points visible** (cards on TeamDashboard, tiles/links on admin pages). Do NOT hide them.
- **When opened in a tic_lc or tipe_lc context, replace the STS-BSC content** with a clean "needs development" state, program-aware copy along the lines of: "This section is being developed for [TIC LC / TIPE LC]. The guidance shown in STS-BSC collaboratives is specific to secondary traumatic stress and program-appropriate content will replace this."
- Applies to: Change Framework (`/admin/change-framework` and any team-facing card), Strategy Ideas, and the data-driven Recommendations (DataRecommendations / `dataRecommendations.js` output wherever it renders for teams and admins).
- **Do not invent TIC or TIPE content.** Placeholder only; the real content is a faculty deliverable.
- Josh saw "a lot of carryovers" beyond these three. While in the code, **list (in your ship summary, without changing behavior) any other STS-BSC-specific content you find rendering in tic_lc / tipe_lc team or admin contexts** so we can triage the rest next round.

#### Item 2: Project Staff copy

Wherever Project Staff renders (the TeamDashboard "Project Staff" card, the StaffDirectory page at `/admin/staff`, and the AdminDashboard reference to it), keep listing real staff (currently just Josh Fisherkeller) and add the statement: **"Other Training Faculty will appear here."** Apply across all programs; the staff directory is equally thin everywhere right now.

#### Item 3: "View as CTAC Admin" (trainer_admin) in the View-As switch

`ViewAsControl.jsx` currently offers only Team Leader (`agency_admin`) and Team Member. Add the CTAC trainer/faculty view:

- Add `{ value: 'trainer_admin', label: 'CTAC Admin' }` to `PREVIEW_ROLES`.
- trainer_admin is **collaborative-scoped, not team-scoped**: when this role is selected, the picker asks for a collaborative (not a team).
- The `viewAs` override in AuthContext must simulate the full trainer_admin boolean set: `isTrainerAdmin` true, `isSuperAdmin` false, `isAdminLevel` true, `myAdminCollaborativeIds` = [chosen collab], `canAdminCollaborative` scoped accordingly, so AdminDashboard renders the scoped trainer experience (cross-collab tiles hidden) exactly as a real trainer_admin sees it.
- Existing guards unchanged: only real super_admins can enter preview; exit restores the real profile.
- Known limitation to preserve, same as the existing roles: this is a front-end preview, RLS still runs as the real super_admin. Where a page filters by `myAdminCollaborativeIds` / `canAdminCollaborative` on the frontend the preview will look right; pages gated only by RLS may show broader data. Note any such pages in the ship summary rather than trying to sandbox RLS.

#### Item 4: TIC-OSA (Agency Self-Assessment) Data Visualization — build the tic_lc branch

**The gap:** `DataVisualization.jsx` and `utils/reportDataLoader.js` query only `stss_responses` / `proqol_responses` / `stsioa_responses`. A `tic_lc` collaborative renders empty even though TIC LC Demo has 704 responses (demographics + `tic_osa_responses`, baseline AND endline, all 6 teams). It is a build gap, not a data gap.

Build the tic_lc branch of Data Visualization:

- Load through `assessment_responses` (per CLAUDE.md gotcha: instrument tables link by `assessment_response_id`; never query by `team_code_id` directly).
- Compute TIC-OSA domain scores **consistent with `TicOsa.jsx` scoring** (Do-Not-Know / N/A answers excluded from domain scores; the demo seed data mirrors that scoring exactly).
- Show: collab-wide and per-team domain means, baseline vs endline change, response counts by timepoint, and the demographics breakdowns the STS-BSC view offers where they translate.
- Follow the existing chart patterns (Recharts, `COLORS`, existing card styles).
- **TeamReport for tic_lc teams:** render the TIC-OSA equivalents (domain table + change chart). If `exportPdf` / `exportExcel` are too STS-hardcoded to adapt cleanly in this pass, hide the export buttons for tic_lc with a short "export coming soon" note and say so in the ship summary. Do not ship broken exports.
- `sts_bsc` visualization behavior unchanged. `tipe_lc` stays empty for now (no instrument yet; AWARE survey pending from Ginny).

#### Item 5 (added 2026-07-17, URGENT, ship first): staff login link on the team-code entry page

The public root (`/`, TeamCodeEntry) currently has no path to `/login` at all. The Anchor Lab testers were just sent review guides whose login line points at the bare domain, so anyone who follows it dead-ends on the code-entry page. Add a small, unobtrusive "CTAC staff or team leader? Log in here" link on TeamCodeEntry that routes to `/login`. Placement: below the code-entry card, muted styling (small text, `--text-muted`), so it does not distract assessment respondents. This is also permanently correct: real users will always type the bare domain.

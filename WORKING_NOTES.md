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

- **2026-08-13 `22f1992` — attendance Excel + CSV export, via a shared builder (draft item 2 + the CSV Josh also asked for).** He has **44 real attendees** from the 2026-08-07 training to report on.
  - New `src/utils/exportAttendance.js` is the single sheet builder, used by **both** the standalone attendance list and the collaborative `AttendanceReport` — extracted rather than duplicated, per the draft.
  - ⚠️ **Two behaviour changes land on the collaborative export as a result, both fixes.** (1) Timestamps are now explicit **Eastern** (`Aug 07, 2026, 1:01 PM ET`); it used bare `toLocaleString()`, so the same session exported from a laptop in another timezone produced *different* times in the file — worthless for CEU reporting. (2) Added **Evaluation Completed** and **Sign-Out Method** columns.
  - **The real data proves those columns matter:** of 44 attendees only **35** completed an evaluation, and sign-out methods split between `manual` and `session_closed` — the latter meaning the admin closed the session or the cron swept them, which is *not* an explicit sign-out. Flattening that to a yes/no would hide exactly the distinction the CEU gate turns on.
  - `showTeam:false` for standalone (a Team column reading "Unmatched" 44 times looks like a fault, not "N/A"); exports the **sorted** rows so the file matches the screen; duration blank when either end is missing rather than invented; filename strips Windows-illegal characters plus commas and `&` (the real title has both); empty input still emits headers (`json_to_sheet([])` yields a sheet with *no* header row, so a pre-event export would open blank); CSV uses xlsx's own writer so embedded commas/newlines quote correctly, with a BOM so Excel reads UTF-8 instead of mojibaking smart quotes; header row frozen.
  - **Verified** the builder in node against two real rows covering both sign-out methods and a missing evaluation — 10 columns, correct ET conversion (`17:01Z → 1:01 PM ET`), durations `4h 28m` / `1h 0m`, blank eval empty, filename stem cleaned, Team only in the collaborative variant. Build clean; no `XLSX.` references left in `AttendanceReport`.
  - ⬜ **Not verified:** click-to-download and whether Excel opens it without a repair prompt — admin-gated, no test account.
- **2026-08-13 `279ac9b` — 🔴 all 5 PDF exporters were dead; migrated to autotable v5's functional API (draft item 1).** `jspdf-autotable@5.0.7`'s ESM build only calls `applyPlugin` when jsPDF is a browser **global**, which it never is in a Vite ESM app — so `import 'jspdf-autotable'` did nothing and `doc.autoTable` was `undefined`. Reproduced in node.
  - Confirmed (not assumed) that `autoTable(doc, …)` **does** populate `doc.lastAutoTable.finalY` and that chaining a second table off it works. That was the load-bearing check: all five files position the next block with `y = doc.lastAutoTable.finalY + N`, so had it not been populated this would have silently produced **overlapping tables** instead of an error.
  - 11 call sites across 5 files, scripted so every site changed identically; 0 old forms remain. Chose the functional API over `applyPlugin`-in-a-shared-module to avoid the import-order trap. No downgrade.
  - ⬜ **Not verified, and it is the point:** the real 41-response PDF was never rendered. The bug survived *because* nobody clicked, so **all five exports still need exercising in the browser**; four are admin-gated.
- **2026-08-04 `b1dd44c` + `0222e84` — hub on/off toggle per standalone training.** Josh's materials are handed out in the room, so sign-in routing attendees to a hub that reads *"this training hub opens at the start of the training"* was confusing — but other trainings will want the hub.
  - New `bsc_events.hub_enabled`, **DEFAULT true** so every existing training is unchanged; the trainer opts *out*. **`hub_token` is retained either way**, so switching the hub back on reuses the same URL and any printed QR still works.
  - With the hub off, `SessionSignIn` skips the redirect and its confirmation screen becomes the final destination — so the copy changed from *"Loading your session materials…"* (a promise it wouldn't keep) to **"Thanks for signing in!"** + *"Your attendance has been recorded."*
  - The toggle is in **two** places: the Manage-page panel, and the Edit modal's **Hub intro** tab (it belongs there because the intro is authored on that tab, and writing intro copy for a switched-off hub is wasted effort; the helper text notes the intro stays saved).
  - Two controls, one column — so they must agree. The panel seeded its checkbox from a `useState` initialiser (read once), meaning a save from the modal left it showing the **old** value until reload. Synced via an effect on `event.hub_enabled`. Both initialise with `!== false`, not `?? true`, so a deliberate false is never flipped back on.
  - The write checks the returned row count: an RLS refusal comes back as **0 rows, not an error**, which would otherwise look like success and snap back on reload.
- **2026-08-04 `0163f83` + `56ed1a9` + `dbff6cd` — attendee sign-out reworked: always ask for the email; confirm-email on sign-in.**
  - **The insight came from Josh's own test.** He signed in and evaluated on ONE device and was still asked for an email. Cause: the automatic path keyed off `sessionStorage`, which is scoped **per browser tab**, not per device — and scanning the evaluation QR opens a *new tab*. With QR codes that's the **normal** case, so "automatic" would have failed for most attendees while succeeding for a few. Inconsistent, and impossible to give a room of thirty people one instruction about.
  - **Now: one screen for everyone** — "Please enter the email you signed in with." Prefilled from `localStorage` (which *does* survive new tabs) so it's usually a single tap, but it only ever prefills a field the attendee confirms; it never signs anyone out on its own. Cleared on success so a shared phone can't prefill the previous person's address. `try/catch` so private browsing just yields an empty field.
  - **Before that (`0163f83`):** the sign-out page used to render **"You've Been Signed Out" having recorded nothing** whenever the device didn't know them — a false confirmation that also silently cost CEU credit. New `sign_out_by_email(token, email, mark_eval)` SECURITY DEFINER RPC (anon has no SELECT on `session_attendance` by design). Returns a **status string only, never row data**, so it can't read a roster. Idempotent — repeat calls return `already_signed_out` without moving the original timestamp. `SessionEvaluation` now redirects with `?evaluated=1` so a second-device attendee still gets credit for an evaluation they genuinely submitted.
  - **Confirm-email on sign-in (`dbff6cd`)** — Josh's request, and load-bearing now that sign-out matches on the address: a typo would leave someone unable to sign out at all. Trimmed + case-insensitive compare (so `Josh@x.org` vs `josh@x.org` isn't a false alarm), paste blocked on the confirm field, submit blocked both by the disabled button *and* a re-check in the handler.
  - **Verified on the LIVE page** (public, so click-through was actually possible this time): typo → button disabled + error shown; case-only difference → allowed, no false alarm; stray whitespace → allowed; form left empty afterwards so nothing was submitted. RPC verified earlier across all four status paths with probes deleted.
  - ⚠️ **Follow-up:** `SessionSignOut` no longer issues a direct `UPDATE` on `session_attendance` — all attendee sign-outs go through the RPC. The permissive `"Anon can update sign out"` policy (`USING true` — any anon could update any attendance row) may now be droppable, but the admin bulk-sign-out paths need checking first. Not bundled into this change.
- **2026-08-04 `dd329a5` — 🔴 REGRESSION I CAUSED, then fixed: `6ae8727` white-screened EVERY event page for ~15 minutes.** Josh hit a blank screen on `/admin/event/:id`.
  - **Cause:** I added `canManage` whose else branch was `canAdminCollaborative(event?.collaborative_id)`, then ran a `replace_all` on that exact string to update the five call sites — which also rewrote it **inside the new definition I had just written**, producing `const canManage = isStandalone ? (...) : canManage`. Evaluating that initializer reads `canManage` in its own temporal dead zone → `ReferenceError` during render.
  - **Blast radius was wider than the feature:** the else branch is the *collaborative* path, so this broke `/admin/event/:id` for **all** events, not just standalone trainings.
  - **Why it escaped:** valid syntax, so `vite build` compiled it cleanly, and `no-use-before-define` is **not enabled** in this eslint config, so lint passed too. Both green on a page that could not render.
  - **How it's now verified:** ran `eslint --rule no-use-before-define` against the broken file from `6ae8727` — it reports `187:7 'canManage' was used before it was defined` — and against the fixed file, which is clean. (A hand-rolled regex detector I tried first was **blind** to this shape, since the declaration's first line ends without a trailing operator; discarded rather than trusted.)
  - **Rule for this repo:** never `replace_all` a string that also appears in code added in the same edit. Optional hardening: enable `no-use-before-define` project-wide — it currently reports ~20 pre-existing hits that are all safe (a `const` referenced inside a callback), so it'd need those triaged or scoped first.
- **2026-08-04 `5594b68` + `6ae8727` — Standalone trainings: crash fix, then registration + sign-in/sign-out/evaluation QR codes. 4 migrations, 1 new component.**
  - **`5594b68` first — the Manage page crashed.** Josh's "Belonging, Recognition, and Sustainable Care for Counselors & Therapists" showed an error on create and `Event not found / invalid input syntax for type uuid: "null"` on Manage. The training had saved fine. `EventDetail` ran four collaborative-scoped loads unconditionally off `ev.collaborative_id`, NULL by design for standalone, so `collaborative_id=eq.null` hit Postgres (reproduced: `22P02` on both query shapes) and the `.single()` threw. The create error was the *same* crash — `TrainingsAdmin` navigates to `/admin/event/:id` right after saving. **A second bug was hiding behind it:** every management control was gated on `canAdminCollaborative(event?.collaborative_id)`, which returns false for a null id — so fixing only the crash would have produced a page that loads and manages nothing. Added `canManage` mirroring the `bsc_events` RLS write policy (`standalone → is_super_admin() OR created_by = auth.uid()`).
  - **`6ae8727` then built what Josh asked for — but most of it already existed.** The attendee chain (`/session/:token` → `.../eval` → `.../signout`) was already complete and **the evaluation already redirected to sign-out on submit** and stamped `evaluation_completed_at`. Nothing new was built attendee-side; it was walled off from standalone trainings by four `NOT NULL collaborative_id` columns plus collab-scoped RLS.
  - **Migrations.** `can_admin_bsc_event(uuid)` SECURITY DEFINER as the single answer to "may the caller administer this event?"; dropped NOT NULL on `collaborative_id` for `session_links`, `session_attendance`, `session_evaluations`, `event_registration_links`; re-gated their admin policies on the **event** rather than the collaborative, so authorization stayed exactly as tight. Session tables gate on `bsc_event_id` (NOT NULL, present at INSERT). Registration links **can't** — they cover N events via a join table that is empty at insert time, so a policy reading it would refuse every create; that branch gates on creator/super_admin.
  - ⚠️ **The one that would have failed in front of real people:** `sign_in_to_session`'s unmatched-attendee branch inserts into `unmatched_attendees`, whose `collaborative_id` is NOT NULL — so a standalone sign-in raised and aborted. Since nearly every standalone attendee is external with no app account, that was **almost all of them**, and it would only have surfaced at the door. Guarded rather than made nullable: that triage tool maps attendees onto *teams in a collaborative*, which is meaningless here and would fill the admin tool with unresolvable rows.
  - `registration_link_public` inner-joined `collaboratives` → zero rows for a standalone link, silently dropping the public `/register` subtitle. Now LEFT JOIN with a fallback to the covered training's title, NULL `program_type` so the page uses its program-agnostic wording.
  - **New `StandaloneSessionPanel`** on the training's Manage page: sign-in / evaluation / sign-out links each with copy + QR (reusing `QrCodeModal`), live signed-in / signed-out / evaluations / still-here counts, close-and-reopen sign-in with the same bulk sign-out `CollaborativeDetail` performs, and the registration link with its own copy + QR. Self-contained so collaborative flows are untouched. Expiry reuses `roster_share_expiry_for_date` (end of day Eastern, DST in SQL).
  - **`RegistrationsAdmin`:** *removed* the `.in('collaborative_id', collabIds)` filter that silently excluded standalone links — RLS now expresses the rule precisely for both kinds, so letting it scope is correct **and less code**. Added `canManageLink()` replacing two gates that returned false for a null collab.
  - **Verified against the real training row, all probes cleaned (0 left):** full chain with NULL collaborative (session link → external unmatched attendee signs in → eval recorded → `evaluation_completed_at` → signed out) with **0 `unmatched_attendees` rows**, confirming the guard; standalone registration link resolving through `mint-registration` (`400 Missing required field: Agency` proves it validated — used a must-fail payload so no registration and no email went to a live training); `registration_link_public` returning the title; `send-registration-email`/`eventsHeading()` confirmed to degrade rather than throw on a null collaborative.
  - ⬜ **Not verified by me:** the admin click-through — still no test account. Josh drives that.
  - ⚠️ **Pre-existing bug left alone, flagged:** `CollaborativeDetail.generateSessionLink` hardcodes `4PM EST = 9PM UTC`, which is an hour off during EDT. The new panel doesn't repeat it, but collaborative session links still carry it.
- **2026-07-30 `4cd9c86` — Registration data hygiene + roster-share expiry timezone (draft `4c367a0`, both items) — SHIPPED. `mint-registration` v5 deployed with `verify_jwt: false`.**
  - **Item 1 — answers are trimmed on submit.** Only `email` and `full_name` were trimmed, so everything else stored exactly as typed; in a 4-person roster that had already made `Allen County` and `Allen County·` two distinct districts. New `trimResponses()` normalizes the whole object *before* validation, dedupe and insert, so all three see the same values. **Strings only** — numbers/booleans/nulls untouched, internal spacing preserved. Verified with **8 assertions against the shipped source**, including that the `text_na` `'N/A'` sentinel survives and no type is coerced. Backfill re-checked: **0 rows** still untrimmed, so Cowork's in-place fix held.
    - ⚠️ **Honest limit on the live check:** the whitespace-only rejection I tested (`400 Missing required field: District`) behaved the *same* before this change, because `validate()` already used `String(v).trim()` for presence — so it proves no regression, **not** that the trim is applied. The stored-value proof comes from the next real registration. I did **not** submit a test registration to a live cohort link that has real registrants in it.
  - **Item 2 — the expiry bug was MINE**, introduced in `5916b90`. The SQL was always right; the modal was wrong two ways that compounded: reading did `String(ts).slice(0,10)` (the **UTC** date, which for an 11:59 PM ET instant is the *next* day, so the picker showed Oct 29 for a value meaning Oct 28 and drifted again on reopen), and writing sent a naive `T23:59:59` with **no offset**, which PostgREST reads as UTC — storing 7:59 PM ET. Fixed by moving the conversion into one place: new `IMMUTABLE roster_share_expiry_for_date(date)` sharing the `AT TIME ZONE` construction with `default_roster_share_expiry()`; the modal converts to Eastern via `Intl` (`en-CA` yields `YYYY-MM-DD` directly) on read and calls the helper on save. **Round-trip + DST verified both sides:** `2026-10-28` → `03:59:59+00` → reads back `2026-10-28 23:59:59` ET (−0400); `2026-12-02` → `04:59:59+00` → `2026-12-02 23:59:59` ET (−0500).
    - Found and fixed the **same UTC-slice bug** in `RosterSharePage`'s "stops working after" notice, which would have named the wrong day to the partner.
    - **Repaired the live AWARE share link**, which had been saved through the buggy path: `2026-10-29 23:59:59+00` (Oct 29 7:59 PM ET) → `2026-10-29 03:59:59+00` (**Oct 28 11:59:59 PM ET**), matching the rule. `lookup-roster`'s check compares real instants and was already correct — unchanged, as the draft said.
- **2026-07-30 `c1b0393` — TIPE registration fields: District + School (with N/A), Districts Served removed.** Josh's request, applied to `programConfig.js` for all future TIPE links **and** as a real-time edit to the LIVE AWARE link's stored `form_schema` (each link snapshots its own schema, so the config change alone would only affect new links).
  - Field order is now: Name*, Email*, Confirm Email*, **District***, **School***, Position or Title*, Grade Level(s). Verified on production.
  - **Kept the canonical `agency` key for District** rather than minting `district`: `agency` is the cross-program employing-organisation key the roster and CEU exports already read, so reusing it keeps the three existing registrations displaying instead of orphaning their answers inside the `responses` jsonb.
  - **New `school` key, type `text_na`** — a text box plus an N/A tick for district-level staff with no single school. Ticking writes the literal `'N/A'`, so the field is always non-empty on submit and stays genuinely mandatory rather than being satisfiable by a blank. **No edge-function change needed**: `mint-registration`'s validator applies only the required-presence check to a type it doesn't recognise, and `'N/A'` passes. Verified server-side — a submission omitting School returns `400 Missing required field: School`, and confirmed it created no row (still exactly 3 registrations).
  - `District(s) Served` removed; it was null for all three existing registrants, so nothing was lost.
  - ⚠️ **DATA QUESTION FOR JOSH — the three existing answers cannot be cleanly reinterpreted as "District".** They were collected under the old "School or District" label and are genuinely mixed: `JCPS-Atkinson` (district + school combined), `Fayette County` (a district), `Annapolis High School ` (a school, with a trailing space). All three now display under the **District** column with **School blank**. I did not guess or rewrite anyone's data. Options: leave as-is, correct them by hand, or ask those three for their school. Worth deciding before the roster goes to a partner, since the District column currently misrepresents two of the three.
- **2026-07-30 — Shareable read-only roster link (draft `3d62d51`) — ALL 5 ITEMS SHIPPED + deployed.** `lookup-roster` v1 deployed **with `verify_jwt: false` passed explicitly** (see the correction below — that parameter is the whole reason earlier deploys kept flipping the flag).
  - **Migration `roster_share_link_columns`** — seven `roster_share_*` columns on `event_registration_links` (one share link per registration link, decision 1), plus two brute-force columns the draft's rate-limit requirement needs. **No new RLS policy and no new GRANT, deliberately**: the browser never reads these; only the service-role function does. `roster_share_include_emails` defaults **false** (decision 2). The access code is **not** a column DEFAULT — that would bake `2112` into the schema; it's seeded by the admin UI so it stays out of the repo and is editable per link.
  - **Expiry (item 2)** — `default_roster_share_expiry()` returns earliest covered event + 1 day at 23:59:59 ET, computed once and **stored** so a later schedule edit can't silently move a partner's access. Verified against the real link: Session 1 `2026-10-27` → `2026-10-28 23:59:59 ET`. 90-day fallback if a link covers no events; never NULL.
  - **Edge function (item 3)** — `lookup-roster`, modelled on `lookup-registration`. **Went beyond the draft on one point:** it specifies a generic "not found" for an unknown token and a separate rejection for a bad code — but if those differ, an attacker can enumerate which tokens exist without ever knowing a code, which is exactly the probe the draft wants to prevent. Unknown token, wrong code and missing code now return **byte-identical 401s**. Revoked/expired only become distinguishable *after* the code is accepted. Constant-time code comparison; 5 failures → 15-minute lockout. Payload is built field by field.
  - **All 7 security properties verified live against the real AWARE link** (with two real registrants in it): (1) anon SELECT on `event_registrations` still `42501`; (2) no `cancel_token`, `id`, `registration_link_id`, `session_attendance_id`, `email_confirm`, `zoom_link` or any `roster_share_*` in the payload; (3) with emails off the response contains **no `@` character at all**; (4) 5 bad codes → even the CORRECT code returns 429; (5) revoked → generic 401 on a wrong code, friendly 403 on the right one; expired likewise; (6) regenerating replaces the token; (7) unknown vs revoked vs expired indistinguishable pre-auth. Form-field columns come from `form_schema`, never from iterating raw `responses` — which is what would have leaked the email via `email_confirm`.
  - **Public page (item 4)** — `/roster/:token`, code gate first, accepted code in **sessionStorage** only. `noindex, nofollow` meta injected per-route and removed on unmount (verified present). Read-only by construction; **CSV included** — built from the already-fetched payload, so it can't expose anything the page doesn't already show. Verified with real data: counts (2 registered / 297 capacity / 295 seats left), all 8 sessions with 12-hour ET times and years, correct field columns, "emails hidden" badge. At **360px**: no re-prompt, stacked cards, zero overflow.
  - **Admin UI (item 5)** — "Share" button on `/admin/registrations` whose label carries the state at a glance (`(live)` / `(emails on)` / `(revoked)`), opening a modal with the email checkbox, editable code prefilled `2112`, expiry prefilled from the rule, Copy link, Regenerate, Revoke/Un-revoke, and the view count + last-viewed. Writes go through the normal authenticated admin path; an update returning zero rows is surfaced as an error rather than looking like success.
  - **All test state removed** — zero `roster_share_token` values in the DB. Josh creates the real one from the modal.
  - ⚠️ **Not added to the CollaborativeDetail panel** (the draft said "if cheap"). Left out to keep this change contained; `/admin/registrations` has it and that's where link management lives.
- **2026-07-29 — Add-to-calendar links + public registration page branding (drafts `9281e80` + `493b106`) — code SHIPPED, ⏳ TWO DEPLOYS PENDING.**
  - ✅ **2026-07-30: `send-registration-email` DEPLOYED (v7).** The add-to-calendar links are live; every registration from 18:49 UTC onward gets them.
  - 🔴 **THE AWARE LINK IS LIVE AND HAS ITS FIRST REAL REGISTRANT.** `heather.cicchiellowright@jefferson.kyschools.us` registered **2026-07-30 17:39:30 UTC**, confirmation sent one second later — **70 minutes BEFORE the v7 deploy (18:49:29 UTC)**. So she received the OLD email: correct dates/times/heading (that was `bbd7adc`, already live), but with the "add them in one click" claim and **no add-to-calendar links**. Nobody else is affected; everyone after 18:49 gets v7. Josh's call whether that's worth a follow-up note to her — probably not, but he should know rather than discover it.
  - ⚠️ **Consequence for verification: I did NOT send any test email.** The only registration in the system now belongs to a real educator, and re-sending would put a duplicate confirmation in a participant's inbox. Josh's own test registration is gone. **The cleanest real-client test is Josh registering himself through the live form again** — that exercises the new registration page AND produces a v7 confirmation in his Outlook, then he can delete the row. Do not create a test registration on the real cohort link from a session: it pollutes a production roster and consumes one of the 297 seats.
  - ⏳ **STILL PENDING: deploy `send-event-reminder`** (A3 — calendar links + the "RSVP locally" copy fix). Deliberately deferred again rather than rushed: its deployed v3 already carries all the critical D3 fixes (registrants actually reached, the btoa crash, the Outlook treatment), and **no reminder cron fires until ~Oct 20**, so this is genuinely not urgent. Deploy it next session.
  - ⏳ **Original note — deploy both:** Both are committed, tested and pushed but **NOT deployed** — production still runs the previous versions, so none of the add-to-calendar work is live. I stopped deliberately rather than rush two ~25-30 KB deploys on a thin context budget: the MCP deploy tool requires re-emitting the whole source inline, and a transcription slip in participant-facing email code is worse than a delayed deploy. Deploy, then do the real sends below. ⚠️ Deploying flips `verify_jwt` back to `true` on both (Josh restored them in `9281e80` — thank you), so flip them off again after, or install the Supabase CLI, which removes this loop entirely.
  - **`fc94f1b` (A1 + A2)** — Per-event **Add to calendar** links (Google, then Outlook) as their own column in the registration email. Josh's finding: the multi-event `.ics` is unusable for participants — Gmail parses it, tries to build its own inline event card, and shows **"Unable to load event"** because those cards handle ONE event and ours carries eight; Outlook Web dead-ends the same way. The attachment stays (it works properly in Apple Mail and Outlook desktop) but is no longer the instruction. **A2's copy rewrite landed in this same commit** rather than its own — both edit the same template and I made the edits together, so the message only describes A1; noting it here rather than rewriting history. Copy now leads with the links and demotes the file to "or import the attached calendar file". Calendar column suppressed for **cancellation** (the draft's ask) **and waitlisted** — same principle Josh applied to reminders: no seat, so a calendar-add prompt reads as confirmation they're in. The `.ics` attachment's own condition was left untouched, so waitlisted still gets the file; that inconsistency is pre-existing and flagged rather than changed unasked. Took the draft's option **(a)** — no per-event `.ics` endpoint.
  - **Timezone work is the load-bearing part.** The deeplinks carry **absolute instants**, unlike the `.ics` which carries local time + TZID, and a wrong time still looks plausible in a calendar UI. Added `wallTimeToUtc()` (Intl offset probing + a refinement pass for transition edges), verified against Node's IANA data for all 8 real AWARE events **before** wiring it in: Oct 27 → `14:00Z` (EDT), Nov 10 onward → `15:00Z` (EST), each round-tripping back to 10:00 local; 1-hour calls span exactly 1 hour; a 2:30 AM spring-forward-gap time doesn't throw.
  - **`b646c76` (A3)** — Same links for the reminder email, **visually subordinate** to the RSVP buttons (asserted: buttons precede links in source order). Killed *"open it in Apple Calendar, Outlook, or Google Calendar to **RSVP locally**"* — actively misleading, since adding a calendar entry tells CTAC nothing. Replaced with an explicit "Adding it to your calendar does not tell us whether you're coming — please use the buttons above", in both HTML and text. No `VALARM`; that decision stands.
  - **`513ca37` (B4)** — `UK_Lockup-286.png` **3157 KB → 30.4 KB** (99% smaller), 1647×485 → 700×206, alpha preserved. Went to 700px rather than the draft's 500-600 because it isn't screen-only: `exportPdf.js` places it at 45mm, needing ~530px for 300 DPI print. Filename kept, so all **six** importers are untouched — this speeds up the whole public assessment flow and the auth pages too, not just registration.
  - **`e9e85dc` (B1-B3, B5)** — 🐞 **The event list was rendering NOTHING, and two other fields were silently missing.** Same root cause three times: anon can't SELECT the embedded table, and a failed PostgREST embed resolves to `null` with **no error**. (1) `bsc_events` needs an ACTIVE `session_link`, which no future session has → all 8 rows returned with `bsc_events: null` and the list was **empty**; (2) the `collaboratives(name)` embed also returned null, so the subtitle never appeared; (3) `program_type` likewise, so the program-aware heading this item asks for would have silently fallen back even after being built. **Pre-existing since the registration system shipped** (2026-05-08 added the tables but no anon read path for covered events) — *not* a regression from the July security pass; the `bsc_events` policy dates from 2026-04-11. Fixed with two token-scoped SECURITY DEFINER RPCs (`registration_link_events`, `registration_link_public`); the events one deliberately **excludes `zoom_link`** so it can't leak onto a public page even if the UI changes. Then the requested work: Session|Date|Time table, program-aware heading, 12-hour times with start+end and a TZ suffix that degrades to the raw IANA name rather than hardcoding "ET", years, CTAC/UK logos and the teal→navy gradient already used by `.team-code-container`, applied in `Shell` so **every** render state including the success screen carries them. Mobile: stacked cards below 560px instead of forcing a 3-column table to wrap — verified at 360px with zero overflow. Shared helpers moved to `programConfig.js` with the runtime-boundary duplication documented. `CancelRegistrationPage` got the same treatment, behaviour untouched.
  - ⏳ **Verification still owed (needs the deploys):** a real confirmation to **Gmail** and to Josh's Outlook. The draft is explicit that programmatic checks aren't sufficient here, and it's right — this defect was invisible to assertions *and* to a browser render. **I have no Gmail address to send to**, so that half is Josh's (register a Gmail address through the form, or forward). Also click one **EDT** (Oct 27) and one **EST** (Dec 1+) Google link and confirm each prefills 10:00 AM to 2:30 PM. Expect Gmail's "Unable to load event" card to **still appear** — that's Gmail reacting to the attachment, outside our control; the in-email links are the path that must work.
- **2026-07-29 — Reminder pipeline before the Oct 27 cohort (draft `aaccbbf`) — items 1-3 SHIPPED, item 4 is Josh's.** Deployed `send-event-reminder` v3 + 2 migrations. **Josh's two answers, implemented:** declined RSVPs are skipped for that event only, and waitlisted registrants get nothing.
  - **`4e3a9fd` (item 1)** — The `.ics` builder could kill an entire send. `btoa()` throws above U+00FF and `icsBase64` was computed **once before the recipient loop**, so one curly apostrophe or em dash in a title took down the reminder for *every* participant — on a cron nobody watches, for titles that now come from imported Word schedules. Also SUMMARY/LOCATION/DESCRIPTION were interpolated with no RFC-5545 escaping. Both back-ported from `send-registration-email`. **The worse half was the failure handling:** a throw meant no email *and* no `event_reminder_log` row, so the every-5-minutes `imminent-reminders` cron retried the same poisoned event forever, silently. The attachment is now best-effort — a build failure degrades to sending *without* the `.ics` and records why. Also persisted the `failed` count, which was computed and thrown away (migration adds `failed_count` + `notes`), so a send where 200 of 297 errored is no longer indistinguishable from a clean one. Applied the `3b350ad` `.ics` upgrades **selectively, deciding rather than assuming**: VTIMEZONE, ORGANIZER, CATEGORIES, X-WR-CALNAME and the program tag — but **not VALARM**, because a reminder email *is* the alarm and a day-before popup on an entry delivered an hour before the event is incoherent.
  - **`119884d` (item 2, the big one)** — Reminders reached team members only. Registrants aren't `user_profiles` rows, so they got their confirmation and then silence. AWARE has **0 teams**, so in October that was **zero reminders for the entire cohort** while the crons reported success. (Verified live: *every* collaborative has 0 active members, so this currently sends nothing anywhere.) Recipients are now the union of members + registrants whose link covers *this* event, deduped on lowercased email with the member record winning. Removed the `no_teams` early return — **that check was the bug**. Two hops to find registrants because `event_registrations` has no FK to `event_registration_link_events`. **Unsubscribe decision (draft asked me to choose and say):** registrants have no `unsubscribe_token` and the old footer interpolated it unconditionally, so they'd have got a dead `/unsubscribe/null`; they now get a "Cancel my registration" link from the `cancel_token` they already hold, rather than minting a second token system. **Scale:** replaced the serial loop with a bounded pool (concurrency 4) plus 429-aware retry, 5 attempts at 0.5/1/2/4s honouring `Retry-After`. Resend's batch endpoint was **not** used — it historically doesn't support attachments, and these carry the `.ics`. (Resend is on a paid plan per Josh's `CLAUDE.md` note, so headroom is better than the worst case I designed for.)
  - **`61087b8` (item 3)** — Outlook-first treatment carried across from `bbd7adc`: all px with explicit line-heights, no rem/em, no `h1`-`h6`, outer 100% table wrapping a fixed 600px table. **RSVP buttons converted to table cells with `bgcolor`** — they were padded `<a>` tags with `border-radius`, which Word can collapse into bare text, and they're the entire point of the email. 12-hour times with "to" (was `10:00–14:30`, 24-hour with an en dash) and the year added. `reminderHeadline()` no longer calls every event in every program a "Learning Session" — it uses the event's own title plus the program label, degrading cleanly for an unmapped `program_type`.
  - 🐞 **`0545f5b` — found by the draft's own verification step, and fixed beyond the four items: the RSVP page crashed for every future session.** The draft asked me to confirm `/rsvp/:token` renders for a null `user_id` row. It didn't render at all, for an unrelated reason: `RsvpPage` read its event through a PostgREST embed, but anon's only SELECT path on `bsc_events` requires an **active `session_link`**, which no future session has — so the embed silently returned `null` and the render dereferenced `event.event_date` → TypeError → white screen. Latent since May, invisible because reminders had never reached anyone. Shipping items 1-3 without this would have meant "reminders now reach 297 educators and every RSVP click lands on a blank page." Fixed with a token-scoped `lookup_rsvp()` SECURITY DEFINER RPC (same pattern as `validate_team_code` / `lookup-registration`; anon's `bsc_events` access **not** broadened), plus null guards, the year, and 12-hour times on the page. **A second bug I introduced and caught by testing:** the RPC names the id `rsvp_id` but the auto-persist still passed `r.id`, so `?status=attending` sent `undefined` into `.eq()` — breaking precisely the one-click path the email buttons use.
  - **Verification:** a harness drives the **real** `index.ts` (Deno/supabase-js/fetch shimmed, payloads captured, no mail sent) across 10 scenarios — **76 assertions pass**, covering today's zero-teams AWARE shape, member+registrant overlap deduping case-insensitively, waitlisted/cancelled exclusion, declined suppression, a title with curly apostrophe + em dash + comma still sending valid `.ics`, partial failures persisted, recovery after four sustained 429s, a permanent throttle correctly reported as failed, **297 recipients all delivered with concurrency provably capped at 4**, the idempotency guard, and the full Outlook rule set across all four reminder types. Then a **real send** on live data: 1 sent, 0 failed, `registrants: 1`, `members: 0`, calendar attached — the first reminder ever to reach a registrant. Used `reminder_type: 'custom'` deliberately so the log row couldn't suppress a genuine October cron reminder, and RSVP read/write/one-click/decline all verified in-browser with zero console errors. **All test state reset** — RSVP back to `no_response` (leaving `not_attending` would have made the real October reminders skip Josh under the new rule), test log row deleted, `event_reminder_log` back to 0 rows.
  - ⚠️ Deploying flipped `verify_jwt` to `true` on this function too, so **two** of nine are now `true`. Verified harmless — the crons authenticate with the service-role key, which is a valid project JWT — and both are in Josh's to-do list.
- **2026-07-29 — Edge functions into git + registration email/calendar overhaul (3 items, draft `81ef175`) — SHIPPED.**
  - **`fd1dfbd` (item 1)** — Snapshotted the 8 missing edge functions into `supabase/functions/<slug>/index.ts` verbatim (`send-event-email` v3, `send-event-reminder` v2, `mint-registration` v4, `send-registration-email` v4, `cancel-registration` v3, `send-trainer-digest` v2, `send-ceu-certificate` v3 tombstone, `lookup-registration` v2). **`invite-team-leader` diffed against deployed v9: byte-identical, no drift.** New "Edge functions" section in INFRASTRUCTURE.md + `supabase/functions/README.md` (three authorization patterns, deploy command, repo-is-source-of-truth). Verified every snapshot parses with esbuild's TS parser — where a transcription slip in a template literal/regex/escape would surface. **Two stated deviations:** (a) the draft wanted a per-file `--no-verify-jwt` header *and* byte-exact snapshots, which conflict — a header makes every future repo-vs-deployed diff show a permanent difference, defeating the stated reason for exactness, so the fact lives in the docs instead; (b) the draft says "9 of the 10 are not in the repo" — there are **9 deployed, 8 missing** (its own table lists 9 rows).
  - ⚠️ **Found while snapshotting, NOT fixed (item 1 was snapshot-only): `send-event-reminder` has both defects already fixed in `send-registration-email`.** It calls `btoa(ics)` directly and interpolates `event.title` / `event.location` into the `.ics` unescaped. Any event title with a curly apostrophe or em dash — i.e. anything imported from a Word schedule, which is now the normal path — will throw on `btoa` and **500 the entire cron reminder send for that event, silently**. The AWARE titles are currently plain ASCII so it isn't firing yet. Fix is a copy of the `utf8ToBase64` + `escIcsText` helpers; worth doing before the Oct 27 cohort.
  - **`bbd7adc` (item 2)** — Registration email template rebuilt Outlook-first. Root cause of "font size all over the place" was `px` mixed with `rem`/`em` plus unstyled `h2`/`h3`, and Outlook renders with the Word engine. Now **every** size is px with an explicit line-height (22/16/15/13/11), `<h2>/<h3>` replaced by styled `<p>` so Word has no defaults to apply, and the layout is an outer 100% table wrapping a fixed 600px table (`max-width` on a div doesn't survive Outlook). Event `<ul>` → **Session | Date | Time | Join** table. Times show **start AND end in 12-hour** ("10:00 AM to 2:30 PM"), so a 4.5-hour learning session no longer looks like a 1-hour call; parsed off the time string so no timezone can enter. Dates carry the **year** ("Tue, Oct 27, 2026") with the formatter pinned to UTC. Heading is program-aware ("TIPE Learning Collaborative Events") via a `program_type` map kept **inside** the function, falling back to "Events covered". All four kinds treated alike; text alternative in sync. **Fixed in passing:** the text alternative built blank lines as `''` then ran `.filter(Boolean)`, stripping every one — the plain-text version has always arrived as one dense block. **One deviation:** used a real data table with `<th scope="col">` instead of the draft's `role="presentation"` — this is genuine tabular data and that role hides the columns from screen readers; Outlook-safety comes from the cellpadding/cellspacing/border attributes and inline px styles, not the role.
  - **`3b350ad` (item 3)** — `.ics` upgraded: two `VALARM`s per event (`-P1D`, `-PT15M`, `ACTION:DISPLAY` + descriptions — there were none, so these landed silently on calendars), `ORGANIZER;CN=UK CTAC`, `SUMMARY` prefixed with the short program tag ("TIPE LC: Learning Session 1"), real `VTIMEZONE` for America/New_York as **RRULEs** (DST 2nd Sun Mar → 1st Sun Nov) not a fixed offset, `X-WR-CALNAME`, `CATEGORIES`. **`METHOD:PUBLISH` deliberately kept** with the reasoning in a code comment. `UID` untouched so re-import updates rather than duplicates. **Not done, deliberately:** RFC-5545 75-octet line folding — DESCRIPTION lines already exceeded 75 in the `.ics` Josh successfully imported, so unfolded is empirically fine, and a folding bug would corrupt every entry.
  - **Verification approach worth reusing:** a harness loads the **actual** `index.ts`, shims Deno/supabase-js/fetch, feeds it the real AWARE data and captures the Resend payload — so the assertions test the shipped code, not a reimplementation. **50 checks pass** (no rem/em, no h1-h6, no ul/li, every font-size paired with a line-height, 4 headers + 8 rows, year present, both times, no 24-hour leak, text alt in sync, `.ics` on confirmation but not cancellation; then CRLF, METHOD:PUBLISH and no REQUEST, one VTIMEZONE with both EDT/EST, 8 VEVENTs, ORGANIZER + CATEGORIES on each, 16 VALARMs, tagged SUMMARYs, 8 unique unchanged UIDs, balanced BEGIN/END). Separately checked the DST rules against **Node's IANA tzdata** for all 8 real dates — they agree, and the boundary really does land inside the cohort: Oct 27 = EDT (-0400), Nov 10 onward = EST (-0500). Deployed v5 and **sent for real** to Josh's address: 200, `confirmation_sent_at` stamped. **Josh's part:** open it in Outlook and import the `.ics` (Outlook is the primary target and a browser render proves nothing about the Word engine).
  - ⚠️ **New operational gotcha, now in INFRASTRUCTURE.md: deploying via the Supabase MCP tool silently sets `verify_jwt = true`** and defaults its `verify_jwt` parameter to `true`, so any deploy that does not explicitly pass `false` flips it (corrected 2026-07-29). `send-registration-email` is now the only one of nine that's `true`. Verified harmless — every caller presents a valid JWT, and the live send after the flip worked — and it isn't a real security gain either, since the legacy anon key is public and satisfies the gateway. Added to Josh's dashboard to-do; the Supabase CLI is **not installed** on the machine (checked), which is why deploys go through MCP at all.
- **2026-07-29 — Registration link duplicate-save bug + delete affordance (2 items, draft `574531d`) — SHIPPED.**
  - **`036061e` (item 1)** — `RegistrationLinkModal.handleSave()` branched on the `editingLink` **prop**, which is only set when opening an existing link from the table. Creating a link leaves the new row in the `savedLink` **state** while the modal deliberately stays open to show the share URL — so every later Save re-entered the insert branch and minted another link with a new id/token plus duplicate `link_events`. That is exactly Josh's three identical AWARE links 14s apart. Now branches on `const target = editingLink || savedLink` for both the update-vs-insert decision and the capacity-decrease guard. Covered events changed from delete-then-insert to a **diff** (insert only missing, delete only removed), which also closes the pre-existing window where a failure after the delete left the link covering **zero** events, and makes a no-change re-save a genuine no-op (verified: 0 writes). Added a `savingRef` guard because `disabled={saving}` — which the draft assumed was missing but was already there — depends on a re-render.
  - **`bbf1227` (item 2)** — Delete action on `/admin/registrations` and the CollaborativeDetail Registrations panel, shared via `utils/registrationLinks.js`. Guarded because **both** child tables cascade (verified `confdeltype = 'c'` on `event_registration_link_events` *and* `event_registrations`): 0 registrations → confirm naming the title; **1+ of any status including cancelled** → disabled with a tooltip giving the count and pointing at Edit → uncheck "Registration is open". The rendered state uses list counts but the click handler **re-counts server-side**, so a registration arriving while the table sits open still blocks. Tooltip sits on a wrapping `<span>` because Chrome/Safari swallow hover on a disabled control. The delete does `.select('id')` and treats an empty result as an error — an RLS-refused delete returns 200 with zero rows and no error, which would otherwise look like success. **Server-side authorization verified with a throwaway probe link:** anon → `401/42501` at the grant layer, authenticated non-admin → **0 rows, no error**, super_admin → 1 row. Per the draft, Josh's type-the-word-DELETE idea is deliberately **not** implemented — links with registrants aren't deletable at all, so the friction has nothing to protect.
  - Also confirmed: Josh has set that link's `capacity = 297`, so the waitlist to-do the draft flagged is done. ⚠️ **`test@uky.edu` / `1234` no longer authenticates** (`invalid_credentials`, and no non-super_admin rows exist in `user_profiles` after the rebuild) — `CLAUDE.md` still documents it as a live test account. Admin-gated UI click-through stayed with Josh for this reason.
- **2026-07-29 — Security hardening pass from the Advisor WARN triage (`52b7da1` + 4 migrations).** Advisor security findings **59 → 40**; nothing at ERROR level. Two categories fully cleared (`security_definer_view` 5→0, `function_search_path_mutable` 8→0).
  - **Team-code enumeration closed** (the big one). The policy *named* "Allow anonymous to validate team codes" had predicate `(active AND not expired)` — that permits **listing** every active code, not validating one; anon read all 26 including the 4 real CTAC staff codes, and a code is the only credential needed to submit an assessment. New `validate_team_code(code)` SECURITY DEFINER RPC returns just the one code's `id/code/timepoint/program_type` and enforces active + not-expired (the old query never even checked expiry). `TeamCodeEntry` uses it; `Demographics` now takes timepoint from validation-time localStorage (with a re-validate fallback for in-flight sessions); `sts_timepoint` added to the cleanup keys. The `assessment_responses` INSERT policy was switched to a `team_code_is_valid(uuid)` SECURITY DEFINER helper **first**, because policy expressions are subject to the caller's table privileges and would have silently stopped evaluating once anon lost SELECT. Frontend shipped before the revoke. Verified: enumeration → `42501`, validation still works, expired/bogus codes return 0 rows, full respondent flow (insert AR → demographics → completion flag → STSS) passes, and an insert with a bogus `team_code_id` is still refused.
  - **Blast radius of the three always-true UPDATE policies cut via column-level grants.** With a fully anonymous flow and no per-respondent secret, RLS *cannot* scope these rows — so rather than loosen or remove policies, anon's UPDATE is now restricted to exactly the columns the public pages write: `assessment_responses` → the completion flags + `completed_at`; `session_attendance` → `signed_out_at`/`sign_out_method`/`evaluation_completed_at`; `event_rsvps` → `status`. Column lists verified against every `.update()` call site. anon can no longer rewrite `team_code_id`, `timepoint`, `program_type`, `attendee_email`, `team_id` or `is_matched` — which was the actual research-integrity and CEU-forgery risk. Verified both directions: allowed columns 204, forbidden columns 401. ⚠️ **These three still appear in the advisor** — the lint reads the policy predicate, not the grants. Accepted, not overlooked. `authenticated` left as-is (requires a real account in a closed system; admin paths are scoped by `is_admin_for_collaborative`).
  - **Privileged functions no longer callable from the browser.** `close_expired_sessions()` took **no arguments**, so anyone with the publishable key could close every active sign-in session mid-event; the four `fire_*` dispatchers could trigger email/burn Resend quota. Revoked from `PUBLIC`, `anon`, `authenticated` on those five plus `cancel_registration_and_promote` (re-granted to `service_role` for the edge function), `rls_auto_enable`, and `get_self_rating_completion_stats` (re-granted to `authenticated`). **Gotcha caught by testing:** the first migration revoked only from anon/authenticated and was a complete no-op — Postgres grants EXECUTE to `PUBLIC` by default and those roles inherit it. `close_expired_sessions` still returned 204 (it ran) until `FROM PUBLIC` was added. All 5 crons run as `postgres`, which owns the functions, so they keep working (verified).
  - **`search_path` pinned** on all 8 flagged functions (incl. the rewritten `sign_in_to_session`).
  - **Deliberately left:** the ~10 always-true **INSERT** policies on the instrument tables (correct by design — anonymous respondents must submit, and anon has INSERT-only with no SELECT so submissions can't be scraped; the duplicate policy pairs are cosmetic); the remaining anon/authenticated-executable SECURITY DEFINER functions (the RLS helpers `is_super_admin`/`is_admin_for_collaborative`/`user_team_id`/`user_collaborative_id`/`user_admin_collaborative_ids`/`profile_is_trainer_admin` are evaluated inside policy expressions — revoking EXECUTE would break admin access; `sign_in_to_session`/`validate_team_code`/`team_code_is_valid`/`event_collab_is_demo` are intentionally public); `pg_net` in public (the crons depend on it, moving it is riskier than the warning).
  - **Josh's one remaining item:** `auth_leaked_password_protection` — dashboard toggle (Auth → Passwords → HaveIBeenPwned). Also still worth **rotating the 4 CTAC staff codes** before distribution, since they were publicly readable before today.
- **2026-07-29 (migration + docs)** — Dropped five **SECURITY DEFINER views** flagged by the Supabase Advisor: `team_completion_status`, `team_demographics_summary`, `team_stss_aggregates`, `team_proqol_aggregates`, `team_stsioa_aggregates`. All were owned by `postgres` with `security_invoker` unset and had `anon` SELECT, so they bypassed RLS. Verified with the publishable key before the fix: `team_completion_status` returned **200 with 26 rows including every `team_codes.code` in plaintext** (codes are the only credential needed to submit an assessment); the other four leaked per-team STSS/ProQOL/STSI-OA/demographic aggregates, bypassing team-scoping RLS plus the k-anonymity and publish-gating the app enforces elsewhere. Safe to drop — zero references in `frontend/src`; they were vestigial (`team_proqol_aggregates` still averaged the CS/STS subscales removed in `913a076`/`ae1fd09`). Definitions preserved in the migration comment for recreation (`security_invoker = on`, no anon grant). Verified after: 0 views in `public`, all five 404 to anon. `frontend/README.md` updated (it had documented them).
  - ⚠️ **Follow-up this exposed — `team_codes` is still anon-enumerable.** Dropping the views closed one window, not the door: the policy *named* "Allow anonymous to validate team codes" has predicate `active = true AND (expires_at IS NULL OR expires_at > now())`, which permits **listing every active code**, not just validating one that was typed. Confirmed: anon reads all 26 codes directly from `team_codes`, including all 4 real CTAC staff codes. No PII in that table — the risk is (a) fake/poisoned assessment submissions and (b) codes being discoverable before Josh distributes them. Codes are low-entropy shared secrets by design, so this is hardening rather than an emergency. **Fix is not a one-liner:** it needs a `validate_team_code(code)` SECURITY DEFINER RPC + repointing `TeamCodeEntry`, AND the `assessment_responses` anon-INSERT policy references `team_codes` in its predicate — so revoking anon's SELECT without first moving that check into a SECURITY DEFINER helper would break anonymous assessment submission (the app's highest-stakes path). Queued rather than rushed.
- **2026-07-17 — 🔴 Registration hardening round 2 (4 items, draft `44b183f`) — SHIPPED.** All three defects the draft cited were confirmed live before changing anything.
  - **`742d479` + migrations (item 1, SECURITY)** — `event_registrations` was world-readable **and world-writable**: two policies whose names claimed cancel-token scoping had `qual = true`, and `anon` held SELECT/INSERT/UPDATE/DELETE. New **`lookup-registration`** edge function (service role, token-scoped) returns only what the cancel page renders (full_name, email, status, link title, collaborative name — no ids, no `responses` jsonb, no token echo); `CancelRegistrationPage` reads through it, shipped **before** the policy drop. Then dropped both public policies and revoked anon's SELECT/INSERT/UPDATE/DELETE on `event_registrations`, plus anon's write grants on `event_registration_links` / `event_registration_link_events`. **Verified with the publishable key:** read *and* write on `event_registrations` now return `42501 permission denied` (a real privilege error, so it holds once rows exist — not merely "0 rows"), while links + link_events stay readable so `RegisterPage` still works. ⚠️ **Still open (as the draft noted):** link-token enumeration remains possible via the public SELECT on `event_registration_links`. Also `anon` retains the Supabase-default REFERENCES/TRIGGER/TRUNCATE grants, which PostgREST cannot reach.
  - **`1040707` + migration (item 2)** — QR check-in never fired. The embed `event_registration_link_events!inner(...)` can't resolve (confirmed via `pg_constraint`: no FK between `event_registrations` and `event_registration_link_events` — both point *to* `event_registration_links`), the request errored, and only `data` was destructured so the error vanished. **Deviated from the draft's fix on purpose:** its two-step *browser* query would now hit 42501 because of item 1, so the linkage moved into the `sign_in_to_session` RPC (SECURITY DEFINER) — atomic with the attendance insert, no anon privileges, can't fail silently. Signature reproduced exactly (verified still exactly one overload, no repeat of the earlier overload bug). Email matching is now `=` not `ilike` here and in `mint-registration`'s dedupe (`_`/`%` are LIKE wildcards). **Verified end to end on live data:** registered via `mint-registration`, signed in through the RPC with the same address in UPPERCASE → row flipped `registered` → `checked_in`, `checked_in_at` stamped, `session_attendance_id` pointing at the new attendance row. All test data removed (back to 0 rows).
  - **(item 3 — edge functions only, no repo files)** — `send-registration-email` v3: `btoa(buildIcs(...))` throws `DOMException: Invalid character` on any code point above U+00FF, so a curly apostrophe or em dash in an event **title/location** meant a 500 and **no email at all** (verified in node; now UTF-8-safe + chunked). This got *more* likely with the schedule importer, since titles now come straight from Word. Also added RFC-5545 escaping of `\ ; ,` and newlines in `.ics` TEXT values (an unescaped comma in a title would corrupt the entry) — slightly beyond the draft, flagged deliberately. `mint-registration` v3 + `cancel-registration` v2 now **await** the send and log failures instead of `fetch(...).catch(() => {})`, since a Deno isolate can be torn down before an un-awaited fetch leaves; a failed email still never blocks the registration. Noted, not built: cancellation sends still don't stamp `confirmation_sent_at`, so there's no "not sent" signal for them.
  - **`344f237` (item 4)** — admin Promote now POSTs `kind:'promoted'` (previously the person was never told a spot opened, unlike auto-promotion) and warns — without blocking — when promoting would exceed capacity. The discarded UPDATE error is now checked.
  - ✅ **BLOCKER FOUND AND RESOLVED same day.** Josh set a fresh `RESEND_API_KEY` in the edge-function secrets, and the email pipeline is now **verified end to end**: registered a throwaway registration against an event whose title carried a curly apostrophe, em dash AND comma (`Learning Session 1 — Trauma’s Impact, Part 1`) with real start/end times so the `.ics` was actually built → Resend accepted and `confirmation_sent_at` was stamped, which only happens after a successful send. That single result proves the key works, the `no-reply@ctac.app` sender domain is verified in Resend, and the UTF-8 base64 + RFC-5545 escaping fixes hold (the old `btoa` would have thrown → 500 → no stamp). All test data removed and the event restored exactly (title/times/location back to original); registration tables back to 0 rows. Original finding, for the record: `RESEND_API_KEY` was **not configured** in the edge-function environment — `send-registration-email` returns `500 {"error":"RESEND_API_KEY not configured"}`. **No app email can send at all**: registration confirmations/cancellations/promotions, the pg_cron event reminders (`send-event-reminder` is also 500ing), "email all participants", and the weekly trainer digest. Auth invites are unaffected (separate Supabase Auth SMTP, which is why invites have worked). Ironically item 3's awaited-send is what surfaced this — the old fire-and-forget swallowed it. **Fix:** set `RESEND_API_KEY` in Supabase → Edge Functions → Secrets (Josh handles the key; it must not pass through chat), then a registration send can be re-verified end to end. Until then the draft's "confirm the email arrives with a working .ics" check cannot be completed.
- **2026-07-17 — Collaborative-creation usability batch (4 items, draft `a1f07ea`), one commit each.** Unblocks creating the first REAL cohort (TIPE LC starting 10/27/26).
  - **`ba07e6a` (item 3)** — Schedule document import. New `utils/scheduleParser.js` (pure/DOM-free): MM/DD/YY + MM/DD/YYYY (2000-based, handles the year boundary 10/27/26→01/26/27), time ranges tolerating `-`/en dash/em dash/"to" + `A.M.`/12am/12pm + inferred missing start meridiem + 24h fallback, `learning session`→`learning_session` / contains `call`→`all_team_call` / else **reported not guessed**, footnote markers stripped, date-less lines (headers/prose/footnotes) ignored, document's own labels used as titles (composes with item 1). `.docx` drop zone + browse via **mammoth** (new dep, **dynamic import** so its ~500kB is a lazy chunk, not the main bundle) and an "or paste your schedule" textarea running the same parser (covers PDF/email/Excel). **Never auto-applies:** preview table + explicit skipped-row reasons + Confirm, and warns if Confirm would overwrite already-typed rows; unreadable input fails soft and leaves data untouched. **Verified with node:** the real AWARE 3 Year 4 table → all 8 rows exact; 24 edge cases pass; a generated `.docx` round-trips docx→mammoth→parser to the same 8 rows.
  - **`a940a11` (item 4)** — Per-program registration fields moved from the hardcoded `SEEDED_SCHEMA` into `programConfig.js` (`registrationFields`, with `branding.registrationFields || SEEDED_SCHEMA` fallback). Shared `REGISTRATION_SYSTEM_FIELDS` keeps `full_name`/`email`/`email_confirm` universal. **Labels vary, keys don't** — TIPE's "School or District" is still key `agency`, "Position or Title" still `role`, plus optional `districts` + `grade_levels`; sts_bsc/tic_lc wording unchanged. TIPE also gets schools-flavored `registrationFieldPresets` (others fall back to the shared list). New `programType` prop from CollaborativeDetail + RegistrationsAdmin. **Existing links unaffected** (each stores its own `form_schema` snapshot, which editing always prefers; also 0 links exist right now post-rebuild). Verified resolved schemas per program.
  - **`9d285d0` (item 2)** — Drag-to-reorder schedule rows (HTML5, no new dep). Row is draggable only while its `≡` handle is held so date/time inputs stay interactive; dragged row dims, drop target shows a teal rule; ↑/↓ added as keyboard fallback. `sequence_number` recomputed **within** each `event_type` (never across), added rows stay null — verified against the real TIPE shape (interleaving the 3 calls yields LS 1-5 / calls 1-3). **Downstream effect (draft asked):** row ORDER has none — every `bsc_events` query in the app orders by `event_date`. ⚠️ But `sequence_number` itself **is** read downstream (`utils/phaseCalculator.js` sorts learning sessions by it, as do this modal's assessment-window anchors), so arranging rows non-chronologically would make seq disagree with dates. Arranging them to match the real (chronological) schedule — the actual use case — keeps everything consistent. Possible follow-up: anchor the windows on dates instead of seq.
  - **`c60f7c2` (item 1)** — Pre-populated (locked) event titles are now editable inputs, so "Learning Call 1" can become "Implementation Session 1 (call)" at creation. Title-only: no event_type dropdown/location for locked rows, `sequence_number` untouched, so assessment windows still auto-calculate. Note: the draft described locked rows as having "no remove" — they actually do render an × today; left as-is since the change was scoped to titles.
- **2026-07-17 `2d4793a`** — Staff/team-leader login link on the public code-entry page (Anchor Lab item 5, urgent; draft `a291716`). The public root (`TeamCodeEntry`) had no path to `/login`, so testers following a review guide pointed at the bare domain dead-ended on code entry. Added a muted "CTAC staff or team leader? Log in here" link below the card → `/login`. Verified in-browser: renders on `/`, click lands on the login form. Placement is unobtrusive so it doesn't distract assessment respondents; permanently correct for real users too.
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

**✅ BOTH QUEUED DRAFTS SHIPPED 2026-07-17** (collaborative-creation usability + registration hardening round 2 — see Recently shipped). The `RESEND_API_KEY` blocker found during that work was **resolved the same day** — Josh set the secret and the email pipeline is verified end to end. Registration is now safe to use with real registrants. Superseded queue note follows:

**READY (3 drafts queued at the bottom of this file):**
1. **Restyle the evaluation PDF to the CTAC house format** — spec'd from the **generating source** (`Training Manager/ctac_reports.py` + `CTAC_Report_Style_Guide.md`), so exact colors, type scale, column widths and fills. Gaps: no page furniture, no `n` column, no NPS block, Qualtrics `Q51 -` labels, unnumbered verbatim comments.
2. **Evaluation scale direction + contradiction flagging (2 items)** — two of 41 real respondents rated all six items `1` while writing glowing comments AND scoring 10 on recommend. The scale IS labelled, so the fix is layout: the 5-button row **wraps on a 360px phone** (5 × 80px minWidth), destroying the left-to-right axis. Plus a verified rules-based flag (all items ≤2 AND NPS ≥9) that catches exactly those 2 rows with **zero false positives**.
3. **Close the last always-true anon UPDATE + fix collaborative session-link expiry (2 items).** Eval-completion stamp must move to an RPC *before* dropping the `USING (true)` anon policy; and `generateSessionLink` hardcodes `4PM EST = 9PM UTC` — **AWARE Session 1 (2026-10-27) is in EDT.**

⬜ **Still unverified from an earlier batch:** none of the 5 repaired PDF exports has been clicked in a browser. That bug survived *because* nobody clicked.

_Cowork also deleted the standalone training's test data (4 attendance + 3 evaluations) — verified 0 remaining, event intact for 2026-08-07._

_(Shipped 2026-07-29/30: add-to-calendar links `fc94f1b`/`b646c76`; registration page branding + asset optimization `513ca37`/`e9e85dc`; shareable roster link `5916b90`; TIPE District/School fields `c1b0393`.)_

**✅ SHIPPED: Reminder pipeline before the Oct 27 cohort** (items 1-3 shipped `4e3a9fd`/`119884d`/`61087b8`, plus `0545f5b` for the RSVP page crash the verification step uncovered; **item 4, the test accounts, is still Josh's**). ⚠️ Headline finding: **automated reminders never reach registrants** — recipients resolve from team members only, and the real AWARE cohort has 0 teams, so the crons would report success while sending zero email to 297 registered educators. Also back-ports the `btoa` + RFC-5545 `.ics` fixes that `send-event-reminder` never received (cron-driven, so one curly apostrophe silently kills every reminder for an event), applies the Outlook-first email treatment, and restores non-super_admin test accounts so Claude Code can click-through verify again.

_(Earlier drafts, all shipped: collaborative-creation usability `a1f07ea`; registration hardening round 2 `44b183f`; duplicate-save + delete `574531d`; edge functions into git + email/calendar overhaul `81ef175`.)_

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

#### Item 5 (added 2026-07-17, URGENT, ship first): staff login link on the team-code entry page — ✅ SHIPPED `2d4793a`

The public root (`/`, TeamCodeEntry) currently has no path to `/login` at all. The Anchor Lab testers were just sent review guides whose login line points at the bare domain, so anyone who follows it dead-ends on the code-entry page. Add a small, unobtrusive "CTAC staff or team leader? Log in here" link on TeamCodeEntry that routes to `/login`. Placement: below the code-entry card, muted styling (small text, `--text-muted`), so it does not distract assessment respondents. This is also permanently correct: real users will always type the bare domain.

---

### 2026-07-17: Collaborative-creation usability batch (4 items) — ✅ SHIPPED (c60f7c2, 9d285d0, ba07e6a, a940a11) — spec kept for reference

> **Why now:** the first REAL cohort goes into the app next: a **TIPE LC starting 10/27/26** (AWARE 3 Year 4), with registration needing to open ASAP. Josh hit these while preparing to create it. Items 1 and 2 are small and unblock him today; items 3 and 4 are the bigger wins. All four are in/around `CreateCollaborativeModal.jsx` + `programConfig.js`. One commit per item.
>
> **Real-world target schedule** (drives items 1 to 3; all virtual, Tuesdays):
>
> | Session Type | Date | Time (ET) |
> |---|---|---|
> | Learning Session 1 | 10/27/26 | 10:00 am - 2:30 pm |
> | Learning Session 2 | 11/10/26 | 10:00 am - 2:30 pm |
> | Implementation Session 1 (call) | 11/17/26 | 10:00 am - 11:00 am |
> | Learning Session 3 | 12/01/26 | 10:00 am - 2:30 pm |
> | Implementation Session 2 (call) | 12/08/26 | 10:00 am - 11:00 am |
> | Learning Session 4 | 01/05/27 | 10:00 am - 2:30 pm |
> | Implementation Session 3 (call) | 01/12/27 | 10:00 am - 11:00 am |
> | Learning Session 5 | 01/26/27 | 10:00 am - 2:30 pm |
>
> Note this is the shape TIPE actually uses: CTAC calls the calls **"Implementation Session N (call)"**, not the app's default "Learning Call N", and the sessions and calls **interleave** rather than being grouped by type. That is the gap items 1 and 2 close.

#### Item 1: Let the pre-populated (locked) events be renamed

In the BSC Schedule section, locked default events render their title as a static `<span>` (around line 456), so there is no way to change "Learning Call 1" to "Implementation Session 1 (call)" at creation time.

- Make the title an editable text input for **every** event row, locked or not.
- Keep the rest of the "locked" semantics as-is (no event_type dropdown, no remove for locked rows, teal border) — this change is title-only.
- Renaming must not disturb `sequence_number`, the auto-title logic for newly added events, or the assessment-window calculation (which keys off `event_type === 'learning_session'` dates, not titles). Verify the windows still auto-calculate after a rename.

#### Item 2: Drag to reorder the schedule rows

Purely a creation-time convenience: Josh wants to drag rows so the list he is typing into matches the order on the real schedule document (interleaved sessions and calls). **He does NOT expect reordering to change any downstream behavior** and is not going to revisit the order later; everything downstream orders by `event_date`.

- Add drag-and-drop reordering of the `bscEvents` array (HTML5 drag events are fine; no new dependency needed for a list this small).
- Keep the existing ↑ ↓ affordance if it is cheaper to add alongside than to replace, but drag is the ask.
- On reorder, recompute `sequence_number` within each `event_type` group so "Learning Session N" numbering stays consistent with visual order. Do NOT renumber across types.
- Confirm in your ship summary whether reordering has any effect at all outside the modal (expected answer: none).

#### Item 3: Upload a schedule document to pre-fill the dates

The biggest time saver. CTAC schedules arrive as Word docs shaped like the table above (see `AWARE 3 YEAR 4 Proposed Schedule_June 2026.docx`, the reference test case).

- Add a drop zone in the BSC Schedule section: **"Drop a schedule document here to fill in dates"**, accepting `.docx`.
- Parse client-side with **`mammoth`** (new frontend dependency) to extract the document's table rows.
- Also add a **"or paste your schedule" textarea** running the same parser on tab/pipe/multi-space-separated text. This costs little and covers PDFs, emails, and Excel, which the docx path cannot.
- Parsing rules for a row: session-type label, date, time range.
  - Dates: handle `MM/DD/YY` and `MM/DD/YYYY` (note this schedule crosses a year boundary: `10/27/26` through `01/26/27`).
  - Times: `10:00 am - 2:30 pm` into `start_time` + `end_time`; tolerate en dash, em dash, and "to".
  - Event type: label containing "learning session" maps to `learning_session`; a label containing "call" (e.g. "Implementation Session 1 (call)") maps to `all_team_call`. Otherwise leave unmatched rather than guessing.
  - Strip leading footnote markers (`*Learning Session 5`) from titles and ignore prose lines outside the table (e.g. the "*Learning Session 5 will include..." footnote).
  - **Use the document's own labels as the event titles**, so this composes with item 1.
- **Never auto-apply.** Show a preview table of parsed rows: title, mapped event type, date, start, end, plus any row it could not interpret, and require an explicit **Confirm** click before the schedule fields are populated. Confirm replaces the default rows with the parsed ones (all editable afterward).
- Fail soft: an unreadable or unexpected document shows "Could not read a schedule from this file, please enter the dates manually" and leaves the defaults untouched. Never throw away data the user already typed without warning.

#### Item 4: Per-program default registration fields

`SEEDED_SCHEMA` is hardcoded in `RegistrationLinkModal.jsx` (Name, Email, Confirm Email, Agency, Role at agency) for every program. Move it into `programConfig.js` as per-program config, matching how `defaultEvents` / `goalFields` / `addEventDefault` already work.

- Add `registrationFields` to each program's branding; the modal uses `branding.registrationFields || SEEDED_SCHEMA` so anything unconfigured keeps today's behavior.
- **Keep the three system fields universal**: `full_name`, `email`, `email_confirm` (email_confirm's `matches: 'email'`, and the denormalized email/full_name columns, depend on them).
- **CRITICAL: vary labels, not keys.** Where semantics match, reuse the canonical keys so exports, rosters, and anything reading `agency` stay consistent across programs. TIPE's "School or District" field is still `key: 'agency'`; "Position or Title" is still `key: 'role'`. Do not fork the data model per program.
- **TIPE LC defaults (confirmed by Josh):** Name, Email, Confirm Email, School or District (`agency`, required), Position or Title (`role`, required), District(s) Served (`districts`, optional), Grade Level(s) (`grade_levels`, optional).
- **sts_bsc and tic_lc keep the current five** (Agency / Role at agency wording unchanged).
- Optionally scope `COMMON_FIELD_PRESETS` per program too (schools-flavored presets for TIPE); keep the shared list as the fallback.
- Existing links are unaffected because each link stores its own `form_schema` snapshot; confirm that in your ship summary.

**Out of scope for this batch:** drag support in the registration field list (arrows work; Josh is fine), and readable keys for custom fields (currently `custom_<base36>`, which makes CSV export headers cryptic — worth a future item if it bites).

---

### 2026-07-17: Registration hardening round 2 — ✅ SHIPPED (742d479, 1040707, 344f237 + edge fn deploys + 2 migrations); ⚠️ email still blocked on RESEND_API_KEY — spec kept for reference

> **Why:** the registration system has **never run end to end against real data** (verified live: `event_registration_links`, `event_registration_link_events`, `event_registrations`, and `session_attendance` are all **0 rows**). The TIPE LC starting **10/27/26** will be the first real use, collecting **names, emails, schools, and districts from real educators**. A code trace surfaced three defects that a live cohort would hit immediately. Item 1 is a data-exposure bug and is the priority. Nothing is exposed today only because the tables are empty.
>
> Items are independent; one commit each. Order as written.

#### Item 1: 🔴 SECURITY — `event_registrations` is world-readable and world-writable

**Verified live via `pg_policies` and `information_schema.role_table_grants`.** Two policies whose *names* claim token scoping have predicates of literally `true`:

| policy | cmd | roles | qual | with_check |
|---|---|---|---|---|
| `Public can read registration by cancel token` | SELECT | public | `true` | — |
| `Public can update registration by cancel token` | UPDATE | public | `true` | `true` |

`anon` also holds full `SELECT, INSERT, UPDATE, DELETE` on the table. Since the publishable key ships in the client bundle, **anyone can read every registrant's name, email, and full `responses` jsonb across every collaborative, harvest every `cancel_token`, and modify arbitrary rows** (status, waitlist_position, email). `event_registration_links` likewise has unconditional public SELECT, which lets anyone enumerate every link token in the system.

**Fix (preferred): stop reading this table from the browser at all.** The cancel *write* already routes through the `cancel-registration` edge function; the only reason for a public policy is `CancelRegistrationPage.jsx`'s initial read of the row by `cancel_token`.

1. Add a small edge function (e.g. `lookup-registration`) that takes a `cancel_token`, and with the service role returns ONLY what the page renders: `full_name`, `email`, `status`, link `title`, collaborative `name`. No jsonb blob, no ids.
2. Point `CancelRegistrationPage.jsx` at it.
3. Then **DROP both public policies** on `event_registrations` and `REVOKE` anon's write privileges:
   - `DROP POLICY "Public can read registration by cancel token" ON public.event_registrations;`
   - `DROP POLICY "Public can update registration by cancel token" ON public.event_registrations;`
   - `REVOKE INSERT, UPDATE, DELETE ON public.event_registrations FROM anon;` (inserts come from `mint-registration` via service role, so anon needs nothing)
   - Keep the `Admins manage registrations` policy exactly as-is (it is correctly scoped via `is_admin_for_collaborative`).
4. `event_registration_links`: the public SELECT is load-bearing (`RegisterPage.jsx` reads the link by token with the anon key) so it can stay for now, but **narrow the grants** — `REVOKE INSERT, UPDATE, DELETE ... FROM anon` — and note in the ship summary that token enumeration remains possible. If it is cheap, restrict the public SELECT to non-sensitive columns via a view.

**If the edge-function route balloons**, the acceptable interim is a genuinely token-scoped policy rather than `true`, plus the same REVOKEs. Do not leave `qual = true` in place either way. **Verify after:** re-run the `pg_policies` query and confirm, with the publishable key, that an unauthenticated `select *` on `event_registrations` returns no rows.

#### Item 2: QR check-in silently never links a registration to attendance

`SessionSignIn.jsx` (~lines 115-137) tries to find a matching registration with a PostgREST embed:

```js
.from('event_registrations')
.select('id, status, registration_link_id, event_registration_link_events!inner(event_id)')
.eq('event_registration_link_events.event_id', eventInfo.id)
```

**There is no foreign key between `event_registrations` and `event_registration_link_events`** (confirmed via `pg_constraint`: both tables point *to* `event_registration_links`, which is not an embeddable relationship). PostgREST cannot resolve it, the request errors, and the code destructures only `data` — the `error` is discarded, so nothing is logged and the surrounding `try/catch` never fires. Net effect: **no registration ever becomes `checked_in`**, `checked_in_at` and `session_attendance_id` stay NULL forever, and the roster's "Checked in" filter plus the CSV's "Checked In At" column are permanently empty.

**Fix:** replace the embed with a two-step query.

1. `event_registration_link_events` → `select('registration_link_id').eq('event_id', eventInfo.id)`
2. `event_registrations` → `.in('registration_link_id', ids).eq('email', lowerEmail).neq('status','cancelled')`

Also: **check the `error` on both queries and `console.warn` on failure** — the silent-failure pattern is what hid this. Then verify end to end for real: create a link, register, sign in via the session link with the same email, confirm the row flips to `checked_in` with `session_attendance_id` populated and the blue pill showing in the roster.

While in this file, replace `.ilike('email', ...)` with `.eq('email', ...)`. Emails are stored pre-lowercased, and `_` / `%` are LIKE wildcards, so `a_b@x.com` currently matches `axb@x.com`. Same fix in `mint-registration`'s dedupe lookup.

#### Item 3: Confirmation emails can fail invisibly (one failure mode is likely)

Three separate problems in `send-registration-email` / its callers:

- **`btoa()` crashes on smart punctuation.** The `.ics` attachment is built with `btoa(buildIcs(events))`, and `btoa` throws on any code point above U+00FF. A curly apostrophe, em dash, or smart quote in an event **title, location, or Zoom description** (i.e. anything pasted from Word or Outlook) throws → 500 → **no email at all**, not merely a missing attachment. The app's own email copy already contains curly apostrophes, so this is not hypothetical. Fix: `btoa(unescape(encodeURIComponent(str)))` or a `TextEncoder` + byte-wise base64 path.
- **Fire-and-forget sends.** `mint-registration` and `cancel-registration` both call the email function with an un-awaited `fetch(...).catch(() => {})`. On Deno Deploy the isolate can be torn down once the response returns, so the send may never leave. Await the call (or use the platform's background-task API) so a failure is at least detectable. Keep the behavior that a failed email never blocks the registration itself.
- **Cancellation emails leave no trace.** `confirmation_sent_at` is stamped only for `confirmation` / `promoted`, so there is no equivalent of the "⚠ not sent" badge for cancellations. Low priority; note it rather than over-building.

**Verify:** register with an event title containing a curly apostrophe and an em dash, and confirm the email arrives with a working `.ics`.

#### Item 4 (small, same area): admin "Promote" skips the notification and the capacity check

`RegistrationRosterModal.jsx`'s `promoteWaitlister` does a bare `.update({ status: 'registered', waitlist_position: null })`. Unlike auto-promotion (which goes through `cancel-registration` and sends the "Spot opened" email), the admin path **never tells the person they got a spot** and **ignores capacity**. The same file already routes Cancel through an edge function for exactly this reason.

**Fix:** have admin promote POST to `send-registration-email` with `kind: 'promoted'` after the update, and warn (do not hard-block) if promoting would exceed `capacity`.

#### Noted, explicitly NOT in this batch

- **Standalone trainings cannot use registration at all**: `event_registration_links.collaborative_id` is `NOT NULL` while standalone events have a NULL `collaborative_id`, and every creation path is collaborative-first. Worse, `session_attendance.collaborative_id` is also `NOT NULL` and `SessionSignIn` passes `eventInfo.collaborative_id`, so **QR sign-in for a standalone training would fail with a not-null violation**. Latent (zero standalone trainings exist), but it means the standalone training feature is not actually usable yet. Needs its own scoped decision, not a drive-by fix.
- `send-registration-email` and `cancel-registration` are callable unauthenticated by anyone (`--no-verify-jwt`), so a known `registration_id` can be email-bombed and a known `cancel_token` cancelled. Partly mitigated by item 1 (no more token harvesting). Real fix is a shared secret or rate limiting — separate item.
- Racy capacity check (count-then-insert, no lock) can let two simultaneous submissions both land as `registered` at the capacity boundary. Low volume, low stakes.
- `.ics` omits `VTIMEZONE` despite using `TZID=America/New_York`, and multi-day events (`bsc_events.end_date`) import as single-day.
- Honeypot trip returns `{ success: true }` with no status, so `RegisterPage` renders "You're registered!" with a broken cancel link. An aggressive autofill would show a real human a fake success. Cheap fix if convenient: return a marker the UI can distinguish.
- Registration emails are outside the `unsubscribe_token` system (registrants are not `user_profiles` rows), so there is no unsubscribe link.

---

### 2026-07-29: Registration link duplicate-save bug + delete affordance — ✅ SHIPPED (036061e, bbf1227) — spec kept for reference

> **Found in live use.** Josh built the first real registration link (AWARE Year 4 TIPE LC) and ended up with **three identical links** created 14 seconds apart. Not user error: it is a branching bug in the save handler. He had no way to remove the extras (only the `is_active` checkbox to close them), so Cowork deleted the two duplicates by SQL after confirming both had 0 registrations. One link survives: `1c6c754d-b4b8-4f14-8d1a-b486589ce3a0`, active, 8 events covered.
>
> Item 1 is the actual bug and should ship first. Item 2 is the missing affordance that made the bug unrecoverable from the UI.

#### Item 1: 🐞 Saving a newly-created registration link a second time creates a duplicate

`RegistrationLinkModal.jsx` `handleSave()` branches on `editingLink` (line ~163). `editingLink` is a **prop**, set only when opening an existing link from the table. On the create path it stays null and the freshly-inserted row lands in the `savedLink` **state** (line ~186). So the modal stays open after a successful create (by design, to show the share URL), and a second click of Save Changes re-enters the `else` branch and **inserts another row** — new id, new token, duplicated event rows. Repeat clicks, repeat links. Josh's three links are exactly this.

**Fix:**
- Introduce a single "what am I editing" value, e.g. `const target = editingLink || savedLink`, and use it for the update-vs-insert branch, the capacity-decrease guard (line ~137), and the `event_registration_link_events` delete-then-insert (line ~170). After the first successful create, every subsequent save must UPDATE that row.
- **Disable the save button while `saving === true`** (it currently only changes its label) so a double-click cannot fire two inserts before the first returns.
- Make sure the covered-events replacement still targets the right id after the switch, and keep the existing behavior that the share URL appears after the first save.
- **Verify:** create a link, click Save Changes three times, confirm exactly ONE row exists in `event_registration_links` and its `event_registration_link_events` rows are not duplicated; then reopen it from the table via Edit and save again, still one row.

While in this handler, note the pre-existing fragility flagged earlier: covered events are replaced with delete-then-insert, so a failure between the two leaves the link covering zero events. If it is cheap, move both into a single RPC or re-insert before deleting; otherwise leave it and say so.

#### Item 2: Delete a registration link (guarded by whether anyone has registered)

There is no delete anywhere in the UI — only the `is_active` checkbox, which closes a link but leaves it in the table forever. Add a **Delete** action to the registration links table (`RegistrationsAdmin.jsx`, next to Roster / Edit) and, if straightforward, to the per-collab Registrations panel on `CollaborativeDetail.jsx`.

Behavior depends on registration count, because `event_registrations` has `ON DELETE CASCADE` from the link — deleting a link with registrants **destroys their registrations irreversibly**:

- **0 registrations:** allow delete behind a confirm dialog naming the link title. Nothing is lost, so a plain confirm is sufficient.
- **1 or more registrations (any status, including `cancelled`):** **do not offer delete.** Disable the button with a tooltip explaining that N people have registered, and point to the Close (`is_active = false`) control instead. Removing a link with real registrants should stay a deliberate DB operation, not a UI button.
- Count registrations at click time (not from a stale list) so the guard cannot be raced.
- Gate on the same permission as the rest of the page (`isAdminLevel` + `canAdminCollaborative`); RLS already scopes `Admins manage registrations` via `is_admin_for_collaborative`, so a non-admin delete should fail server-side too. Confirm that in the ship summary.
- Refresh the table after delete, and surface any error rather than silently doing nothing.

**Josh's suggestion, recorded:** a type-the-word-DELETE confirmation. Cowork's recommendation, which Josh agreed with, is to reserve that friction for genuinely unrecoverable deletes and NOT to allow deleting links that have registrants at all — so the type-to-confirm pattern is not needed for the 0-registration case. If a future need arises to force-delete a link with registrants, that is when the typed confirmation earns its place.

#### Also noted (not code — Josh's to-do in the UI)

The surviving AWARE link has **`capacity = NULL`**, so it accepts unlimited registrations and the waitlist logic never engages (`mint-registration` only evaluates capacity when it is non-null). Josh to set a capacity before distributing the link if the cohort is size-limited.

---

### 2026-07-29: Edge functions into git + registration email/calendar overhaul (3 items) — ✅ SHIPPED (fd1dfbd, bbd7adc, 3b350ad + deploy v5) — spec kept for reference

> **Context.** Josh registered himself through the real AWARE Year 4 TIPE LC link and the whole pipeline worked (schedule import → renamed titles → confirmation email → `.ics`). Reviewing the actual received email, he flagged: inconsistent font sizes, the event list being hard to read, and wanting the "Events covered" heading to name the program. He also asked where the email is generated and whether he can edit it himself.
>
> **The answer exposed a bigger problem, which is why item 1 comes first: 9 of the 10 deployed edge functions are not in the repo.** Only `invite-team-leader` exists under `supabase/functions/`. Every participant-facing email lives solely as a deployed artifact in Supabase — no git history, no diffs, no rollback. That must be fixed before hand-editing email HTML becomes routine.
>
> Item 1 is mechanical and unblocks the rest. Items 2 and 3 both touch `send-registration-email`; do them in one deploy if convenient, but keep them as separate commits.

#### Item 1: Pull all deployed edge functions into the repo

Deployed functions and current versions (from `list_edge_functions`, 2026-07-29):

| slug | version | in repo? |
|---|---|---|
| `invite-team-leader` | 9 | ✅ yes (may be stale vs deployed — diff it) |
| `send-event-email` | 3 | ❌ |
| `send-event-reminder` | 2 | ❌ |
| `mint-registration` | 4 | ❌ |
| `send-registration-email` | 4 | ❌ |
| `cancel-registration` | 3 | ❌ |
| `send-trainer-digest` | 2 | ❌ |
| `send-ceu-certificate` | 3 | ❌ (tombstoned 410 per `9b01b22` — commit as-is, note it) |
| `lookup-registration` | 2 | ❌ |

- Write each deployed source to `supabase/functions/<slug>/index.ts`, matching the deployed code **exactly** (no drive-by cleanups, no reformatting — this commit is a faithful snapshot so the next diff is meaningful).
- **Diff `invite-team-leader` against the deployed v9 first** and report whether the repo copy had drifted; if it had, take the deployed version as truth and say so.
- Note in each file's header comment that it is deployed with `--no-verify-jwt` (all 10 are).
- Add a short "Edge functions" section to `INFRASTRUCTURE.md`: the table above, the deploy command, and the rule that **the repo is now the source of truth — edit here and deploy, never edit in the dashboard**, because a dashboard edit silently desyncs git.
- Do NOT change behavior in this item. Snapshot only.

#### Item 2: Rebuild the registration email template (Outlook-safe, readable)

All in `send-registration-email`'s `html` string. Josh's screenshot of the received email is the reference; his three complaints plus two defects Cowork found:

**Root cause of "font size is all over the place":** the template mixes `px` and `rem`/`em` and leaves headings unstyled. Outlook renders with the **Word engine**, which handles `rem`/`em` unreliably and applies its own heading defaults. Current offenders: `h2` (no size), `h3 { font-size: 1rem }`, `padding-left: 1.2rem`, `margin-bottom: 0.25rem`, `margin-top: 1.25rem`, alongside `14px` / `13px` / `11px`.

- **Pin every element in `px`.** No `rem`, no `em`, anywhere. Set an explicit `font-size` and `line-height` on every text element including headings. Suggested scale: title 22px, section heading 16px, body 15px, secondary 13px, footer 11px.
- **Convert the event list from `<ul>` to a table** (also what Outlook wants): columns **Session | Date | Time | Join**. Keep it to a `<table role="presentation" cellpadding cellspacing border=0>` with explicit widths, `px` fonts, a subtle header row (navy text, light background), and per-row bottom borders. Must stay legible at ~600px and degrade gracefully on mobile.
- **Show START and END time** ("10:00 AM to 2:30 PM"). Currently only `start_time.slice(0,5)` is shown, so a 4.5-hour learning session is indistinguishable from a 1-hour call. Format 12-hour with AM/PM, not 24-hour.
- **Include the year in dates.** Currently `weekday, month, day` only — this cohort crosses into 2027, so "Tuesday, January 5" is ambiguous. Use e.g. "Tue, Jan 5, 2027".
- **Program-aware section heading.** Replace hardcoded "Events covered" with a program-derived label, e.g. **"TIPE Learning Collaborative Events"**. Select `collaboratives(name, program_type)` (the query already joins `collaboratives`) and map `program_type` → label in the function: `tipe_lc` → "TIPE Learning Collaborative", `tic_lc` → "TIC Learning Collaborative", `sts_bsc` → "STS Breakthrough Series Collaborative". Fall back to "Events covered" for anything unmapped. **Keep the mapping in one place** in the function; do not import frontend config into an edge function.
- Keep the plain-text alternative in sync (same times, years, and heading).
- Apply the same treatment to all four kinds (confirmation, waitlisted, promoted, cancellation) so they stay visually consistent.
- **Verify by actually sending** to Josh's address and viewing in Outlook, not just by reading the HTML. Note in the ship summary that Outlook is the primary target client.

#### Item 3: Upgrade the `.ics` calendar attachment

In `buildIcs()`. The current output is otherwise correct (verified against a real received `registration.ics`: all 8 AWARE events, right dates, right Eastern times, RFC-5545 escaping working). Add:

- **`VALARM` reminders** on every event: one at **1 day before** and one at **15 minutes before** (`TRIGGER:-P1D` and `TRIGGER:-PT15M`, `ACTION:DISPLAY`, with a `DESCRIPTION`). Currently there are no alarms at all, so these land silently on participants' calendars.
- **`ORGANIZER`** on every event: `ORGANIZER;CN=UK CTAC:mailto:no-reply@ctac.app`.
  ⚠️ **Keep `METHOD:PUBLISH`. Do NOT switch to `METHOD:REQUEST`.** These are informational attachments, not meeting invitations; a REQUEST from an unmonitored `no-reply@` mailbox would invite RSVP replies that bounce and can leave odd tentative states in Outlook. RSVPs are already handled properly by the separate reminder emails (`event_rsvps`).
- **Prefix each `SUMMARY` with a short program tag** so the calendar entry is self-identifying in a month view: `TIPE LC: Learning Session 1`. Derive the tag from the same `program_type` map as item 2 (short form: "TIPE LC", "TIC LC", "STS-BSC"). This is what Josh actually asked for with "a label that shows it is a Learning Collaborative."
- **Add a `VTIMEZONE` component** for `America/New_York` with correct STD/DST rules. The file currently uses `DTSTART;TZID=America/New_York` with no `VTIMEZONE` definition, which is technically invalid iCalendar; well-known clients resolve the Olson name anyway, but strict parsers may float the times. Note this cohort spans a DST boundary (Oct/Nov 2026 sessions are EDT, Dec-Jan are EST), so the rules must be right, not hardcoded to one offset.
- **`X-WR-CALNAME`** at the calendar level (e.g. the collaborative name) for clients that display it.
- Optional if cheap: `CATEGORIES:CTAC Learning Collaborative`.
- Keep `UID:<event_id>@bsc.ctac.app` exactly as-is — stable UIDs mean re-importing updates entries instead of duplicating them, which is correct and worth preserving.
- **Verify** by importing the generated file into Outlook (and ideally Google Calendar): 8 entries, prefixed titles, correct EDT/EST times, alarms present, no duplicates on re-import.

#### Longer-term question, NOT in this batch

Josh asked whether he can edit the emails himself. After item 1 the workflow is "Claude Code edits the repo and deploys," which is safe but keeps him dependent. If editing email copy becomes frequent, the real answer is DB-backed templates (a table of subject/body templates with token substitution, editable in `/admin`), which is a genuine feature with real scope: template versioning, safe token validation, HTML sanitization, preview-before-send. Do not start it as part of this batch. Revisit if copy edits become a recurring ask.

---

### 2026-07-29: Follow-ups surfaced by the batch above — QUEUED (not yet scoped by Cowork)

Three things found while shipping the two drafts above. Recorded here so they don't evaporate; none were in scope for those items.

#### 1. 🐞 `send-event-reminder` will 500 on any non-ASCII event title — fix before the Oct 27 cohort

Snapshotting the function exposed that it carries **both** defects already fixed in `send-registration-email` back on 2026-07-17:

- `const icsBase64 = btoa(ics)` — `btoa` throws `DOMException` on any code point above U+00FF.
- `SUMMARY:${event.title}`, `LOCATION:${event.location}` and the DESCRIPTION parts are interpolated with **no RFC-5545 escaping**, so a comma or semicolon in a title corrupts the entry.

Impact is worse here than it was for registration email, because this function is **cron-driven**: `week_before`, `day_before`, `hour_before` and `starting_now` all route through it, so one curly apostrophe in a title silently kills every reminder for that event, for every participant, with the failure visible only in edge-function logs. And titles now come straight from imported Word schedules, which is precisely where curly apostrophes and em dashes come from. Currently latent only because the AWARE titles happen to be plain ASCII.

**Fix:** copy the `utf8ToBase64()` and `escIcsText()` helpers from `send-registration-email` (they are in the repo now) and route the SUMMARY/LOCATION/DESCRIPTION values through `escIcsText`. Consider whether the item-3 `.ics` upgrades (VALARM/ORGANIZER/VTIMEZONE/program tag) should apply here too — arguably yes for consistency, though a reminder email arguably needs no alarm since it *is* the alarm. Worth a quick decision rather than assuming.

#### 2. Registration-link tokens remain publicly enumerable

`event_registration_links` still has a `FOR SELECT USING (true)` policy granted to PUBLIC (policy "Public can read registration links"). Anyone with the publishable key can list every link in the system, including its `token`, and therefore reach any collaborative's registration form. This was flagged as still-open in the 2026-07-17 hardening round and remains open.

Lower severity than the `team_codes` case: a registration form is meant to be shared, and no PII sits in the links table. The real risks are (a) spam/nuisance registrations on a link before Josh distributes it, and (b) `capacity` being consumed by bad actors now that the waitlist is live. **Not a one-liner** — `RegisterPage` reads the link by token from the browser, so closing it needs a `validate_registration_link(token)` SECURITY DEFINER RPC in the shape of `validate_team_code`, returning only the fields the form renders. Same pattern, already proven.

#### 3. Stale test-account documentation (superseded — now scoped as item 4 of the draft below)

`CLAUDE.md` lists `test@uky.edu` / `1234` as a live agency_admin test account. It no longer authenticates (`invalid_credentials`), and `user_profiles` currently contains **only super_admins** — the non-admin accounts went away in the collaborative rebuild. This matters more than it looks: it means **no admin-gated or team-scoped UI can be click-through verified by Claude Code at all**, so every such item ships with verification deferred to Josh. Recreating one agency_admin and one team_member test account (Josh's job — account creation) would restore that ability. Update `CLAUDE.md` either way so it stops documenting a dead credential.

---

### 2026-07-29: Reminder pipeline before the Oct 27 cohort (4 items) — ✅ items 1-3 SHIPPED (4e3a9fd, 119884d, 61087b8, + 0545f5b RSVP fix, deploy v3, 2 migrations); item 4 is Josh's — spec kept for reference

> **Why now.** The AWARE Year 4 TIPE LC opens registration imminently (capacity 297, first session **10/27/26**). `send-event-reminder` drives every automated reminder through four pg_cron jobs, has **never run against a real event**, and Cowork verified three problems in it — one of which means **registrants would receive no reminders at all**. Item 1 is the correctness bug, item 2 is the one that changes who gets email (biggest, needs Josh's read on the questions in it), item 3 is presentation, item 4 unblocks Claude Code's own verification.
>
> All of items 1 to 3 are in `supabase/functions/send-event-reminder/index.ts`, which is now in the repo (`fd1dfbd`). **Deploy note:** deploying via the Supabase MCP tool silently flips `verify_jwt` to `true` (it did to `send-registration-email`). This function is called by **pg_cron via pg_net** as well as by the admin UI, so confirm the cron path still authenticates after any deploy, or restore `verify_jwt = false`. The Supabase CLI is not installed on the machine.

#### Item 1: 🐞 `.ics` builder will 500 the whole send on any non-ASCII or punctuated title

Two defects, both already fixed in `send-registration-email` on 2026-07-17 and never back-ported. Verified in the deployed v2 source:

- `const icsBase64 = btoa(ics)` — `btoa` throws `DOMException` on any code point above U+00FF.
- `SUMMARY:${event.title}`, `LOCATION:${event.location}`, and the DESCRIPTION parts are interpolated with **no RFC-5545 escaping**, so a comma or semicolon corrupts the entry.

Worse here than in the registration email, for three reasons: it is cron-driven (nobody is watching), `icsBase64` is computed **once before the recipient loop** so a throw kills the send for **every** participant, and event titles now come straight from imported Word schedules, which is exactly where curly apostrophes and em dashes originate. Latent only because the AWARE titles happen to be plain ASCII.

**Fix:** import/copy `utf8ToBase64()` and `escIcsText()` from `send-registration-email` and route SUMMARY / LOCATION / DESCRIPTION through `escIcsText`.

**Also, while in the failure path:** a throw means `event_reminder_log` is never written, so the every-5-minutes `imminent-reminders` cron will retry the same poisoned event indefinitely. That is arguably better than recording a false success, but it is silent either way. Wrap the per-event `.ics` build so a calendar failure **degrades to sending without the attachment** rather than sending nothing, and log it. Also persist the `failed` count — it is currently computed and thrown away (`event_reminder_log.recipient_count` receives `sent` only), so partial failures are invisible.

**Consider (decide, don't assume):** whether the item-3 `.ics` upgrades from `3b350ad` (VALARM, ORGANIZER, VTIMEZONE, program-tagged SUMMARY) belong here too. Cowork's read: **yes for `VTIMEZONE`, `ORGANIZER` and the program tag** (consistency, and the missing `VTIMEZONE` is the same latent invalidity), but **no for `VALARM`** — a reminder email is itself the alarm, and adding a day-before popup to a calendar entry delivered an hour before the event is incoherent.

#### Item 2: ⚠️ Reminders never reach registrants — they only reach team members

**Verified live.** `send-event-reminder` resolves recipients as: teams in the collaborative → `user_profiles` with those `team_id`s → active, not unsubscribed. Registrants are **not** `user_profiles` rows (registration deliberately creates no account). Current state of the real cohort:

| Collaborative | Teams | Active members | Registrants |
|---|---|---|---|
| **AWARE Year 4 TIPE LC 2026-2027** | **0** | **0** | 1 (Josh's test) |

So today the function returns early with `reason: 'no_teams'` and sends **zero** emails. Come October, 297 educators could register, receive their confirmation, and then get **no week-before, day-before, hour-before, or starting-now reminder** — while the crons report success. This is the single biggest gap between the app and a working October cohort.

**The fix is cheaper than it looks:** `event_rsvps.user_id` is already **nullable**, so registrants can hold RSVP tokens without fake accounts.

- Extend recipient resolution to the union of (a) current team members and (b) non-cancelled `event_registrations` whose registration link covers **this event** (via `event_registration_link_events`).
- **Dedupe on lowercased email** — one person may be both a team member and a registrant; they must not get two copies. Prefer the team-member record when both exist (it has `full_name`, `unsubscribe_token`, and a real `user_id`).
- `event_rsvps` upsert already keys on `(event_id, email)`, so registrant rows work with `user_id: null`. Confirm the `/rsvp/:token` page renders for a row with a null `user_id`.
- **Unsubscribe:** registrants have no `unsubscribe_token`, and the footer's unsubscribe link currently interpolates it unconditionally (a null would produce `/unsubscribe/null`). Decide the approach and say which you chose. Cowork's recommendation: reuse the registration's `cancel_token` for a registrant-facing "cancel my registration" link instead of an unsubscribe link, since for a registrant those are effectively the same intent and it avoids minting a second token system. Do **not** ship a broken or dead link in the footer.
- Guard the early return: `no_teams` must no longer short-circuit when registrants exist. That check is the actual current bug.
- **Sequential sends:** the loop awaits one Resend call per recipient. At 297 recipients that is 297 sequential HTTP round trips in one edge-function invocation, which risks the execution time limit. Assess and report: either batch (note Resend's batch endpoint historically does **not** support attachments, so verify before relying on it), or send in bounded-concurrency chunks, or paginate across invocations. **Do not silently leave a 297-recipient send untested** — this is the scale it will actually run at.

**Josh's open questions, answer before building:** should reminders go to *all* registrants, or only those whose RSVP is not `not_attending`? And should a waitlisted registrant get session reminders (Cowork's view: no — they do not have a seat, and it would read as a confirmation they are in).

#### Item 3: Apply the Outlook-first email treatment to the reminder email

The reminder email has the same defects that `bbd7adc` just fixed in the registration email: `rem`/`em` units throughout (`padding: 1rem`, `margin-bottom: 0.25rem`, `margin: 1.5rem 0`, `padding: 0.6rem 1rem`), an unstyled `<h2>`, and `max-width` on a `div` (which Outlook's Word engine ignores). Reuse the patterns from `send-registration-email` v5 rather than reinventing:

- Every size in `px` with an explicit `line-height`; no `rem`/`em`; no `h1`-`h6`; outer 100% table wrapping a fixed 600px table.
- **12-hour times.** Currently `${start.slice(0,5)}–${end.slice(0,5)}` renders "10:00–14:30 ET". Match the registration email's "10:00 AM to 2:30 PM". (Also note the en dash there, which Josh dislikes in prose; in email body copy use "to".)
- **The RSVP buttons must survive Outlook** — they are `<a>` tags with padding and `border-radius`, which Word renders inconsistently. Convert to table-cell buttons (VML is not required, but the button must not collapse into bare text).
- **Program-aware copy.** `reminderHeadline()` hardcodes "You're registered for an upcoming **Learning Session** in one week" for every program. For the TIPE cohort the events are "Implementation Session N (call)" and plain learning sessions, so this is another STS-BSC carryover of the kind Josh flagged earlier. Use the event's own `title` and/or the `program_type` label map already in `send-registration-email`.
- Keep the text alternative in sync, and **note the blank-line bug pattern**: this function's `text` array uses `''` entries with `.filter(Boolean)`, the same defect just fixed in the registration email, so its plain-text reminders are also arriving as one dense block. Fix it here too.

#### Item 4: Restore non-super_admin test accounts + fix the stale docs

`CLAUDE.md` documents `test@uky.edu` / `1234` as a live agency_admin. It does not authenticate, and `user_profiles` holds **only super_admins**, so Claude Code currently cannot click-through verify any team-scoped or admin-gated UI — which is why a growing number of items ship "verification deferred to Josh."

- **Josh creates the accounts** (account creation stays with him): one `agency_admin` and one `team_member`, both assigned to a team in a **demo** collaborative, never the AWARE cohort.
- Claude Code then updates `CLAUDE.md`'s Test Accounts section to the real credentials-in-use (email + role + team, **no passwords in the repo**) and removes the dead entry.
- Note in `INFRASTRUCTURE.md` that these exist for verification and belong to demo collaboratives only.
- Once they exist, use them: re-verify the two items that shipped with deferred checks (the guarded Delete's disabled-tooltip state, and the View-as CTAC Admin preview).

---

### 2026-07-29: "Add to calendar" links in emails — ✅ CODE SHIPPED (fc94f1b, b646c76); ⏳ DEPLOY + real-client sends pending — spec kept for reference

> **Found by real-world testing.** Josh registered through the live AWARE link and opened the confirmation in both Gmail and Outlook. The `.ics` attachment is effectively unusable for participants:
>
> - **Gmail** renders its own smart card reading **"Unable to load event"** (confirmed from a screenshot: Google Calendar icon, "Based on this email", thumbs up/down — that is Gmail's UI, **NOT our app**; the string exists nowhere in the codebase). Gmail parsed the attachment, tried to build an inline event card, and failed **because those cards handle a single event and our file contains eight.**
> - **Outlook** opens Outlook Web and dead-ends for the same reason: Outlook Web cannot import a multi-event `.ics` from an attachment click.
> - Otherwise Gmail just offers to download the file.
>
> Josh's verdict, and he is right: "I am darn tech savvy and it doesn't seem easy to me, it won't [be] to others." A few hundred educators will not fight with this.
>
> **Two contributing causes**, one of which was Cowork's own recommendation: (1) eight `VEVENT`s in one file, and (2) `METHOD:PUBLISH`, which is what stops Gmail treating it as an invitation. **PUBLISH stays** — see the explicit rejection of REQUEST below.
>
> **Decision (Josh, after weighing options):** add per-event "add to calendar" **links**; do **NOT** build a subscribable calendar feed. The feed's main advantage was auto-propagating date changes, and Josh confirms **dates very rarely move**, so it would be new infrastructure bought for a benefit almost never collected. Revisit only if dates start shifting in practice.
>
> ⚠️ **Do not regress this:** the rebuilt template from `bbd7adc` renders correctly in Gmail (consistent sizes, program-aware heading, table with start+end times and the year). This item adds a column; it must not disturb that work.

#### Item 1: Per-event "Add to calendar" links in the registration email

In `send-registration-email`. For **each event row** in the existing events table, add an **"Add to calendar" column** (its own column — do not crowd the existing Join column) containing small links, Google first because Gmail is where the failure is most visible:

1. **Google** — `https://calendar.google.com/calendar/render?action=TEMPLATE&text=<title>&dates=<start>/<end>&details=<details>&location=<location>`
2. **Outlook** — `https://outlook.office.com/calendar/0/deeplink/compose?subject=<title>&startdt=<start>&enddt=<end>&body=<body>&location=<location>`

Requirements:

- **Percent-encode every parameter.** Titles come from imported Word schedules and contain curly apostrophes, em dashes and commas; an unencoded `&` or `#` would silently truncate the URL. Use `encodeURIComponent`, and note the `&` separators must stay literal in the URL while being written as `&amp;` in the HTML attribute so the markup is valid.
- **Timezone correctness matters more here than anywhere else in the codebase.** The two formats want different things: Google's `dates` wants UTC basic format (`YYYYMMDDTHHMMSSZ`), Outlook's `startdt`/`enddt` want ISO 8601. Source data is local wall-clock time plus `America/New_York`, and **this cohort straddles a DST boundary** (Oct 27 = EDT −0400; Nov 10 onward = EST −0500). Use logic consistent with `buildIcs`'s `VTIMEZONE`, and **verify all 8 real AWARE events land at 10:00 AM local, not 9:00 or 11:00.** Getting this wrong is worse than the current problem, because a wrong time still looks right.
- Include the Zoom link in the details/body so the calendar entry is self-sufficient, matching what `buildIcs` already puts in DESCRIPTION.
- Keep the links small and unobtrusive; the table must still read cleanly at 600px in Outlook (px units, explicit line-heights, no rem/em, per `bbd7adc`).
- Keep the plain-text alternative in sync — one Google URL per event is fine there.

**On a per-event `.ics` link:** the email cannot link to its own attachment. Either (a) omit an iCal link and let the attachment serve Apple Mail / Outlook desktop, or (b) serve a single event's `.ics` by event id from an edge function. **(a) is the expected choice for V1** — the attachment already covers exactly those clients. Do not stand up a new public endpoint unless it is genuinely trivial; say which you chose.

#### Item 2: Keep the attachment, fix the copy that now lies

Current copy: *"You're registered. Save the dates below — a calendar file is attached so you can add them to Outlook, Apple Calendar, or Google Calendar in one click."* That is demonstrably false and Josh watched it fail in both clients.

- **Keep the `.ics` attachment.** It costs nothing and genuinely works in Apple Mail and Outlook desktop, where it imports all 8 at once. It just stops being the instruction.
- Rewrite so the links are the primary path and the attachment is the fallback, e.g.: *"You're registered. Use the Add to calendar links below to save each session, or import the attached calendar file if your calendar app supports it."*
- Check all four kinds (confirmation / waitlisted / promoted / cancellation). Cancellation has neither attachment nor add links, so make sure the new copy introduces no reference to either.

#### Item 3: Same treatment for the reminder emails

`send-event-reminder` attaches a **single-event** `.ics`, so it does not hit the multi-event card failure — but it carries the same friction and makes the same false promise: *"An add-to-calendar file (event.ics) is attached — open it in Apple Calendar, Outlook, or Google Calendar to RSVP locally."*

- Add the same **Google / Outlook** links for that one event, near but visually subordinate to the RSVP buttons — **the RSVP buttons remain the primary call to action.**
- Fix the copy the same way.
- The phrase **"to RSVP locally" is actively misleading**: adding a calendar entry tells CTAC nothing. The app's RSVP buttons are the only thing that records a response. Reword so nobody believes a calendar RSVP counts.
- **Do not add `VALARM`** — that decision (`4e3a9fd`) stands: a reminder email is itself the alarm.

#### Explicitly rejected: `METHOD:REQUEST`

Switching the `.ics` to `METHOD:REQUEST` would make Gmail and Outlook show their native "Add to calendar / Yes-No" card and is the smoothest possible single click. **Do not do it.** Replies go to the unmonitored `no-reply@ctac.app`, so participants would RSVP inside their calendar, believe they had told CTAC, and the response would vanish. For a program that tracks attendance and issues CEUs, silently losing RSVPs is worse than a clunky calendar add. This reverses nothing: `3b350ad` already kept PUBLISH deliberately with the reasoning in a code comment.

#### Verification

- Send a real confirmation to **both** a Gmail address and Josh's Outlook address. This defect was invisible to programmatic assertions *and* to a browser render — it only appeared in real clients. Programmatic checks alone are not sufficient evidence for this item.
- Click the Google link for one **EDT** event (Oct 27) and one **EST** event (Dec 1 or later) and confirm each prefills **10:00 AM to 2:30 PM**.
- Confirm a title containing a curly apostrophe, an em dash and a comma survives the URL round-trip intact.
- The Gmail "Unable to load event" card **may still appear** — that is Gmail reacting to the attachment and is outside our control. Confirm the in-email links work regardless, and **say this in the ship summary** rather than implying the card is fixed, so Josh knows it is expected and why.

---

### 2026-07-29: Public registration page — branding + readable event list — ✅ SHIPPED (513ca37, e9e85dc + 2 migrations) — spec kept for reference

> **Josh's feedback after viewing the live AWARE form** (`/register/d186363f…`, screenshot reviewed): the "Events covered" list is hard to digest, times don't state a timezone, the white card is unbranded, and the background is flat. He wants it to look like the (now much better) confirmation email, plus CTAC/UK logos and a more interesting background drawn from the logo colors.
>
> **Reuse, do not reinvent:** `AssessmentComplete.jsx` and `AssessmentFlow.jsx` already implement exactly this layout — CTAC logo centered at top, UK lockup centered at bottom — via `.logo-top` / `.logo-bottom` in `frontend/src/styles/TeamCodeEntry.css` (255px / 250px max-width, responsive at 640px, with a `2px solid #e5e7eb` divider above the bottom logo). Match that pattern so the public-facing pages stay consistent.
>
> All items are in `frontend/src/pages/RegisterPage.jsx` except item 4.

#### Item 1: Make the event list read like the confirmation email

Currently a `<ul>` (line ~132) rendering `**Title** — Tuesday, October 27 at 10:00 · Virtual`. Three separate problems: bullets are hard to scan, the time is 24-hour with **no end time**, and there is **no timezone**.

Replace with a table matching the email's rebuilt version (`bbd7adc`), minus the Join column:

- Columns: **Session | Date | Time**. **No Zoom links** — Josh was explicit; Zoom belongs in the confirmation email and reminders, not on a public pre-registration page.
- **Program-aware heading**, same as the email: "TIPE Learning Collaborative Events" rather than "Events covered". The page already selects the link with `collaboratives(name)`; extend to `program_type` and reuse the same label map the email uses (`tipe_lc` → "TIPE Learning Collaborative", `tic_lc` → "TIC Learning Collaborative", `sts_bsc` → "STS Breakthrough Series Collaborative", fallback "Events covered"). **Keep one copy of that map** — it currently lives inside `send-registration-email`; the browser cannot import from an edge function, so put the shared map in `frontend/src/config/programConfig.js` (which already holds program branding) and leave the edge function's copy as-is. Note the duplication in the ship summary rather than trying to share code across the runtime boundary.
- **Times: 12-hour, start AND end, with the timezone.** e.g. `10:00 AM to 2:30 PM ET`. Derive the suffix from `bsc_events.timezone` (already selected in the email path; add it to this page's select) — `America/New_York` → `ET`, and degrade gracefully for anything else rather than hardcoding "ET". Parse from the time string; do not construct a `Date` that could shift the value.
- **Dates include the year** — this cohort runs Oct 2026 into Jan 2027, so "Tuesday, January 5" is ambiguous.
- Keep `location` (currently rendered as `· Virtual`); fold it into the row without a leading interpunct.
- **Mobile matters here more than in the email.** Many educators will register from a phone. A 3-column table must not overflow at ~360px: either allow the table to stack (label/value pairs per row under a breakpoint) or constrain column widths so it wraps cleanly. Verify at 360px, not just desktop.

#### Item 2: Add the CTAC and UK logos to the white card

- **CTAC logo, centered at top** of the white card, above the title: `src/assets/UKCTAC_logoasuite_web__primary_tagline_color.png` (the color logo suite — 901×414, 28 KB — the same asset `AssessmentComplete` uses).
- **UK lockup, centered at bottom**, below the submit button, with the same divider treatment as `.logo-bottom` (top border + spacing): `src/assets/UK_Lockup-286.png`.
- Reuse the `.logo-top` / `.logo-bottom` CSS rather than writing new inline styles — but note `RegisterPage` currently uses inline styles throughout (per project convention) and imports no stylesheet. Either import `TeamCodeEntry.css` (as `AssessmentComplete` does) or replicate those exact dimensions inline. Pick one and say which; do not half-apply both.
- Include meaningful `alt` text ("Center on Trauma and Children", "University of Kentucky"), matching the existing pages.
- Apply to **all render states of this page**, not just the form: the success screen ("You're registered!" / waitlist / duplicate) is the same component and should carry the same branding, since that is the last thing a registrant sees.

#### Item 3: A more interesting background from the logo colors

The page background is currently flat `#f9fafb` (line ~240). Use the brand palette from `utils/constants.js` — navy `#0E1F56`, teal `#00A79D`.

- A subtle gradient is the safe choice, e.g. a navy-to-teal diagonal, or navy deepening toward the edges with the white card floating on top. Keep it calm: this is a professional public form for a trauma-informed program, not a marketing splash.
- **Non-negotiable constraints:** the white card must stay high-contrast and legible; body text stays on white (do not put text directly on the gradient); add a soft shadow to lift the card off the new background; and the gradient must not create a hard seam on short viewports or when the page scrolls (use a fixed/`min-height: 100vh` treatment so a long form doesn't tile the gradient repeatedly).
- Check both light and dark mode. `index.css` maps hardcoded colors to theme variables in dark mode (`3f47132`), so a hardcoded gradient may fight the dark theme — verify and handle it.
- Keep the same background on the success/waitlist/error states so the page doesn't flash a different look after submit.

#### Item 4: ⚠️ Optimize `UK_Lockup-286.png` before putting it on a public page

`src/assets/UK_Lockup-286.png` is **1647×485 but 3.08 MB**, and it renders at a max width of **250px**. That is roughly two orders of magnitude more data than needed, on a form that a few hundred educators will open from school wifi and phones.

- Resize to about 2× the display width (~500–600px wide) and compress; expect roughly 30–60 KB.
- **This already affects the public assessment flow** (`TeamCodeEntry`, `AssessmentFlow`, `AssessmentComplete` all load it), so fixing the asset improves those pages too — a real win beyond this item.
- Keep the filename so no imports change, or update all references if you rename. Do not delete the original without confirming nothing else references it.
- Report the before/after byte size in the ship summary.

#### Also worth doing for consistency (small)

`CancelRegistrationPage.jsx` is the other public page in this flow and currently has neither logos nor the new background. Apply the same treatment so a registrant who cancels doesn't land on a visually unrelated page. Do NOT change its behavior — it routes through the `lookup-registration` and `cancel-registration` edge functions, and that logic is correct.

#### Note for Josh (not a code task)

Co-branded UK marks have institutional usage rules. The `UKCTAC_logoasuite_web__primary_tagline_color.png` asset appears to already be the approved co-brand lockup, and it is already in use on the public assessment pages, so this is very likely fine — but this is a public-facing enrollment form for a state-funded project, so worth a glance from whoever owns brand compliance at CTAC before the link goes out broadly.

#### Verification

- View the real AWARE registration link at desktop width **and at 360px**; confirm the event table is readable at both and nothing overflows horizontally.
- Confirm all 8 sessions show `10:00 AM to 2:30 PM ET` (learning sessions) and `10:00 AM to 11:00 AM ET` (implementation calls), with years, and that the Jan 2027 dates read correctly.
- Confirm both logos render (not broken image icons) and that the page still loads promptly after the asset optimization — measure the page weight before and after.
- Check the success state by submitting a test registration, then **delete the test row** (registration tables should return to their pre-test state; there is currently exactly 1 registrant, Josh's earlier Gmail test).
- Check dark mode.

---

### ✅ RESOLVED (2026-08-13): evaluation-PDF restyle is now spec'd — see the LAST draft at the bottom of this file. Original request follows for context.

> **2026-08-13.** Josh asked to make the evaluation PDF look closer to `Evaluation Report - Trauma-Informed Practices for Educators (3 hour version).pdf` (saved in the repo root, 22.7 KB — the existing `Evaluation Report - Training Evaluation Report.pdf`, 9.1 KB, is the older sample the current exporter was built against).
>
> **Claude Code cannot see it.** No `pdftoppm`/poppler for rendering and no `pdfjs-dist`/`pdf-parse` in `node_modules`, so the file can't be rendered *or* text-extracted in that environment. Restyling "closer to this" without seeing it would be guesswork dressed up as work, so it was not attempted.
>
> **Cowork can read PDFs.** What's needed is a spec of the *differences* from what `src/utils/exportEvaluationPdf.js` currently emits — ideally: page/section order, the header/title block treatment, whether the Likert table gains or loses columns, how the NPS block is presented, how verbatim responses are laid out (one table vs. grouped by question), fonts/sizes/rules, and any footer or logo. With that, the change is mechanical.
>
> Useful constraints for whoever writes it: the exporter takes `[{ event_date, title, evaluations }]`; the real 2026-08-07 dataset is 41 responses with **3 NULL `recommend_score`**, 2 smart-quote responses, 1 embedded newline and one that is a single `.`; and all `doc.autoTable` calls are now the **functional** `autoTable(doc, …)` form (see `279ac9b`) — don't reintroduce the method form.

### 📖 REFERENCE: Standalone Trainings — how the feature works as of 2026-08-04

> **Read this before touching standalone trainings.** Built entirely in the 2026-08-04 Claude Code session; Claude.ai/Cowork was not in the loop, so none of it is in any earlier draft. Commits: `5594b68`, `6ae8727`, `dd329a5`, `0163f83`, `56ed1a9`, `dbff6cd`, `b1dd44c`, `0222e84`, plus 7 migrations.

**What it is.** A one-off training that isn't part of a collaborative — `bsc_events.kind = 'standalone_training'` with **`collaborative_id NULL`**. Created from `/admin/trainings` (`TrainingsAdmin` → `StandaloneTrainingModal`); managed at `/admin/event/:id` (`EventDetail`).

**The NULL collaborative_id is the whole story.** Four tables required one, so the entire existing session machinery was unreachable. They are now nullable — `session_links`, `session_attendance`, `session_evaluations`, `event_registration_links` — and their admin RLS policies re-gated on the **event** rather than the collaborative via `can_admin_bsc_event(uuid)` (SECURITY DEFINER), so authorization is exactly as tight as before.

**Authorization rule, used identically in SQL and the UI:**
- `standalone_training` → `is_super_admin() OR created_by = auth.uid()`
- otherwise → `is_admin_for_collaborative(collaborative_id)`

Trainer admins have a **read-only** SELECT policy on standalone trainings — they deliberately cannot write ones they didn't create. Frontend mirrors this as `canManage` in `EventDetail` and `canManageLink()` in `RegistrationsAdmin`. **Never gate on `canAdminCollaborative(event.collaborative_id)` for a standalone training** — it returns false for a null id and silently hides every control.

**Attendee flow (all pages pre-existed; they were just walled off):**
1. `/session/:token` — sign in: name, email, **confirm email** (must match), agency, role. Then → training hub if `hub_enabled`, else a "Thanks for signing in!" screen.
2. `/session/:token/eval` — the standard evaluation. **Genuinely anonymous:** `session_evaluations` holds no name, email, attendance id or FK to the person. Submitting redirects to sign-out with `?evaluated=1`.
3. `/session/:token/signout` — **always asks for the email** they signed in with, then calls `sign_out_by_email(token, email, mark_eval)`.

**Why sign-out asks instead of remembering:** identity used to come from `sessionStorage`, which is scoped **per browser tab** — and every QR scan opens a new tab, so it failed for most attendees while succeeding for a few, and worse, still displayed "You've Been Signed Out" having recorded nothing. `localStorage` now prefills the field (one tap) but never signs anyone out on its own.

**CEU gate** (per the code comments): `signed_in` + `evaluation_completed_at` + `sign_out_method = 'manual'`. Note an admin "Close sign-in" stamps `session_closed`, not `manual`.

**Gotchas that cost time:**
- `session_links` has a **UNIQUE constraint on `bsc_event_id`** — one link per event, no regeneration, so printed QR codes stay valid.
- `sign_in_to_session` writes to `unmatched_attendees`, whose `collaborative_id` is **NOT NULL** — this aborted sign-in for every attendee without an app account (i.e. almost all of them) until guarded. That triage tool maps attendees onto *teams in a collaborative*; it has no meaning here.
- `registration_link_public` used an INNER JOIN on `collaboratives` — returned zero rows for a standalone link. Now LEFT JOIN falling back to the training's own title.
- `event_registration_links` has no `bsc_event_id` column (it covers N events via `event_registration_link_events`, **empty at INSERT time**), so its standalone RLS branch gates on `created_by`, not the join table.
- Registration links are **created** from the training's Manage page; the roster, CSV and shareable roster link live on `/admin/registrations`, which now lists standalone links (the client-side collaborative filter was *removed* — RLS scopes it correctly and in less code).

**Open follow-ups:**
- ⬜ `"Anon can update sign out"` on `session_attendance` is `USING true` — any anon could update any attendance row. Now likely droppable since all attendee sign-outs go through the RPC, but the admin bulk-sign-out paths need checking first.
- ⬜ `CollaborativeDetail.generateSessionLink` hardcodes `4PM EST = 9PM UTC`, an hour off during EDT. The standalone panel uses `roster_share_expiry_for_date` instead; collaborative links still carry the bug.
- ⬜ No test account, so **no admin UI in this feature has been click-through verified by Claude Code** — DB, RPC and public-page behaviour were verified directly. Josh drives admin verification.

---

### ⬜ JOSH: install the Supabase CLI when convenient (not blocking anything)

Full detail lives in `INFRASTRUCTURE.md` → "Installing the Supabase CLI (Windows)". Short version — **you do not need this for any current feature**; it just makes edge-function deploys one command instead of me re-emitting the whole file, which is what made me defer the `send-event-reminder` deploy twice.

`npm install -g supabase` is **not supported** and will fail. Pick one:

**Option A (recommended)** — dev dependency, pins the version with the repo:

```bash
npm install supabase --save-dev
```

**Option B** — Scoop, machine-wide, no `npx` prefix afterwards:

```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
```

```bash
scoop install supabase
```

Then one-time auth. **Run this yourself** — it mints an access token in the browser, and that token must not pass through a Claude session:

```bash
npx supabase login
```

After that a deploy is:

```bash
npx supabase functions deploy send-event-reminder --project-ref jhnquklmwoubpbbmnrjf --no-verify-jwt
```

No `supabase link` needed when you pass `--project-ref`. **Docker is not required for `functions deploy`** — only for `supabase start`, the full local stack, which this project doesn't use.

---

### 2026-07-30: Shareable read-only registration roster link (no login) — ✅ SHIPPED (see Recently shipped; migration + lookup-roster v1 + 2 new frontend files) — spec kept for reference

> **Why.** Registration for the AWARE Year 4 TIPE LC is **live with a real registrant** (JCPS, 2026-07-30). CTAC sometimes runs registration on behalf of a partner who needs to watch the roster fill but has no BSC account and shouldn't get one. Josh wants a URL he can paste into an email; the recipient clicks it and sees the roster, no login.
>
> ⚠️ **This is the one feature that deliberately exposes participant PII to a URL. Read the security section first — it is not optional.** The 2026-07-17 hardening round removed anonymous access to `event_registrations` entirely (dropped two `qual = true` policies, revoked anon's grants). **Do not reopen that.** The proven pattern to copy is `lookup-registration`: a token-scoped edge function that reads with the service role and returns only the fields the page renders.
>
> **Josh's four decisions, as given:**
> 1. **One share link per registration link** (not per partner).
> 2. **Emails are hidden by default**, revealed only if the "include email addresses" checkbox is ticked.
> 3. **Expires the day after Session 1.**
> 4. **Access code required**, default `2112`.

#### Item 1: Schema

Add to `event_registration_links` (single link per registration link, per decision 1):

- `roster_share_token text UNIQUE` — `encode(gen_random_bytes(16),'hex')`, generated on demand (NULL until Josh creates the share link, so existing links are unaffected).
- `roster_share_include_emails boolean NOT NULL DEFAULT false` — **default false, matching decision 2.**
- `roster_share_access_code text` — the code, **stored per link, NOT hardcoded in source.** Seed new links with `2112` as the default value so Josh gets what he asked for, but it must be editable per link without a deploy and must never appear in the repo.
- `roster_share_expires_at timestamptz` — see item 2 for derivation.
- `roster_share_revoked_at timestamptz` — revoke without deleting, so an accidental revoke is recoverable and the audit trail survives.
- `roster_share_view_count integer NOT NULL DEFAULT 0` and `roster_share_last_viewed_at timestamptz` — cheap audit trail; worth having when the payload is personal data.

Per `CLAUDE.md`, this is an existing table so no new GRANTs are needed — **and deliberately no new RLS policy.** The browser must never read these columns; only the edge function (service role) touches them.

#### Item 2: Expiry derivation ("day after Session 1")

- Compute as **the earliest `event_date` among the events covered by this registration link, plus one day, at 23:59:59 America/New_York.** For the AWARE link that is Session 1 on **2026-10-27**, so expiry **2026-10-28** end of day.
- Derive it when the share link is created, **store it** rather than recomputing on every request (so a later event-schedule edit can't silently extend or shorten a partner's access without Josh knowing).
- **Make it editable** in the admin UI. A partner may legitimately need the roster after the cohort starts, and Josh should be able to extend without recreating the link.
- Fallback if the link covers no events (shouldn't happen — creation requires at least one): 90 days out. Do not leave it NULL, because NULL must be treated as "no expiry" nowhere in this feature.

#### Item 3: The edge function

New function, e.g. `lookup-roster`, modeled on `lookup-registration`. Deploy with **`verify_jwt: false`** — and per `INFRASTRUCTURE.md`, **pass that explicitly**, because the MCP deploy tool's `verify_jwt` parameter defaults to `true`.

Request: `{ token, access_code }`. It must, in order:

1. Look up the link by `roster_share_token`. Unknown token → generic "not found." **Do not distinguish "no such token" from "revoked" or "expired"** in the response, so the endpoint can't be used to probe which tokens exist.
2. Reject if `roster_share_revoked_at IS NOT NULL` or `now() > roster_share_expires_at`. These two *may* return a friendly distinct message once the code has already been accepted (see below) — but never before.
3. **Require the access code.** Compare against `roster_share_access_code`. Do the comparison in a way that isn't trivially timing-attackable, and **rate-limit failed attempts per token** (a 4-digit code is brute-forceable in a few thousand requests otherwise — this is the single most important hardening detail in the item). A short lockout or exponential delay after ~5 failures is sufficient.
4. Only then return the payload.

Payload — **allowlist the fields, never spread the row**:

- Link: title, collaborative name, capacity, registration open/close dates, and the counts (registered / waitlisted / cancelled).
- The events covered (title, date, start/end time) so the partner has context — reuse the same 12-hour + **ET** formatting as the registration page and email.
- Per registrant: `full_name`, `status`, `waitlist_position`, `registered_at`, and the **link's configured form fields** (School or District, Position or Title, District(s) Served, Grade Level(s)) read from `responses`.
- `email` **only if `roster_share_include_emails` is true.**

**Never return, under any circumstances:** `cancel_token` (anyone holding one can cancel that person's registration), `id`, `registration_link_id`, `session_attendance_id`, the raw `responses` jsonb wholesale (it contains `email_confirm`, which would leak the email even with the checkbox off), or any of the `roster_share_*` columns. Build the response object explicitly, field by field.

Also: increment `roster_share_view_count` and stamp `roster_share_last_viewed_at` on each successful load.

#### Item 4: The public page

New public route, e.g. `/roster/:token`, registered in `App.jsx` alongside the other public routes.

- Prompt for the access code first; on success, render the roster. Keep the accepted state in `sessionStorage` so a refresh doesn't re-prompt within the session, and do **not** persist it beyond that.
- Read-only. No cancel, no promote, no edit, no export controls that hit admin endpoints. A CSV download built from the already-fetched payload is acceptable if trivial — say whether you included it.
- Show: title, collaborative, the counts, capacity and how many seats remain, the events table, then the roster table (Name, School or District, Position, status pill, registered date, and Email only when enabled).
- Empty state for zero registrants. Clear expired/revoked state ("This roster link is no longer active. Contact CTAC for an updated link.").
- **Add `<meta name="robots" content="noindex, nofollow">`** for this route so the URL never lands in a search index. Confirm how that is done in this SPA (a `useEffect` injecting the tag is fine) and verify it renders.
- Apply the same branding treatment as the registration page once that draft lands (CTAC logo top, UK lockup bottom, brand background) so it looks like part of the same system. If that draft hasn't shipped yet, don't block on it; match `RegisterPage`'s current styling and note the follow-up.
- Mobile matters: partners will open this on phones. Verify at 360px.

#### Item 5: Admin UI

On `/admin/registrations` (and the CollaborativeDetail Registrations panel if cheap), per link:

- **"Share roster"** action opening a small modal: generate/regenerate the token, the **include email addresses** checkbox (unchecked by default), the access code (prefilled `2112`, editable), the expiry date (prefilled from item 2's rule, editable), and a **Copy link** button.
- Show `roster_share_view_count` and `roster_share_last_viewed_at` so Josh can see whether a partner actually used it.
- **Revoke** button (sets `roster_share_revoked_at`) and an un-revoke, plus **Regenerate token** for when a link has clearly leaked — regenerating must invalidate the old URL immediately.
- Make the email-inclusion state obvious in the UI at a glance, e.g. a badge reading "emails hidden" or "emails visible", so Josh always knows what a partner can see without opening the modal.
- Writes go through the normal authenticated admin path (RLS `Admins manage registration links` via `is_admin_for_collaborative`), not the new edge function.

#### Security summary (verify each of these explicitly)

1. Anonymous SELECT on `event_registrations` stays **revoked** — confirm with the publishable key that it still returns `42501` after this ships.
2. `cancel_token` never appears in the payload — grep the response builder.
3. `email` absent when the checkbox is off, including via `responses`/`email_confirm`.
4. Wrong access code is rejected and repeated failures are throttled.
5. Expired and revoked links both refuse to serve data.
6. Regenerating the token kills the old URL.
7. Unknown vs revoked vs expired are indistinguishable before the code is accepted.

#### Note for Josh (not a code task)

The access code is a **speed bump against forwarded links, not access control** — a 4-digit code with rate limiting resists casual sharing, not a determined attacker. It only adds real protection if it travels separately from the link (a second email, or said out loud on a call). If it ends up pasted directly beneath the URL in the same message, its value is close to zero — that's fine as a deliberate choice, just worth knowing. The expiry and the revoke button are the stronger controls here.

---

### 2026-07-30: Registration data hygiene + share-expiry timezone bug (2 items) — ✅ SHIPPED (4cd9c86, mint-registration v5, 1 migration, live share link repaired) — spec kept for reference

> Both found while reviewing the **live** AWARE roster (4 real registrants as of 2026-07-30, all confirmed by email). Small, self-contained, and worth doing while the cohort is still small.

#### Item 1: 🐞 Trim whitespace on submitted registration answers

`mint-registration` trims **only** the two canonical keys (`index.ts` ~lines 90-91: `String(responses.email||'').trim().toLowerCase()` and `String(responses.full_name||'').trim()`). Every other answer is stored **exactly as typed**, and the `responses` jsonb is inserted raw.

Real data already affected (all 4 live registrants, trailing spaces shown as `·`):

| field | stored value |
|---|---|
| District | `Allen County·` |
| District | `Annapolis High School·` |
| Position | `Mental Health Counselor·` |
| Position | `Contracted School-based Therapist` (clean) |

Consequences as the roster grows: `Allen County` and `Allen County·` sort and group as two different districts, exports look sloppy, and any future grouping or dedupe by district silently splits.

**Fix:** in `mint-registration`, normalize the whole `responses` object before insert — trim every **string** value (leave booleans/numbers/nulls untouched; do not coerce types). Collapse internal runs of whitespace only if trivial; the required behavior is just leading/trailing trim.

Notes:
- **Validation already handles whitespace-only correctly** — `validate()` uses `String(v).trim() !== ''` for the presence check, so a space-only required field is already rejected. Trimming on insert does not weaken that; verify it still holds.
- Keep the `'N/A'` sentinel from the `text_na` School field working (`c1b0393`) — `'N/A'` trims to `'N/A'`, so no change, but confirm.
- **Backfill:** Cowork already trimmed the 4 existing rows' string answers in place (safe, lossless, whitespace-only). Re-run an idempotent trim as part of this item anyway and report the row count touched — it should be 0 if the backfill held.

#### Item 2: 🐞 Roster share expiry lands ~1 day late (timezone handling in the modal)

**Observed:** the live AWARE share link has `roster_share_expires_at = 2026-10-29 23:59:59+00`. The spec (and Josh's decision) was **the day after Session 1, end of day Eastern** — Session 1 is 2026-10-27, so the correct value is **2026-10-28 23:59:59 America/New_York = 2026-10-29 03:59:59+00**. It is currently ~20 hours late.

**The SQL is correct; the frontend is not.** `default_roster_share_expiry()` does the right thing:

```sql
SELECT ((min(e.event_date) + 1)::text || ' 23:59:59')::timestamp AT TIME ZONE 'America/New_York'
```

For AWARE that returns `2026-10-29T03:59:59Z`, which **is** Oct 28 11:59:59 PM ET. Two compounding frontend bugs in `RosterShareModal.jsx` corrupt it:

1. **Line ~49:** `setExpiresAt(String(def).slice(0, 10))` takes the first 10 characters of the **UTC** representation. `2026-10-29T03:59:59Z` slices to `"2026-10-29"` — the UTC date, not the intended Eastern date `2026-10-28`. **The displayed date is a day later than the rule intends.** Same pattern on line ~44 for an already-saved value, so reopening the modal shows a date shifted from what is stored.
2. **Line ~99:** `roster_share_expires_at: \`${expiresAt}T23:59:59\`` sends a naive timestamp with **no offset**. Postgres interprets it in the session timezone (UTC for PostgREST), so the saved instant is 23:59:59 **UTC** = 7:59 PM ET, not 11:59 PM ET.

**Fix both, and treat the date input as an Eastern calendar date throughout:**

- When prefilling from the RPC or from a stored value, convert the timestamptz **to America/New_York** before taking the date part, so the date box shows the Eastern date the user actually means.
- When saving, build the instant explicitly as `<date> 23:59:59 America/New_York` rather than sending a naive string. Either send an offset-qualified ISO string, or (cleaner and consistent with the RPC) pass the date to a small SQL helper / reuse the `AT TIME ZONE` construction so the conversion lives in one place.
- **Round-trip test:** pick `2026-10-28` in the picker, save, reopen — the box must still read `2026-10-28`, and the stored value must be `2026-10-29 03:59:59+00`. Today that round-trip drifts a day each way.
- Check a date on the other side of the DST boundary too (e.g. `2026-12-02`, EST) and confirm the offset is −0500 there and −0400 in October. This is the same DST-straddling cohort that made the `.ics` `VTIMEZONE` work necessary.
- `lookup-roster`'s expiry check (`new Date(link.roster_share_expires_at) < new Date()`) is comparing real instants and is **correct** — no change needed there.

**Also fix the live link's stored value** once the code is right: set the AWARE link's `roster_share_expires_at` to `2026-10-29 03:59:59+00` so it matches Josh's actual decision. It is currently more permissive than intended, not less, so there is no urgency — but do not leave the data disagreeing with the rule.

#### Verification

- Submit a test registration with deliberate leading/trailing spaces in District, School and Position; confirm the stored jsonb is trimmed. **Then delete the test row** — the roster is live and being shared with partners, so it must return to exactly the 4 real registrants.
- Round-trip the expiry date in the modal (see above), including across the DST boundary.
- Confirm the roster share page still loads with the corrected expiry and that the access-code gate, hidden-emails default, view counter and revoke all still behave (this item touches the modal that configures them).

---

### 2026-08-04: Close the last always-true anon UPDATE + fix collaborative session-link expiry (2 items) — READY

> Both are follow-ups **you flagged yourself** in the sign-out rework and the standalone-training batch. Cowork investigated each far enough to answer the open questions, so neither needs re-diagnosing.
>
> **Test-data note:** Cowork already deleted the 4 `session_attendance` and 3 `session_evaluations` test rows from the live standalone training "Belonging, Recognition, and Sustainable Care for Counselors & Therapists" (`6ab3e622-6369-4e57-aa4d-9b3328b3ae90`, **real event on 2026-08-07**). Verified after: 0 attendance, 0 evaluations, 0 unmatched, training and session link intact. **Do not delete anything else on that event** — it is three days out and live.

#### Item 1: Move the evaluation-completion stamp into an RPC, then drop the `USING (true)` anon UPDATE policy

Your follow-up asked whether `"Anon can update sign out"` (`USING true` — any anon could update any attendance row) is droppable now that sign-out goes through `sign_out_by_email`, noting the admin bulk-sign-out paths needed checking. **Cowork checked. Answers:**

- **Admin bulk sign-out is safe.** `session_attendance` has a separate `"Admins manage attendance"` policy, `FOR ALL` gated on `can_admin_bsc_event(bsc_event_id)`. Dropping the anon policy does **not** affect admins.
- **But the policy is still load-bearing for one anon write.** `SessionEvaluation.jsx` (~line 101) still performs a **direct anon UPDATE** to stamp `evaluation_completed_at`, and anon still holds column-level UPDATE on exactly `evaluation_completed_at`, `sign_out_method`, `signed_out_at`. Dropping the policy today would silently break the CEU eligibility stamp — silently, because that call is already wrapped in a `try/catch` that only `console.warn`s (by design, so a stamp failure can't block the post-submit navigation).

**So the order matters. Do it in this sequence:**

1. **New `mark_evaluation_completed(p_token text, p_attendance_id uuid)` SECURITY DEFINER RPC** (mirror `sign_out_by_email`'s shape: status string only, never row data, so it cannot be used to read a roster). It must verify the attendance row belongs to the session identified by `p_token` before stamping — do **not** accept a bare attendance id, or an anon caller could stamp arbitrary rows, which is the same hole in a new coat. Idempotent: a second call returns `already_completed` without moving the original timestamp.
2. Repoint `SessionEvaluation.jsx` at the RPC. Keep the existing behavior that a failure never blocks navigation (the eval itself is already saved at that point), but **check and log the returned status** rather than discarding it.
3. **Then** drop the policy and revoke the grants:
   - `DROP POLICY "Anon can update sign out" ON public.session_attendance;`
   - `REVOKE UPDATE (evaluation_completed_at, sign_out_method, signed_out_at) ON public.session_attendance FROM anon;`
   - Check whether `authenticated` still needs those column grants for any non-admin path before revoking there; `"Admins manage attendance"` covers admins, so it likely does not.
4. **Verify the full attendee chain end to end after the revoke, in this order**, because each step depends on the previous: sign in → submit evaluation (stamp lands) → sign out by email (`sign_out_by_email` still works) → repeat sign-out (returns `already_signed_out`, original timestamp unmoved). Then confirm an anon UPDATE against `session_attendance` is refused (`42501`). **Use a demo collaborative event, not the 2026-08-07 standalone training**, and delete every probe row afterward.

This closes the last always-true anon UPDATE policy on this table and removes the final path by which an anonymous caller can write to arbitrary attendance rows. It will also clear one `rls_policy_always_true` finding from the Supabase advisor.

#### Item 2: 🐞 Collaborative session links expire an hour early during EDT — and the first real cohort session is in EDT

`CollaborativeDetail.jsx` `generateSessionLink()` (~line 327):

```js
// Expire at 4:00 PM EST on event date
const expiresAt = new Date(`${evt.event_date}T21:00:00.000Z`) // 4PM EST = 9PM UTC
```

The comment is right about EST and wrong for half the year. `21:00Z` is 4 PM only at UTC−5 (EST); during EDT (UTC−4, mid-March to early November) it is **5 PM**… which sounds harmless until you notice the intent was 4 PM, so the link stays open an hour *longer* than intended in summer and the stated rule and the behavior disagree for roughly eight months of the year. More to the point, it is a fixed wall-clock guess that ignores the event's own end time entirely.

**Why it matters now:** **AWARE Session 1 is 2026-10-27, which falls in EDT** (DST ends 2026-11-01). So the first real cohort session is exactly the case that hits this, and Sessions 2 onward are EST — the same collaborative straddles the boundary.

**Fix:** use the helper that already does this correctly. `roster_share_expiry_for_date` resolves end-of-day Eastern in SQL with real DST rules, and the standalone panel already uses it — verified on the live training, whose link expires `2026-08-08 03:59:59+00`, i.e. 11:59:59 PM ET on the event date. Options, pick one and say which:

- **Preferred:** reuse `roster_share_expiry_for_date(event_date)` so collaborative and standalone links behave identically. End of day Eastern is also more forgiving than 4 PM for a session running to 2:30 PM plus stragglers.
- If a tighter window is wanted, derive from the event's **`end_time` plus a grace period** rather than a hardcoded hour, converting through `America/New_York` in SQL — never by assuming a UTC offset in JS.

Either way: **delete the misleading comment**, do not just correct the arithmetic. And note the existing `close-expired-sessions` cron already deactivates links 30 minutes after `end_time`, so `expires_at` is a backstop rather than the primary control — worth saying explicitly in the code comment so the next person doesn't "fix" one against the other.

**Do not retroactively change existing session links** without checking whether any are currently in use.

#### Optional hardening, decide rather than assume

You noted `no-use-before-define` is not enabled in this eslint config, which is why the `canManage` regression compiled and linted clean while white-screening every event page. You also noted enabling it project-wide surfaces ~20 pre-existing hits that are all safe. If it is cheap, scope the rule to error on the dangerous shape only (e.g. `{ "variables": true, "functions": false }`, or enable it as a warning) so the next occurrence is caught without a 20-site triage. If that turns out to be fiddly, skip it and say so — the stated rule (never `replace_all` a string that also appears in code added in the same edit) is the real mitigation.

#### One question for Josh, not a code task

The 2026-08-07 training is stored as **07:00 to 17:00** (7 AM to 5 PM). If that is a placeholder rather than the real window, it is worth correcting before the day: those times drive the `.ics`, the reminder emails, the auto-close cron, and the sign-in link's expiry.

---

### 2026-08-13: 🔴 EVERY PDF export in the app is broken + standalone attendance needs Excel (2 items) — READY

> **Context.** The standalone training "Belonging, Recognition, and Sustainable Care for Counselors & Therapists" (`6ab3e622-6369-4e57-aa4d-9b3328b3ae90`) ran for real on **2026-08-07**: **44 attendees, 41 evaluations**, mean trainer-effectiveness 4.71, NPS 76. Real data, keep it safe — Cowork deleted only the four Aug-4 test rows and verified zero real rows were touched.
>
> Josh reported two things from the Manage page: **attendance has no Excel download**, and **"Download PDF report" on Evaluation Results does nothing.** Cowork investigated the second one and it is **not** an evaluation-specific bug — it is every PDF export in the codebase.

#### Item 1: 🔴 `doc.autoTable` is undefined — all 5 PDF exporters are dead

**Root cause, verified in `node_modules`, not inferred.** `jspdf-autotable@5.0.7`'s ESM build only auto-registers the plugin when jsPDF is present as a **browser global**. From `dist/jspdf.plugin.autotable.mjs` (~line 2067):

```js
try {
    if (typeof window !== 'undefined' && window) {
        var jsPDF = anyWindow.jsPDF || anyWindow.jspdf?.jsPDF;
        if (jsPDF) {
            applyPlugin(jsPDF);   // ONLY runs if jsPDF is a global
        }
    }
} catch (error) { console.error('Could not apply autoTable plugin', error); }
```

This is a Vite app importing jsPDF as an ES module, so `window.jspdf` is **undefined**, `applyPlugin` never runs, and the side-effect import `import 'jspdf-autotable'` accomplishes nothing. Every `doc.autoTable(...)` call therefore throws `TypeError: doc.autoTable is not a function`. Installed versions: `jspdf@4.2.1`, `jspdf-autotable@5.0.7`.

**Blast radius — 11 call sites across 5 files, all currently broken:**

| file | `doc.autoTable(` calls | user-facing feature |
|---|---|---|
| `src/utils/exportPdf.js` | 4 | Team Report PDF |
| `src/utils/exportStsPat.js` | 3 | STS-PAT report PDF |
| `src/utils/exportSupervisorSelfRating.js` | 2 | Supervisor self-rating PDF |
| `src/utils/exportEvaluationPdf.js` | 1 | Evaluation report PDF (**what Josh hit**) |
| `src/components/AttendanceReport.jsx` | 1 | Attendance PDF |

⚠️ **Assume all five are broken right now, not just the one Josh clicked.** The Team Report PDF demonstrably worked back in May, so this is a regression introduced by the jsPDF v4 / autotable v5 upgrade and has been silent since. **No participant was ever affected — no real cohort has run yet** (the 2026-08-07 standalone training was the first live event, and the AWARE TIPE cohort does not start until 2026-10-27), so the exposure was demo data and Josh's own testing. That is also why it went unnoticed: builds, lint and programmatic tests all pass, and only a click reveals it. **Verify each of the five by clicking it; do not assume the shared fix covers a call site you did not exercise.**

**Fix — pick one and apply it consistently across all five files:**

- **Preferred: the functional API.** `import autoTable from 'jspdf-autotable'`, then `autoTable(doc, { ... })`. This is v5's intended usage and has no dependency on globals. `doc.lastAutoTable` is still populated by the functional call, so the existing `y = doc.lastAutoTable.finalY + N` lines keep working — **confirm that** rather than trusting it, since every one of these files uses that pattern to position the next block.
- **Alternative: register once.** `import { applyPlugin } from 'jspdf-autotable'; import jsPDF from 'jspdf'; applyPlugin(jsPDF)` in a single shared module imported by all five, leaving the `doc.autoTable(...)` call sites untouched. Smaller diff, but it depends on the shared module being imported before any export runs — an import-order trap that will bite someone later. Prefer the functional API unless the diff is unmanageable.

Do **not** downgrade the packages to dodge this.

**Verification (this is the part that matters — the bug survived because nobody clicked):**
- Exercise **all five** PDF exports in the browser and confirm a file downloads and opens.
- For the evaluation PDF specifically, use the **real 41-response dataset** on the 2026-08-07 training. That data contains the exact edge cases that would break a naive rewrite: **3 rows with `recommend_score` NULL**, one response containing **curly quotes** (`Asking “am I doing what I expect others to do”`) and another with a **smart apostrophe** (`I wouldn’t change anything.`), one with an **embedded newline**, and one that is a single `.` character. If the PDF renders all 41 verbatim responses without mangling or throwing, the fix is sound.
- Check the console for `Could not apply autoTable plugin` — its absence is **not** evidence of success, since the guard silently skips when there is no global.

#### Item 2: Excel export for standalone-training attendance

`StandaloneAttendanceList` on `EventDetail` renders a flat attendance table with **no export at all**. The collaborative path has had this for months: `AttendanceReport.jsx` builds an `xlsx` workbook (`XLSX.writeFile(wb, \`Attendance_${eventTitle}_${eventDate}.xlsx\`)`, line ~114) alongside its PDF.

Josh needs the same for standalone trainings — he has 44 real attendees to report on now.

- Add a **Download Excel** button to the standalone attendance section.
- Columns should cover what the screen shows plus what a report needs: **Name, Email, Agency, Role, Signed in, Signed out, Evaluation completed, Status**. Include the sign-out method if it is cheap, since it is the CEU-credit signal.
- Format timestamps as readable local **Eastern** times with the date, not raw ISO — consistent with the ET convention now used in the emails and on the registration page. Do not emit a naive local-time string that depends on the viewer's machine.
- **Reuse `AttendanceReport`'s workbook builder rather than writing a second one.** If that component is too collaborative-coupled to reuse directly, extract the sheet-building into `src/utils/exportAttendance.js` and have both call it — one implementation, not two that drift.
- Filename: match the existing convention, e.g. `Attendance_<training title>_<date>.xlsx`, with unsafe filename characters stripped (the real title contains `&` and commas).
- While here: consider adding the **PDF** attendance export to the standalone view too for parity — but only after item 1 is fixed, or you will be shipping a second dead button.

**Verification:** download the Excel from the real 2026-08-07 training, open it, and confirm all **44** rows are present with correct headers and readable ET timestamps. Confirm the file opens in Excel without a repair prompt.

#### Note for Josh

Both of these were only findable by using the app on real data — the PDF breakage in particular is invisible to builds, lint, and programmatic tests, and would have been caught months earlier by one click. Worth adding "click every export button" to the checklist after any dependency upgrade.

---

### ⚙️ ENVIRONMENT NOTE for the PDF restyle — read before starting (verified 2026-08-13)

> Two corrections to what the restyle spec and I each assumed. **Claude Code here runs on a Windows host, not a Linux sandbox.**
>
> - ✅ **`pdftotext` IS available** — `C:\Users\jafish0\AppData\Local\Programs\Git\mingw64\bin\pdftotext.exe`, bundled with Git for Windows. So the target PDF's **text** can be extracted locally. *My earlier claim that the reference PDF "can be neither rendered nor text-extracted" was wrong on the text half — I checked `node_modules` and `pdftoppm` but never the PATH.*
> - ❌ **`pdftoppm` is NOT available**, and neither is ImageMagick or Ghostscript. The spec says it "is at `/usr/bin/pdftoppm` even though a tool wrapper may report otherwise" — that holds for a Linux sandbox, not for this host. There is no PDF **rasteriser**, so the spec's central verification step — *"render the PDF to images and inspect every page"* — **cannot be done as written here.**
>
> **Consequence for whoever picks this up.** Visual verification is the crux of this spec, and structure-only checks are exactly how the dead-`autoTable` bug survived for months. Options, best first:
> 1. Run the restyle in an environment that has poppler (a Linux sandbox / Cowork), so pages can actually be inspected.
> 2. Install poppler for Windows on this host first (Josh's call — it's a system change, so ask).
> 3. Generate the PDF in node, extract with `pdftotext -layout` to confirm content, ordering, counts and that verbatim text survives intact — then have **Josh** eyeball the rendered pages. This verifies everything except pixels: zebra alignment, table page-splits, cell overflow and the header band still need a human or a rasteriser.
>
> Whichever route: `exportEvaluationPdf.js` has no browser-only dependencies, so it runs in node directly. Stub `jsPDF.prototype.save` to write bytes to disk (the harness pattern used for the autotable verification in `279ac9b`).

### 2026-08-13: Restyle the evaluation PDF to the CTAC house format — READY (spec'd by Cowork)

> **This unblocks the ⬜ FOR COWORK item.** Claude Code couldn't render or text-extract the target PDF in its environment. Cowork read it, rendered both PDFs to images, and — better — found the **generating source**, so this spec uses exact values rather than estimates.
>
> **Ground truth sources, all in the repo. Read them; do not guess:**
> - **`Training Manager/CTAC_Report_Style_Guide.md`** — the house style, written for exactly these two report types. **Authoritative.**
> - **`Training Manager/ctac_reports.py`** — the ReportLab code that produced the target PDF. `build_eval_pdf()` (~line 601) is the structure; `_styles()` (~line 388), `_ratings_table()` (~line 520), `_nps_strip()` (~line 550), `_comments_table()` (~line 578) are the exact sizes, widths and fills.
> - **`Evaluation Report - Trauma-Informed Practices for Educators (3 hour version).pdf`** (repo root, 9 pages) — the target output.
> - `Evaluation Report - Training Evaluation Report.pdf` (repo root, 6 pages) — the OLD sample the current exporter was built from. This is what we are moving *away* from.
>
> Target file to change: **`frontend/src/utils/exportEvaluationPdf.js`**. Two call sites must keep working: `EventDetail.jsx` (single session) and `TrainerDashboard.jsx` (single **and** multi-session — it passes up to 10 sessions at once).

#### What's different, concretely

| | Current app PDF | Target house format |
|---|---|---|
| Page furniture | none | navy cover header band, running header on pages 2+, footer with address + page number on every page |
| Title block | centered "Training Evaluation Report" + centered subtitle + navy rule | left "Session Evaluation Report" (h1) + training name (h2) + **teal** rule |
| Section labels | `Q51 - Please rate`, `Q51 - What part…` (Qualtrics artifacts) | `Quantitative Ratings`, `Open-Response Comments`, and the plain question text |
| Rating labels | full survey wording, long enough to truncate | short display labels (see table below) |
| Ratings table | Field / Min / Max / Mean | Evaluation item / Min / Max / Mean / **n**, zebra rows, mean **bold navy** |
| NPS | **absent** | "Likelihood to Recommend" 5-cell stat strip |
| Verbatim comments | plain indented lines, unnumbered | **numbered two-column zebra table** (index │ comment) |
| Multi-session | sessions run together | each session **starts a new page**; a **Contents** table when >1 |

#### Brand tokens (exact, from `ctac_reports.py` lines 26-34)

`NAVY #0E1F56` · `TEAL #00A79D` · `PAPER #FBF8F2` · `ZEBRA #F4F1EA` · `HAIRLINE #E3DDD1` · `INK #2A2D34` (body text — **not** pure black) · `GREY #6B7280` · `NAVY_SOFT #EAEDF5` · `TEAL_SOFT #E1F4F2`

#### Type scale (from `_styles()`; sizes are pt)

| style | font | size / leading | color |
|---|---|---|---|
| h1 | display bold | 17 / 21 | navy |
| h2 | display | 13.5 / 17 | navy |
| program name (under h1) | display | **12.5** | navy |
| body | body regular | 10 / 14.5 | ink |
| meta | body regular | 9.5 / 13 | grey |
| table cell | body regular | 9.5 / 13 | ink |
| table header | body semibold | 9.5 / 12 | white |
| footnote | body regular | 8 / 11 | grey |
| stat number | display bold | 22 / 25 | navy (teal for the NPS cell) |
| stat caption | body regular | 8 / 10.5 | grey |

**⚠️ Fonts — read this before starting.** The house PDF embeds **Zilla Slab** (display) + **Fira Sans** (body) TTFs. jsPDF ships only Helvetica/Times/Courier; embedding two families means base64-ing four-plus TTFs into the bundle (several hundred KB on a public-facing app). **For this pass, keep Helvetica** and treat the type *scale, weights and colors* as the spec. Structure, color and layout account for nearly all the visual gap; the typeface is the last few percent. Say in the ship summary that fonts were deliberately not embedded, so the decision is visible rather than looking like an oversight.

#### Page furniture

- **US Letter, ~0.8in (≈20mm) margins.**
- **Cover header (page 1):** full-width navy band; **7px teal rule along its bottom edge**; `CTAC` in white display bold with a **small teal square** immediately right of the wordmark; beneath, in pale blue, `Center on Trauma and Children · University of Kentucky`; right-aligned `EVALUATION REPORT` (white, semibold, letterspaced) and under it `Prepared <Month D, YYYY>`.
- **Running header (pages 2+):** small navy `CTAC`, then grey `· <training name> — Evaluation Report`, with a hairline rule beneath.
- **Footer (every page):** hairline rule, then grey, 8pt: left `CTAC · 3470 Blazer Parkway, Suite 100, Lexington, KY 40509 · (859) 218-6901`, right `Page N`.
- **Implementation note:** jsPDF has no page templates. Draw furniture **after** the content exists by looping `for (let i = 1; i <= doc.getNumberOfPages(); i++) { doc.setPage(i); … }`, so `Page N` is correct and nothing is drawn on a page that later gets removed. autoTable's `didDrawPage` hook is the alternative but fires only for table pages — the loop is safer here.

#### Document structure

1. `Session Evaluation Report` (h1)
2. Training name (h2 at 12.5pt)
3. Optional one-line scope note (meta) — omit if we have nothing to say; do not invent one.
4. **Teal** horizontal rule, 1.2pt.
5. **Contents table, only when more than one session:** `Session │ Date │ Responses`, navy header, zebra, column widths `[content − 2.4in, 1.4in, 1.0in]`.
6. **Per session, each starting on a new page** (`PageBreak` between sessions; the first session does not need one after the title block on a single-session report):
   1. `Session N` (h1) when multi-session, or `Session Results` (h1) when single.
   2. Session title (h2). **The app has a real event title, so use it here** — and unlike the sample PDF, do **not** also print the date as the h2, which is why that file shows `8/10/2026` twice. That's an artifact of the Python passing the date as the label when no title existed.
   3. Meta line, joined with `  ·  ` : `M/D/YYYY  ·  N responses`.
   4. `Quantitative Ratings` (h2) + ratings table + footnote `Scale: 1–5. n = non-blank responses per item.`
   5. `Likelihood to Recommend` (h2) + NPS strip + footnote — **only when the data has at least one non-null `recommend_score`.**
   6. `Open-Response Comments` (h2) + meta `Responses are transcribed verbatim and numbered in submission order.` then, per question: question text (body semibold, navy), `N responses` (meta), numbered comments table.

#### The six rating rows — switch to the short display labels

Replace the long survey wording in `LIKERT_FIELDS` with these (mapping to the same DB columns):

| column | display label |
|---|---|
| `trainer_effective` | Trainer was effective |
| `content_objective_alignment` | High consistency between content and objectives |
| `applicable_to_work` | Will incorporate knowledge & skills into daily work |
| `practical_knowledge` | Satisfied with practical knowledge & skills presented |
| `methods_appropriate_audience` | Teaching methods appropriate for intended audience |
| `methods_appropriate_subject` | Teaching methods appropriate for subject matter |

#### Ratings table

- Columns and widths: `Evaluation item` (content − 2.4in) · `Min` · `Max` · `Mean` · `n` (0.6in each).
- Navy header row, white semibold text. **Zebra** `#F4F1EA` on alternating body rows. Hairline `LINEBELOW` 0.5pt on all rows. Numerics **centered**, two decimals. **Mean bold, navy.**
- `n` = count of non-null values **per item** (not per response — an item can be blank while others are answered).
- **Anomalous `0.00` rule** (from the style guide): a 0 on a 1–5 scale is a skipped entry. Keep it in `n` and the mean, render the Min as `0.00*`, and append the footnote *"A minimum of 0.00 reflects a single anomalous/blank entry on a 1–5 scale; group means remain high."* A legitimate `1` is a real minimum — render `1.00`, **no asterisk**. Implement the check even though the current dataset has no zeros; it is cheap and the rule is house policy.

#### NPS strip

- Source column `recommend_score` (0–10). Classification: **Promoter 9–10, Passive 7–8, Detractor 0–6.**
- `NPS = round(100 * (promoters − detractors) / n)`, where `n` counts **non-null** scores only. Passives are excluded from the score but shown in the breakdown.
- Five equal-width cells, two rows (big number above, small grey caption below): `Avg score (of 10)` · `Net Promoter Score` · `Promoters (9–10)` · `Passives (7–8)` · `Detractors (0–6)`.
- All cells filled `NAVY_SOFT`, **except the Net Promoter Score cell which is `TEAL_SOFT` with its number in teal.** Show the NPS with an explicit sign (`+76`).
- Footnote: `"How likely are you to recommend this course to a friend or colleague?" (0–10). n = <n>; raw range <min>–<max>. NPS = % Promoters − % Detractors.`

#### Comments table

- Two columns, widths `[0.45in, content − 0.45in]`. Numbered from **1 in submission order**, zebra alternating, `VALIGN: top`.
- **Verbatim. No exceptions:** preserve original spelling, punctuation, smart quotes, embedded newlines, and one-character entries such as a lone `.`. Do not trim, summarize, reorder, or de-duplicate.
- Order the sections: most helpful → improvements → additional comments. Skip a question entirely when it has zero non-empty responses (do not print an empty heading).
- The report stays **commentary-free** — no themes, synthesis or recommendations. That belongs to the Training Report, not this one.

#### Filename

`<Training_Name>_Evaluation_Report.pdf`, unsafe characters stripped (the live title contains `&` and commas). Keep the existing multi-session variant naming.

#### Verification — use the real data, and actually look at the output

The live standalone training `6ab3e622-6369-4e57-aa4d-9b3328b3ae90` (2026-08-07) has **41 real evaluations** that exercise the hard cases:

- **3 rows with `recommend_score` NULL** → NPS `n` must be **38**, not 41. Raw range is **7-10**, so there are **zero detractors** — confirm the strip renders `0` rather than breaking or hiding the cell.
- Smart punctuation: `Asking “am I doing what I expect others to do”` and `I wouldn’t change anything.` must render intact, not as mojibake or `?`.
- One response contains an **embedded newline**; one is a single `.` — both must appear.
- **`most_helpful` and `improvements` have 41 responses each, but `additional_comments` has only 8** — confirm the sparse question renders with its own correct count and the empty ones are skipped.

Render the PDF to images and inspect every page (`pdftoppm` is available in the Claude Code sandbox — it is at `/usr/bin/pdftoppm` even though a tool wrapper may report otherwise). Check: the teal rule under the header band, zebra alignment, that the ratings table doesn't split awkwardly across a page, that long verbatim responses wrap inside their cell rather than overflowing, and that `Page N` is right on the last page. Compare side by side against the target PDF.

Also re-render the **multi-session** path from TrainerDashboard so the Contents table and per-session page breaks are exercised.

#### ⚠️ Data-quality observation for Josh, not a code task

Two of the 41 responses rated **all six items `1`** while writing glowing comments (`"Alex is always an incredible teacher! I loved the whole presentation!"` and `"What I felt was most helpful was the quick breakout sessions…"`). Almost certainly reversed-scale confusion or a miskey, not genuine 1s. They drag every mean down by roughly 0.2 and will show `Min 1.00` on all six rows. Worth deciding before this report goes to anyone: leave as-is (defensible — it is what they submitted), or treat as a known data-cleaning case. This is exactly the kind of rule the blocked data-cleaning feature is meant to codify, and a real argument for making the evaluation scale direction more obvious in the UI.

---

### 2026-08-13: Make the evaluation scale direction unmistakable + flag contradictory responses (2 items) — READY

> **Why.** In the first real evaluation dataset (41 responses, standalone training `6ab3e622-6369-4e57-aa4d-9b3328b3ae90`, 2026-08-07), **two respondents rated all six Likert items `1` (Strongly Disagree) while writing glowing comments** — `"Alex is always an incredible teacher! \nI loved the whole presentation!"` and `"What I felt was most helpful was the quick breakout sessions…"` — and **both gave a recommend score of 10.** Almost certainly reversed-scale confusion, not genuine 1s. They pull every item mean down by roughly 0.2 and force `Min 1.00` across all six rows of the report, which has already gone out.
>
> **The scale is already labelled**, so this is not a missing-label fix. `SessionEvaluation.jsx` renders each option as the number (1rem) above the word (0.75rem, grey until selected), from `SESSION_EVALUATION_CONFIG.likertScale`. Item 1 addresses *why it can still read ambiguously*; item 2 catches it when prevention fails.

#### Item 1: Prevention — the direction must be readable at a glance, on a phone

`SessionEvaluation.jsx` ~lines 173-200.

**Leading suspect, fix first: the row wraps on phones.** The buttons are `flex: '1 1 0'` with `minWidth: '80px'` inside a `flexWrap: 'wrap'` container. Five × 80px = **400px minimum**, so on a 360px-wide phone the row **wraps to two lines** — and once it wraps, the left-to-right "disagree → agree" axis is gone. What remains is a grid of numbers where the digit is the dominant visual element. That is exactly the condition under which someone assumes `1` means "best" (as in a #1 ranking) and taps it.

- Replace the wrapping flex row with a **5-column grid that shrinks rather than wraps** (`display: grid; gridTemplateColumns: repeat(5, 1fr)`), dropping `minWidth` to something that survives 320px. The five options must **always** sit on one line, in order.
- Verify at **320px and 360px** widths, not just desktop. This is a public page used on personal phones in a training room.

**Then reinforce the direction:**

- **Add end anchors to the row**, matching what the NPS question already does. `SESSION_EVALUATION_CONFIG.nps` has `minLabel: 'Not at all likely'` / `maxLabel: 'Extremely likely'`, but the Likert block has no equivalent — an inconsistency inside the same form. Render small grey anchors at the row ends (e.g. `Strongly Disagree` ←…→ `Strongly Agree`), or a single caption above the first row of items. Show it **once per section**, not on all six items, or it becomes noise.
- **Give the word at least equal visual weight to the number.** The word carries the meaning; today the digit is larger and the label is small grey text until selected. Consider reversing the emphasis, or at minimum matching sizes and darkening the unselected label.
- **Do NOT add a red-to-green color ramp.** It encodes direction, but the connotations are heavier than they are worth in a trauma-informed program, and color alone is not accessible. If a visual gradient is wanted, use a single-hue intensity ramp in the brand teal and treat it as decoration, never as the only cue.

**Finally, a soft straight-lining confirmation (non-blocking):**

- If the respondent selects the **same extreme value on all six items** (all 1s or all 5s), show an inline, dismissible note near the submit button: *"You've rated every item Strongly Disagree — just confirming that's what you meant."* (wording mirrored for Strongly Agree).
- **Must not block submission and must not pre-empt a genuine answer.** No modal, no forced re-entry. It is a nudge at the only moment the person who made the mistake can still fix it.
- Only fire on the extremes; all-3s or all-4s are not worth interrupting anyone over.

#### Item 2: Detection — flag contradictory responses (rules-based, no AI)

**Verified against the live data. This rule catches exactly the two suspect rows and produces zero false positives across all 41 responses.**

**Rule A — contradiction (high confidence):**
- `max(all six Likert items) <= 2` **AND** `recommend_score >= 9` → flag. (Both suspect rows: all items = 1, NPS = 10.)
- Mirror for symmetry: `min(all six Likert items) >= 4` **AND** `recommend_score <= 6` → flag.
- Purely numeric. No sentiment analysis, no keyword lists, no AI — which is the constraint Ginny set for data cleaning. A genuinely dissatisfied respondent rates low *and* recommends low, so the rule leaves real criticism alone. It flags **contradictions**, not negativity. Skip the rule entirely when `recommend_score IS NULL` (3 of 41 rows here).

**Rule B — straight-lining (weak signal, label as such):**
- All six items identical → note it, but weight it far lower. All-5s is common and usually sincere; do not present it at the same severity as Rule A.

**How to surface it:**
- **Flag, never drop, never auto-correct.** The response stays in the data and in every count and mean exactly as submitted.
- Surface in the **admin** evaluation view on `EventDetail` — e.g. a small warning badge on the Evaluation Results header ("2 responses flagged for review") that expands to show which and why. Admin-only; never on the participant-facing page.
- Consider a **footnote in the evaluation PDF** when any response is flagged, so whoever reads the report knows the means include a contested response. Coordinate with the PDF restyle draft (which already specifies a footnote mechanism for the anomalous-`0.00` case) so there is one footnote convention, not two. If the two drafts land in either order, make them consistent.
- Put the rule in **one place** (e.g. `src/utils/evaluationFlags.js`) so the admin view, any future export, and the data-cleaning stage all share an implementation.

**This is the first concrete data-cleaning rule derived from real data** rather than hypotheticals, and it belongs in the ⛔ blocked data-cleaning feature's ruleset when that unblocks. Note it there so it is not reinvented.

#### Verification

- Resize the evaluation page to **320px and 360px**; confirm the five options stay on one line, in order, with the direction anchors visible.
- Submit a test evaluation selecting all 1s; confirm the soft confirmation appears, is dismissible, and **does not block** submission.
- Confirm the two known flagged rows in the live 2026-08-07 dataset are identified by Rule A, and that **no other row of the 41** is flagged.
- Confirm counts, means and the NPS in the admin view and the PDF are **unchanged** by flagging — nothing is excluded.
- ⬜ The admin view is gated; the participant-facing evaluation page is public and can be checked directly.

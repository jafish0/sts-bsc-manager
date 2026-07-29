# STS-BSC Manager — Production Infrastructure

Living doc of the live production stack: domains, DNS, email, hosting, and the integration points between them. Complements `CLAUDE.md` (which covers code conventions and database schema). Update this when infrastructure changes; don't let it go stale.

**Last updated:** 2026-05-07 — `trainer_admin` role added with collaborative-scoped admin access; `pg_cron` enabled with a 1-min `close-expired-sessions` job that auto-closes session links 30 minutes after `end_time`. Earlier 2026-05-05: FK constraints to `user_profiles.id` now `ON DELETE SET NULL`. Earlier 2026-05-04: initial migration from `sts-bsc-manager.vercel.app` to `bsc.ctac.app`, custom SMTP via Resend, full email auth (SPF + DKIM + DMARC).

---

## URLs

| Purpose | URL | Notes |
|---|---|---|
| Canonical app | `https://bsc.ctac.app` | What users see; what new invite emails link to |
| Legacy alias | `https://sts-bsc-manager.vercel.app` | Kept alive for back-compat with existing invite emails in users' inboxes. Do **not** remove the domain attachment. |
| Apex (parked) | `https://ctac.app` | Currently attached to bsc-manager project, no redirect. Reserved for future CTAC landing page (when other programs come online: TIC LC, TIPE LC, FourC). |
| Local dev | `http://localhost:5173` | Listed in Supabase auth redirect allowlist |

---

## DNS

- **Registrar:** Vercel (registered via Vercel Domains)
- **Nameservers:** Vercel-managed (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`)
- **DNS dashboard:** `https://vercel.com/joshua-fisherkellers-projects/~/domains/ctac.app`
- **ICANN email verification:** completed 2026-05-04. Annual reminders come via Vercel.

### Records currently published on `ctac.app`

| Name | Type | Purpose |
|---|---|---|
| `_dmarc` | TXT | DMARC policy: `v=DMARC1; p=none;` (monitor-only) |
| `resend._domainkey` | TXT | DKIM, auto-managed by Resend |
| `send` | TXT | SPF: `v=spf1 include:amazonses.com ~all`, auto-managed by Resend |
| `send` | MX | Bounce/feedback routing to AWS SES (Resend's underlying delivery) |
| (CAA) | CAA | Default Vercel CA authorization (letsencrypt, sectigo, pki.goog) |

Subdomain → project bindings (e.g., `bsc.ctac.app` → bsc-manager project) are auto-managed by Vercel via CNAME. They don't appear in this DNS table.

---

## Email pipeline

```
User action (admin invite, password reset, etc.)
   ↓
Supabase Auth (e.g. inviteUserByEmail)
   ↓ [custom SMTP enabled]
Resend (smtp.resend.com:465) — API key auth, signs with SPF + DKIM
   ↓
Recipient inbox (UKY Exchange, Gmail, etc.)
```

- **Resend plan:** Paid (free-tier daily/monthly sending caps lifted — ample headroom for invites, reminders, registration/RSVP emails, and trainer digests)
- **Resend domain:** `ctac.app`, Verified
- **Sender identity:** `CTAC <no-reply@ctac.app>` (program-agnostic on purpose — same identity will serve TIC LC / TIPE LC / FourC when they come online)
- **Resend API key:** stored in Supabase Auth → SMTP Settings password field. Never commit.
- **Supabase rate limit:** jumped from 2/h (default) to 30/h on custom SMTP enable
- **Email-auth posture:** SPF + DKIM + DMARC all green at `mxtoolbox.com/dmarc.aspx`
- **DMARC policy:** `p=none` (monitor only). Tighten to `p=quarantine` after ~4 weeks of clean sending.

---

## Email templates (Supabase Auth)

**Critical:** Supabase auth email templates (Invite User, Password Reset, etc.) are **dashboard-only config**. They are NOT in `supabase/migrations/` and CANNOT be updated via the Supabase MCP toolset.

The Management API endpoint that does support template writes is:

```
PATCH https://api.supabase.com/v1/projects/{ref}/config/auth
```

This requires a Supabase Personal Access Token (PAT), which is **not** committed to the repo and **not** exposed via MCP. To edit programmatically, the user must generate a temporary PAT — generally not worth doing for one-off changes.

**Default path for template edits:** Supabase dashboard → Authentication → Email Templates → pick template → Source view → edit → Save.

### Outlook gotcha (don't repeat)

Microsoft Outlook on Windows uses Word's rendering engine, which does not support CSS `linear-gradient` on email elements. When present, Outlook silently strips the entire `background` property — making gradient-styled buttons invisible. The current invite-user template uses a **bulletproof table-based pattern** with solid `background-color: #00A79D` (brand teal) for the CTA. Don't reintroduce gradients on email elements regardless of how good they look in Gmail/Apple Mail — UKY's Exchange is the canonical recipient and Outlook is unforgiving.

---

## Hosting

- **Vercel project slug:** `sts-bsc-manager`
- **Plan:** Pro (upgraded 2026-05-04)
- **Auto-deploy:** push to `main`
- **Aliased domains** all serve the same deployment: `bsc.ctac.app`, `ctac.app`, `sts-bsc-manager.vercel.app`
- **Framework:** Vite, root dir = `frontend`
- **SPA rewrite rule:** `frontend/vercel.json`

---

## Edge functions

**The repo is the source of truth. Edit `supabase/functions/<slug>/index.ts`, then deploy. Never edit a function in the Supabase dashboard** — a dashboard edit silently desyncs git, and the next person to deploy from the repo will overwrite it without knowing.

Until 2026-07-29 only `invite-team-leader` was committed; the other eight lived solely as deployed artifacts with no history, no diffs and no rollback. All nine are now snapshotted.

| slug | deployed version at snapshot | notes |
|---|---|---|
| `invite-team-leader` | 9 | All role invites. Repo copy was already byte-identical — no drift. |
| `send-event-email` | 3 | Trainer-composed email about one event. One send per recipient (no BCC) for per-user unsubscribe links. |
| `send-event-reminder` | 2 | Cron-driven reminders + RSVP buttons + `.ics`. |
| `mint-registration` | 4 | Public registration intake: validate, capacity/waitlist, dedupe, then fire the confirmation. |
| `send-registration-email` | 4 | Confirmation / waitlist / promoted / cancellation email + `.ics`. |
| `cancel-registration` | 3 | Public cancel by token; cancels + promotes the next waitlister atomically. |
| `send-trainer-digest` | 2 | Weekly Monday digest per trainer. |
| `send-ceu-certificate` | 3 | **Retired** — a 410 tombstone. Certificates come from the desktop Training Manager tool. Safe to delete from the dashboard; the MCP toolset can't delete functions. |
| `lookup-registration` | 2 | Token-scoped read for the cancel page, so the browser needs no SELECT on `event_registrations`. |

**The intended state is `--no-verify-jwt` on all nine** (gateway JWT check off). Each function does its own authorization: the public ones treat their token as the credential, the admin ones verify the caller's JWT and role themselves. Keep that property in mind when adding a function — with the gateway check off, an endpoint with no internal auth is world-callable.

> ✅ **All nine are `verify_jwt = false` as of 2026-07-29.** Two had drifted to `true` (`send-registration-email`, `send-event-reminder`) because **the MCP deploy tool's `verify_jwt` parameter defaults to `true`** — it is NOT absent, as this doc previously claimed; any MCP deploy that does not explicitly pass `false` flips it. Both were restored by redeploying the **exact deployed source** fetched back from Supabase (never from the repo, in case the repo lagged) with `verify_jwt: false` and nothing else changed; post-deploy sources were re-fetched and compared byte-for-byte, including em dashes, curly quotes and ICS escape sequences. Now at versions **6** and **4** respectively. **When deploying via MCP, always pass `verify_jwt: false` explicitly and re-check `list_edge_functions` afterwards.**

Deploy:

```bash
supabase functions deploy <slug> --project-ref jhnquklmwoubpbbmnrjf --no-verify-jwt
```

The CLI is **not installed on Josh's machine** (checked 2026-07-29), which is why deploys currently go through the MCP tool and hit the flag problem above.

The committed `index.ts` files are **byte-exact snapshots of what was deployed**, deliberately with no added header comments, so that a future `diff` between repo and deployed shows only real drift instead of permanent boilerplate noise. That is also why the `--no-verify-jwt` fact is recorded here rather than in each file.

Secrets these functions read from the Supabase function env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (both injected automatically) and `RESEND_API_KEY` (set manually — see the Email pipeline section).

---

## Supabase Auth allowlist

Authentication → URL Configuration:

- **Site URL:** `https://bsc.ctac.app`
- **Redirect URLs (all currently allowed):**
  - `https://bsc.ctac.app/**` (canonical, wildcard)
  - `https://sts-bsc-manager.vercel.app/set-password` (back-compat — keep until invites from old URL stop appearing in support questions)
  - `http://localhost:5173/set-password` (dev)

---

## Operational gotchas (what cannot be automated, and why)

- **Deploying an edge function via the Supabase MCP tool silently sets `verify_jwt = true`.** The tool takes no `verify_jwt` parameter, so there is no way to preserve `--no-verify-jwt` through an MCP deploy. **After every MCP deploy, check `list_edge_functions` and flip the flag back off in the dashboard** (Edge Functions → the function → Settings). Installing the Supabase CLI would remove this whole failure mode, since `--no-verify-jwt` is a CLI flag.
- **Email template edits** require dashboard work — no Supabase MCP tool covers them. See "Email templates" section above.
- **DNS record edits** require dashboard work — no Vercel MCP tool covers DNS. (Available Vercel MCP tools: deployments, projects, logs, toolbar comments, domain availability/price, docs search. No DNS create/update/delete.)
- **User-attribution rows orphan on delete** — deleting a user no longer fails (FKs are now `ON DELETE SET NULL` for `checklist_items.completed_by`, `forum_posts.created_by`, `forum_threads.created_by`, `pdsa_cycles.created_by`, `session_attendance.user_profile_id`). Orphaned forum posts render as authored by "Unknown" — frontend already handled the null case. If new tables add user-attribution columns, default them to `ON DELETE SET NULL` unless ownership is unambiguous.
- **Promoting a user to `super_admin` or `trainer_admin`** is a manual two-step. Auto-creating accounts on a user's behalf is against Claude's safety policy.
  1. In the Supabase Auth dashboard → Invite User → enter the user's email; they set a password through the standard invite flow.
  2. Once their `user_profiles` row exists, run via `execute_sql`:
     ```sql
     UPDATE user_profiles SET role = 'super_admin', is_active = true
     WHERE email = 'someone@uky.edu';
     -- or 'trainer_admin' for collaborative-scoped admins; pair with an
     -- INSERT into collaborative_trainers for each collab they should access.
     ```
  Currently confirmed super_admins: Josh (`jafish0@uky.edu`). Pending: Ginny Sprang (`sprang@uky.edu`) — invite + promote when ready.

---

## Open follow-ups

### ⬜ JOSH'S TO-DO — dashboard/UI only, cannot be automated (added 2026-07-29)

1. **Enable leaked password protection.** Supabase dashboard → **Authentication → Passwords** → turn on the HaveIBeenPwned compromised-password check. This is the last remaining item from the 2026-07-29 security pass and still appears in the Advisor as `auth_leaked_password_protection`. Extra relevant right now because the three Anchor Lab testers are on passwords that were assigned to them rather than self-chosen.
2. ~~**Set a capacity on the AWARE Year 4 TIPE LC registration link.**~~ ✅ **Done** — `capacity = 297` as of 2026-07-29.
3. **Distribute the rotated CTAC staff assessment codes** (see "CTAC staff codes" below). The old ones are dead; anyone holding them gets an invalid-code error.
4. **Create two non-super_admin test accounts** (unblocks a lot). Every account in the system is currently a super_admin, and `test@uky.edu` / `1234` documented in `CLAUDE.md` no longer authenticates, so **no team-scoped or admin-gated UI can be click-through verified by Claude Code** — that's why recent items keep shipping "verification deferred to Josh." Create one `agency_admin` and one `team_member`, both on a team in a **demo** collaborative (never the AWARE cohort). Easiest path is the app's own invite UI on a demo team, which runs `invite-team-leader` and creates the `user_profiles` row properly. A third account as `trainer_admin` would also close out the long-open role verification below. ⚠️ There is **no trigger** creating `user_profiles` from `auth.users`, so a bare Supabase dashboard invite leaves an account that cannot use the app; either use the in-app invite or insert the profile row explicitly.
5. **Turn `verify_jwt` back off for `send-registration-email` and `send-event-reminder`.** Supabase dashboard → **Edge Functions → \<function\> → Settings** → disable the JWT verification toggle. These two are the only ones of the nine currently `true`; deploying via the MCP tool flipped them and the tool DOES expose a `verify_jwt` parameter but it **defaults to `true`**, so any MCP deploy that does not explicitly pass `false` flips it (corrected 2026-07-29). Not urgent — live sends through both after the flip returned 200, because every caller presents a valid project JWT (crons use the service-role key, the admin UI uses the user session, and an anon-key call was verified to pass the gateway) — but they should match the other seven. Installing the Supabase CLI would prevent recurrence, since `--no-verify-jwt` is a CLI flag.

### ✅ Done 2026-07-29: CTAC staff assessment codes rotated

The four CTAC staff codes were **rotated** because `team_codes` was anon-enumerable until the same-day security fix (see `WORKING_NOTES.md`, security hardening pass) — anyone with the publishable key could have read them before distribution. All four had **zero responses** at rotation, so nothing was lost. Old codes (`UYWLJT`, `3AJ4HQ`, `QRC5NW`, `6H3AAR`) no longer exist.

| Timepoint | Code |
|---|---|
| Baseline | `TCD7TP` |
| Endline | `VC5975` |
| 6-month follow-up | `5AJXFP` |
| 12-month follow-up | `YH4HRJ` |

All active, expiring 2027-12-31. Staff enter them at the `bsc.ctac.app` root (TeamCodeEntry). Generated from a 31-character alphabet excluding `0 O 1 I L` so they survive being read off a slide or email. Verified after rotation: 26 total codes, 26 distinct, demo codes untouched.

- **2026-10-30 Supabase Data API grants change.** Supabase is removing the auto-grant of new `public`-schema tables to the Data API roles (`anon`, `authenticated`, `service_role`). **Existing tables keep their grants** — verified via audit on 2026-05-08 that all 41 public tables in this project are fully granted on all three roles, so nothing in production breaks at the cutover. The forward-looking change matters: every new `apply_migration` creating a `public` table that `supabase-js` (PostgREST / GraphQL / Realtime) touches must include explicit `GRANT` statements alongside RLS, otherwise `42501` errors. Pattern documented in `CLAUDE.md` → "Future migrations: explicit Data API grants" section. Re-run this audit query at any point to confirm current state:
  ```sql
  SELECT c.relname AS table_name,
         COALESCE(string_agg(DISTINCT
           CASE WHEN g.grantee IN ('anon','authenticated','service_role')
                THEN g.grantee || ':' || g.privilege_type END, ', '), '(none)') AS data_api_grants
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN information_schema.role_table_grants g
    ON g.table_schema = n.nspname AND g.table_name = c.relname
   AND g.grantee IN ('anon','authenticated','service_role')
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  GROUP BY c.relname ORDER BY c.relname;
  ```
- **Store the service-role key in Vault for reminder cron jobs.** The pg_cron jobs `day-before-reminders` and `week-before-reminders` call the `send-event-reminder` edge function via `pg_net.http_post` and need to authenticate as service-role. Until the key is stored, the cron functions log a NOTICE and silently no-op (they will not fail). To enable:
  ```sql
  -- In Supabase SQL editor, with the secret key copied from Project Settings → API:
  INSERT INTO vault.secrets (name, secret) VALUES ('service_role_key', 'eyJ...your_service_role_key...');
  -- Verify: cron will pick it up on the next firing.
  SELECT public.fire_day_before_reminders();
  ```
- **Test the day-before reminder pipeline end-to-end before relying on it in production.** Vault secret is in place (verified 2026-05-08); auth pipeline should work but hasn't been exercised against a real event yet. ⚠️ **Blocked until the reminder-pipeline draft ships** (see `WORKING_NOTES.md`, "Reminder pipeline before the Oct 27 cohort"): recipients currently resolve from team members only, and **no team has any active members**, so a test today sends zero emails and proves nothing. Also note "Demo 2026" referenced in the original version of this item **no longer exists** (wiped in the 2026-06-10 rebuild `bac319c`); use a demo collaborative that has a team with a real member. To test: (1) create a throwaway event in a demo collaborative with `event_date = tomorrow` and a populated `end_time`; (2) in the SQL editor run `SELECT public.fire_day_before_reminders();`; (3) check that a row was inserted into `event_reminder_log` and that the reminder email landed in the recipient's inbox; (4) delete the test event. If it doesn't fire, debug `vault.decrypted_secrets` lookup + `pg_net.http_post` response (visible via `SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5`).
- **Re-evaluate SMARTIE goal comments (trainer feedback feature, May 8).** Currently DEACTIVATED via `ENABLE_GOAL_COMMENTS = false` at the top of `frontend/src/pages/SmartieGoals.jsx`. The `smartie_goal_comments` table, RLS policies, `submitComment` / `deleteComment` handlers, and inline comment UI all remain in place — flipping the flag to `true` re-enables the feature instantly with no migrations needed. Open question is whether this is the right interaction model for trainer-team coaching (vs. the existing forum, or the new parking-lot tool).
<!-- Pruned 2026-06-10: registration system (`13386f9`), Active Participation Index, Resource Utilization Heatmap, and Weekly trainer summary digest (all `ed0a543`) shipped — removed from open follow-ups. -->
- **Also test the imminent reminder crons end-to-end.** The newer `hour_before` / `starting_now` crons (`fire_imminent_reminders`, shipped `2ac9993`) share the same "never exercised against a real event" gap as the day/week-before pipeline above — fold them into the same test pass.
<!-- Pruned 2026-07-29: "Invite Ginny Sprang as super_admin" — done. All three Anchor Lab testers (sprang@uky.edu, cacl231@uky.edu, larigg3@uky.edu) exist as super_admins, created 2026-07-17 directly in auth (auth.users + auth.identities + user_profiles in one transaction) rather than via the invite-then-promote flow this item described. Note for future account creation: there is NO trigger auto-creating user_profiles from auth.users — the row must be inserted explicitly, which the `invite-team-leader` edge function does and a bare dashboard invite does not. -->

- **Verify the `trainer_admin` role end-to-end with a real account.** Still genuinely untested: no `trainer_admin` account has ever existed. (The View-as "CTAC Admin" preview shipped in `b3f1da6` simulates the role in the frontend only — RLS still runs as the real super_admin, so it cannot validate the server-side scoping below.) Create the account per item 4 of Josh's to-do list above, then:
  ```sql
  UPDATE user_profiles SET role = 'trainer_admin', is_active = true
  WHERE email = '<test_trainer_email>';
  ```
  ```sql
  INSERT INTO collaborative_trainers (collaborative_id, user_id)
  SELECT '3d967456-d00b-41cf-8a12-7411b307e6b1',  -- TIPE LC Demo (a demo collab, never the AWARE cohort)
         id
  FROM user_profiles WHERE email = '<test_trainer_email>';
  ```
  Then sign in as that user and confirm:
  - `/admin/collaboratives` shows **only** their assigned collabs
  - Cross-collab tiles are hidden on AdminDashboard (Change Framework, Strategy Ideas, STS-PAT Results, Self-Rating Engagement, Project Staff, Unmatched Attendees)
  - "Create New Collaborative" button is **not** visible
  - On their collab's detail page, they can edit events/teams/goals (Edit/+Add/Delete buttons render)
  - On a collab they aren't assigned to, navigating directly to `/admin/collaboratives/<other-id>` returns no data (RLS blocks it)
- **`ctac.app` apex routing.** Currently serves BSC-Manager directly. When a CTAC landing page exists (or other programs come online), either remove the apex attachment or 307-redirect to the new project.
- **DMARC tightening.** After ~4 weeks of clean sending, change the Vercel `_dmarc` TXT record to `v=DMARC1; p=quarantine; pct=100;`. Eventually `p=reject` once confident.
- **Inbox placement monitoring.** First invite landed in UKY Outlook Junk (new-domain reputation). Trajectory should improve as recipients mark "Not Junk." If it doesn't, consider Postmark DMARC Digest or Dmarcian for aggregate report visibility.

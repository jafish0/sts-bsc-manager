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

## Supabase Auth allowlist

Authentication → URL Configuration:

- **Site URL:** `https://bsc.ctac.app`
- **Redirect URLs (all currently allowed):**
  - `https://bsc.ctac.app/**` (canonical, wildcard)
  - `https://sts-bsc-manager.vercel.app/set-password` (back-compat — keep until invites from old URL stop appearing in support questions)
  - `http://localhost:5173/set-password` (dev)

---

## Operational gotchas (what cannot be automated, and why)

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

- **Store the service-role key in Vault for reminder cron jobs.** The pg_cron jobs `day-before-reminders` and `week-before-reminders` call the `send-event-reminder` edge function via `pg_net.http_post` and need to authenticate as service-role. Until the key is stored, the cron functions log a NOTICE and silently no-op (they will not fail). To enable:
  ```sql
  -- In Supabase SQL editor, with the secret key copied from Project Settings → API:
  INSERT INTO vault.secrets (name, secret) VALUES ('service_role_key', 'eyJ...your_service_role_key...');
  -- Verify: cron will pick it up on the next firing.
  SELECT public.fire_day_before_reminders();
  ```
- **Test the day-before reminder pipeline end-to-end before relying on it in production.** Vault secret is in place (verified 2026-05-08); auth pipeline should work but hasn't been exercised against a real event yet. To test: (1) create a throwaway event in Demo 2026 with `event_date = tomorrow` and a populated `end_time`; (2) in the SQL editor run `SELECT public.fire_day_before_reminders();`; (3) check that a row was inserted into `event_reminder_log` and that the reminder email landed in Josh's inbox (Josh is a member of the Demo 2026 team); (4) delete the test event. If it doesn't fire, debug `vault.decrypted_secrets` lookup + `pg_net.http_post` response (visible via `SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5`).
- **Reminder system: T-1 hour and T-0 reminders not yet wired.** The send-event-reminder edge function supports them (`reminder_type`: `hour_before`, `starting_now`) but no pg_cron job triggers them yet because hour-before timing requires a per-event schedule, not a daily fixed time. Possible approach: a 5-minute cron that finds events whose `start_time + 0/-60min` falls within the next 5 min window. Defer until day_before reminders are validated in production.
- **Re-evaluate SMARTIE goal comments (trainer feedback feature, May 8).** Currently DEACTIVATED via `ENABLE_GOAL_COMMENTS = false` at the top of `frontend/src/pages/SmartieGoals.jsx`. The `smartie_goal_comments` table, RLS policies, `submitComment` / `deleteComment` handlers, and inline comment UI all remain in place — flipping the flag to `true` re-enables the feature instantly with no migrations needed. Open question is whether this is the right interaction model for trainer-team coaching (vs. the existing forum, or the new parking-lot tool).
- **Build the registration system (#7 in user's May 8 request).** Public `/register/:event_token` form, `event_registrations` table with capacity + waitlist, confirmation email with `.ics` attachment, and tokenized "Cancel my enrollment" link. ~60+ minutes of focused work; deserves its own dedicated plan.
- **Active Participation Index widget for TrainerDashboard.** Composite metric blending forum post frequency, SMARTIE goal updates, and checklist completion rates per team.
- **Resource Utilization Heatmap.** Track downloads from `resources` (and possibly `bsc_event_documents`) and show which STSI-OA domains are getting the most engagement.
- **Weekly trainer summary edge function.** Cron-driven email digest at Monday 9 AM ET listing each assigned collab's progress for the prior week (new goals, completed PDSAs, recent evaluation responses, parking-lot items).
- **Invite Ginny Sprang as super_admin.** In Supabase Auth dashboard → Invite User → `sprang@uky.edu`. After she sets her password and `user_profiles` auto-creates, run:
  ```sql
  UPDATE user_profiles SET role = 'super_admin', is_active = true
  WHERE email = 'sprang@uky.edu';
  ```
- **Stand up a test `trainer_admin` and verify the role works end-to-end.** Same invite flow as above, then:
  ```sql
  UPDATE user_profiles SET role = 'trainer_admin', is_active = true
  WHERE email = '<test_trainer_email>';

  INSERT INTO collaborative_trainers (collaborative_id, user_id)
  SELECT 'aa91e6ec-c3a5-4eaf-a1ad-4af8af984299',  -- Demo 2026
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

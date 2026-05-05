# STS-BSC Manager — Production Infrastructure

Living doc of the live production stack: domains, DNS, email, hosting, and the integration points between them. Complements `CLAUDE.md` (which covers code conventions and database schema). Update this when infrastructure changes; don't let it go stale.

**Last updated:** 2026-05-05 — FK constraints to `user_profiles.id` now `ON DELETE SET NULL` (resend-invite flow no longer breaks on users with attendance/forum history). Earlier on 2026-05-04: initial migration from `sts-bsc-manager.vercel.app` to `bsc.ctac.app`, custom SMTP via Resend, full email auth (SPF + DKIM + DMARC).

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

---

## Open follow-ups

- **`ctac.app` apex routing.** Currently serves BSC-Manager directly. When a CTAC landing page exists (or other programs come online), either remove the apex attachment or 307-redirect to the new project.
- **DMARC tightening.** After ~4 weeks of clean sending, change the Vercel `_dmarc` TXT record to `v=DMARC1; p=quarantine; pct=100;`. Eventually `p=reject` once confident.
- **Inbox placement monitoring.** First invite landed in UKY Outlook Junk (new-domain reputation). Trajectory should improve as recipients mark "Not Junk." If it doesn't, consider Postmark DMARC Digest or Dmarcian for aggregate report visibility.

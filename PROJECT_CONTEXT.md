# STS-BSC Manager — Complete Project Documentation

**Last Updated:** April 8, 2026
**Repository:** https://github.com/jafish0/sts-bsc-manager
**Live URL:** https://sts-bsc-manager.vercel.app/
**Supabase Project:** jhnquklmwoubpbbmnrjf

---

## Project Overview

The STS-BSC Manager is a web application built for the **Center on Trauma and Children (CTAC)** at the University of Kentucky. It supports the management of **Secondary Traumatic Stress Breakthrough Series Collaboratives (STS-BSC)** — structured improvement programs where teams of frontline workers address secondary traumatic stress in their organizations.

### What the App Does

1. **Collects assessments** from frontline staff (anonymously via team codes)
2. **Visualizes data** with charts and reports for team leaders and CTAC admins
3. **Manages collaboratives** — creating cohorts, adding teams, tracking progress
4. **Supports improvement work** — SMARTIE goals, resource library, team forums
5. **Handles user management** — inviting team leaders, role-based access

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19.1 + Vite 7.1 |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) |
| Server Functions | Supabase Edge Functions (Deno/TypeScript) |
| Routing | React Router v7 |
| Charts | Recharts 3.8 |
| PDF Export | jspdf + jspdf-autotable |
| Excel Export | xlsx (SheetJS) |
| Hosting | Vercel (auto-deploy from GitHub main branch) |
| Styling | Inline styles (no CSS framework) |

### Brand Colors
- **Navy:** `#0E1F56` — Headers, primary UI
- **Teal:** `#00A79D` — Accents, buttons, highlights

---

## User Roles

| Role | Access | Dashboard |
|------|--------|-----------|
| `super_admin` | Full system access. Manages all collaboratives, teams, resources, forums. Can moderate and export. | AdminDashboard |
| `agency_admin` | Team leader. Manages their team's goals, views their team's reports, accesses their collaborative's forum and resources. | TeamDashboard |
| `team_leader` | Same as agency_admin (legacy role name). | TeamDashboard |
| `team_member` | (Future) Read-only access to team dashboard, resources, and forum. | TeamDashboard |

---

## Features

### 1. Assessment Suite

Four validated instruments collected anonymously via team codes. 92 total questions.

**Assessment Flow:**
```
Team Code Entry → Demographics → STSS → ProQOL → STSI-OA → Completion
```

Each team gets 4 unique codes (one per timepoint: Baseline, Endline, 6-Month, 12-Month). Staff enter a code to begin. Data is anonymous — no names or emails collected.

#### Demographics (17 questions)
- Gender, age, years in service, job role
- Areas of responsibility (multi-select)
- Trauma exposure level (0-100 slider)

#### STSS — Secondary Traumatic Stress Scale (17 questions)
- Measures STS symptoms
- DSM-5 4-factor subscales: Intrusion (5 items), Avoidance (4), Negative Cognitions & Mood (4), Arousal (4)
- 5-point Likert scale (1=Never to 5=Very Often)
- Copyright: Brian E. Bride (1999)

#### ProQOL — Professional Quality of Life Scale (30 questions)
- Three subscales: Compassion Satisfaction, Burnout, Secondary Trauma
- 5-point Likert scale (1=Never to 5=Very Often)
- Reverse-scored items: 1, 4, 15, 17, 29
- Copyright: Beth Hudnall Stamm (2009)

#### STSI-OA — STS-Informed Organizational Assessment (37 questions, 6 domains)
- Domain 1: Promotion of Resilience Building Activities
- Domain 2: Sense of Safety
- Domain 3: Organizational Policies
- Domain 4: Practices of Leaders
- Domain 5: Routine Organizational Practices
- Domain 6: Evaluation and Monitoring
- 6-point scale (0=N/A, 1=Not at all to 5=Completely)
- Multi-page form with Previous/Next navigation per domain
- Copyright: Sprang, et al. (2017)

**Session Management:** Uses `sessionStorage` to pass `teamCodeId` and `assessmentResponseId` between pages. Cleared on completion.

---

### 2. Authentication & User Management

- **Login** — Supabase Auth with email/password
- **Forgot Password** — Sends reset email via `supabase.auth.resetPasswordForEmail()`
- **Set Password** — Handles both invite tokens (`type=invite`) and recovery tokens (`type=recovery`) via URL hash detection in `AuthRedirectHandler`
- **Invite Team Leaders** — Super admins invite via `invite-team-leader` Edge Function, which creates the auth user + user_profiles row and sends an invite email
- **Role-based routing** — `DashboardRouter` component routes to AdminDashboard or TeamDashboard based on `profile.role`
- **Protected routes** — `ProtectedRoute` component checks auth, supports `requireSuperAdmin` prop

---

### 3. Collaborative & Team Management

- **Create collaboratives** — Name, description, date range, status
- **Add teams** — Team name, agency name, contact info. Auto-generates 4 team codes (one per timepoint)
- **Invite team leaders** — Email invitation flow with auto-created user profile
- **Team codes** — Format: `XXXXXX-XXXXXX-TIMEPOINT`. Copy-to-clipboard. Active/inactive toggle.
- **Team customization** — Team leaders can set display name and motto

---

### 4. Data Visualization & Reports

#### Completion Tracking (`/admin/completion`)
- Shows assessment completion rates across teams and timepoints
- Filterable by collaborative
- Color-coded progress indicators

#### Data Visualization (`/admin/data-visualization`)
- Charts for demographics, STSS, ProQOL, and STSI-OA
- Filter by collaborative, timepoint, and team
- Uses Recharts (bar charts, pie charts)
- Export to Excel (multi-sheet workbook)

#### Team Reports (`/admin/team-report/:teamId`)
- Longitudinal view of a single team's data across timepoints
- Mean scores with standard deviations
- STSS subscale breakdowns, ProQOL subscales, STSI-OA domain scores
- Export to Excel and branded PDF (with CTAC/UK logos)

---

### 5. SMARTIE Goals (`/admin/smartie-goals/:teamId`)

Teams set improvement goals using the SMARTIE framework:
- **S**trategic — What do you hope to accomplish?
- **M**easurable — How will you know if successful?
- **A**mbitious — What challenges do you anticipate?
- **R**ealistic — Where are your opportunities?
- **T**ime-bound — Timeline and deadline
- **I**nclusive — How does this bring excluded people into decision-making?
- **E**quitable — How does this address systemic injustice?

Goals are linked to STSI-OA domains. Status tracking (active/completed/archived) with progress notes.

---

### 6. Resource Library (`/admin/resources`)

Global library of guides, tools, and videos organized by the 6 STSI-OA domains.

**Resource types:**
- PDF, Word (.doc/.docx), PowerPoint (.pptx) — uploaded to Supabase Storage, downloaded via signed URLs
- YouTube videos — embedded iframe player
- External links — opens in new tab

**Features:**
- Multi-domain assignment (a resource can appear under multiple domain tabs)
- Super admins: upload new resources, delete existing ones
- All users: browse and download
- 73 resources pre-loaded from CTAC's Basecamp exports

---

### 7. Community Forum (`/admin/forum`)

Per-collaborative discussion forum for teams to share strategies and experiences.

**Features:**
- Threads scoped to each learning collaborative (not global)
- Any authenticated user can create threads and reply
- Authors can edit/delete their own content
- Super admins can delete any post and pin/unpin threads
- Pinned threads sort to top, then by most recent activity
- Search by thread title
- Load-more pagination (20 threads, 50 posts per page)
- Author initials avatars with team/agency name display

**Super admin view:** Dropdown to switch between collaboratives
**Team user view:** Auto-scoped to their collaborative

---

## Database Schema

### Core Tables

```
collaboratives
├── id (uuid, PK)
├── name, description, status (active/completed)
├── start_date, end_date
├── baseline_window_start/end, endline_window_start/end
├── followup_6mo_window_start/end, followup_12mo_window_start/end
└── created_at, updated_at

teams
├── id (uuid, PK)
├── collaborative_id (FK → collaboratives)
├── team_name, agency_name, display_name, motto
├── contact_name, contact_email, contact_phone
└── created_at, updated_at

team_codes
├── id (uuid, PK)
├── team_id (FK → teams)
├── code (unique, format: XXXXXX-XXXXXX-TIMEPOINT)
├── timepoint (baseline/endline/followup_6mo/followup_12mo)
├── active (boolean), expires_at, access_count
└── created_at, updated_at

user_profiles
├── id (uuid, PK, = auth.users.id)
├── email, full_name, role (super_admin/agency_admin/team_leader)
├── team_id (FK → teams), is_active
└── created_at, updated_at
```

### Assessment Tables

```
assessment_responses (junction table — all assessments link here)
├── id (uuid, PK)
├── team_code_id (FK → team_codes)
├── timepoint (copied from team_codes)
├── is_complete, demographics_complete, stss_complete, proqol_complete, stsioa_complete
├── started_at, completed_at
└── session_id, ip_address, user_agent

demographics
├── assessment_response_id (FK → assessment_responses)
├── gender (M/F/NB/not_listed), age, years_in_service
├── job_role, areas_of_responsibility (jsonb array)
└── exposure_level (0-100)

stss_responses
├── assessment_response_id (FK → assessment_responses)
├── item_1 through item_17 (integer 1-5)
└── intrusion_score, avoidance_score, arousal_score, total_score

proqol_responses
├── assessment_response_id (FK → assessment_responses)
├── item_1 through item_30 (integer 1-5)
├── compassion_satisfaction_score, burnout_score, secondary_trauma_score
└── compassion_satisfaction_tscore, burnout_tscore, secondary_trauma_tscore

stsioa_responses
├── assessment_response_id (FK → assessment_responses)
├── item_1 through item_37 (integer 0-5)
└── domain scores + total_score
```

### Feature Tables

```
smartie_goals
├── id (uuid, PK)
├── team_id (FK → teams)
├── goal_title, stsioa_domain, rationale
├── strategic, measurable, ambitious, realistic, time_bound, inclusive, equitable
├── status (active/completed/archived), progress_notes, target_date
└── created_at, updated_at

resources
├── id (uuid, PK)
├── title, description
├── domains (text[] — e.g. {'resilience','safety'})
├── resource_type (pdf/docx/doc/pptx/youtube/link)
├── file_path, file_name (for uploaded files)
├── youtube_url, link_url (for embeds/links)
└── created_at

forum_threads
├── id (uuid, PK)
├── collaborative_id (FK → collaboratives)
├── title, body, created_by (FK → user_profiles)
├── last_reply_at, reply_count, is_pinned
└── created_at, updated_at

forum_posts
├── id (uuid, PK)
├── thread_id (FK → forum_threads)
├── body, created_by (FK → user_profiles)
├── is_edited
└── created_at, updated_at
```

### Database Functions & Triggers

| Function | Purpose |
|----------|---------|
| `is_super_admin()` | SECURITY DEFINER — checks if current user is super_admin (bypasses RLS) |
| `user_collaborative_id()` | SECURITY DEFINER — returns the collaborative_id for the current user's team |
| `update_thread_reply_stats()` | Trigger on forum_posts INSERT/DELETE — updates reply_count and last_reply_at |
| `forum_set_updated_at()` | Trigger on forum table UPDATE — sets updated_at and is_edited flag |

### RLS Policy Summary

- **Assessment tables:** Public insert (anonymous), authenticated select
- **Collaboratives/teams:** Authenticated read, super_admin write
- **User profiles:** Users see own, super_admins see all (via `is_super_admin()`)
- **Resources:** Authenticated read, super_admin write
- **Forum threads:** Users see their collaborative's threads, super_admins see all
- **Forum posts:** Scoped through parent thread's collaborative

---

## File Structure

```
sts-bsc-manager/
├── CLAUDE.md                    — Instructions for Claude Code
├── PROJECT_CONTEXT.md           — This file
├── .env                         — Supabase URL + anon key (not committed)
│
├── frontend/
│   ├── vercel.json              — SPA rewrite rule
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx              — Routes + AuthRedirectHandler + DashboardRouter
│       ├── main.jsx             — Entry point
│       ├── assets/
│       │   ├── CTAC_white.png
│       │   ├── UKCTAC_logoasuite_web__primary_tagline_color.png
│       │   └── UK_Lockup-286.png
│       ├── components/
│       │   ├── ProtectedRoute.jsx
│       │   ├── AddTeamModal.jsx
│       │   ├── CreateCollaborativeModal.jsx
│       │   ├── InviteTeamLeaderModal.jsx
│       │   ├── AddResourceModal.jsx
│       │   └── SmartieGoalForm.jsx
│       ├── config/
│       │   ├── demographics.js
│       │   ├── stss.js
│       │   ├── proqol.js
│       │   └── stsioa.js
│       ├── contexts/
│       │   └── AuthContext.jsx
│       ├── pages/
│       │   ├── TeamCodeEntry.jsx
│       │   ├── Demographics.jsx
│       │   ├── STSS.jsx
│       │   ├── ProQOL.jsx
│       │   ├── STSIOA.jsx
│       │   ├── AssessmentComplete.jsx
│       │   ├── Login.jsx
│       │   ├── SetPassword.jsx
│       │   ├── AdminDashboard.jsx
│       │   ├── TeamDashboard.jsx
│       │   ├── CollaborativesList.jsx
│       │   ├── CollaborativeDetail.jsx
│       │   ├── CompletionTracking.jsx
│       │   ├── DataVisualization.jsx
│       │   ├── TeamReport.jsx
│       │   ├── SmartieGoals.jsx
│       │   ├── Resources.jsx
│       │   ├── ForumThreadList.jsx
│       │   └── ForumThread.jsx
│       ├── styles/               — CSS files for assessment pages
│       └── utils/
│           ├── supabase.js
│           ├── constants.js
│           ├── reportDataLoader.js
│           ├── exportExcel.js
│           └── exportPdf.js
│
├── supabase/
│   ├── config.toml
│   └── functions/
│       └── invite-team-leader/
│           └── index.ts
│
└── scripts/
    └── preload-resources.mjs    — Bulk-loads resources from zip exports
```

---

## Route Map

| Path | Component | Access | Purpose |
|------|-----------|--------|---------|
| `/` | TeamCodeEntry | Public | Assessment entry via team code |
| `/demographics` | Demographics | Public | Demographics form |
| `/stss` | STSS | Public | STSS assessment |
| `/proqol` | ProQOL | Public | ProQOL assessment |
| `/stsioa` | STSIOA | Public | STSI-OA assessment |
| `/complete` | AssessmentComplete | Public | Completion confirmation |
| `/login` | Login | Public | User login |
| `/set-password` | SetPassword | Public | Invite/recovery token handler |
| `/admin` | DashboardRouter | Protected | Routes to Admin or Team dashboard |
| `/admin/collaboratives` | CollaborativesList | Protected | Manage collaboratives |
| `/admin/collaboratives/:id` | CollaborativeDetail | Protected | Collaborative detail + teams |
| `/admin/completion` | CompletionTracking | Protected | Assessment completion rates |
| `/admin/data-visualization` | DataVisualization | Protected | Charts and data export |
| `/admin/team-report/:teamId` | TeamReport | Protected | Single team longitudinal report |
| `/admin/smartie-goals/:teamId` | SmartieGoals | Protected | Team improvement goals |
| `/admin/resources` | Resources | Protected | Resource library by domain |
| `/admin/forum` | ForumThreadList | Protected | Forum thread list |
| `/admin/forum/:threadId` | ForumThread | Protected | Thread detail + replies |

---

## Deployment

### Vercel
- Project: `sts-bsc-manager`
- URL: `https://sts-bsc-manager.vercel.app/`
- Auto-deploys from GitHub `main` branch
- Root directory: `frontend`
- Framework: Vite
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Supabase
- Project ref: `jhnquklmwoubpbbmnrjf`
- Region: (check dashboard)
- Edge Functions deployed via `npx supabase functions deploy <name> --no-verify-jwt`
- Storage bucket: `resources` (private)
- Auth redirect URLs configured for both localhost and Vercel domain

### Development
```bash
cd frontend
npm run dev          # Starts Vite dev server on :5173
```

---

## Score Calculations Reference

### STSS Subscales (DSM-5 4-factor model)
- **Intrusion:** Items 2, 3, 6, 10, 13 (range 5-25)
- **Avoidance:** Items 1, 9, 12, 14 (range 4-20)
- **Negative Cognitions & Mood:** Items 5, 7, 11, 17 (range 4-20)
- **Arousal:** Items 4, 8, 15, 16 (range 4-20)
- **Total:** Sum of all 17 items (range 17-85)

### ProQOL Subscales
- **Compassion Satisfaction:** Items 3, 6, 12, 16, 18, 20, 22, 24, 27, 30
- **Burnout:** Items 1*, 4*, 8, 10, 15*, 17*, 19*, 21, 26, 27 (*reverse scored: 6 - value)
- **Secondary Trauma:** Items 2, 5, 7, 9, 11, 13, 14, 23, 25, 28

### STSI-OA Domain Max Scores
- Domain 1 (Resilience): 28
- Domain 2 (Safety): 28
- Domain 3 (Policies): 24
- Domain 4 (Leadership): 24
- Domain 5 (Routine Practices): 44
- Domain 6 (Evaluation): 44
- **Total:** 200

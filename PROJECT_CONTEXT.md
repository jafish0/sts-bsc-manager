# STS-BSC Manager — Complete Project Documentation

**Last Updated:** April 9, 2026
**Repository:** https://github.com/jafish0/sts-bsc-manager
**Live URL:** https://bsc.ctac.app/
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
| Styling | Inline styles + CSS custom properties (no CSS framework). Dark mode via `[data-theme="dark"]` |

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
| `team_member` | Read-only access to team dashboard, resources, and forum. Can view but not edit SMARTIE goals, checklists, or team settings. | TeamDashboard |

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

**localStorage Auto-Save:** All assessment pages (Demographics, STSS, ProQOL, STSIOA) save answers to `localStorage` with `sts_` prefix. Restores on mount so users can resume after browser close. `AssessmentComplete` clears all 7 keys. Demographics checks for existing `sts_assessmentResponseId` to avoid duplicate DB records.

---

### 2. Authentication & User Management

- **Login** — Supabase Auth with email/password
- **Forgot Password** — Sends reset email via `supabase.auth.resetPasswordForEmail()`
- **Set Password** — Handles both invite tokens (`type=invite`) and recovery tokens (`type=recovery`) via URL hash detection in `AuthRedirectHandler`
- **Invite Users** — Super admins and agency admins invite via `invite-team-leader` Edge Function (generalized to handle all roles). Creates auth user + user_profiles row and sends invite email. Supports `role` param (`agency_admin`, `team_leader`, `team_member`), `agency_role`, `is_senior_leader`, and `resend` for re-sending invites.
- **Role-based routing** — `DashboardRouter` component routes to AdminDashboard or TeamDashboard based on `profile.role`
- **Protected routes** — `ProtectedRoute` component checks auth, supports `requireSuperAdmin` prop
- **Team Members page** — `/admin/team/:teamId/members` shows roster with pending/active status, invite modal with access level selector, and resend invite capability

---

### 3. Collaborative & Team Management

- **Create collaboratives** — Name, description, date range, status
- **Add teams** — Team name, agency name, contact info. Auto-generates 4 team codes (one per timepoint). Seeds checklist items for new teams.
- **Invite team leaders** — Email invitation flow with auto-created user profile
- **Invite team members** — Agency admins can invite members to their own team with role selection (View Only or Full Access), agency role, and senior leader designation
- **BSC Events** — Track Learning Sessions and custom events per collaborative. LS dates drive phase calculations and assessment window auto-population.
- **Team codes** — Format: `XXXXXX-XXXXXX-TIMEPOINT`. Copy-to-clipboard. Active/inactive toggle.
- **Team customization** — Team leaders can set display name and motto
- **Phase Timeline** — Horizontal stepper on TeamDashboard showing 8 BSC phases, calculated from Learning Session dates
- **Phase Checklists** — Per-phase activity checklists with auto-detection badges and manual toggles

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
- K-anonymity threshold (n < 5) suppresses demographic breakdowns with privacy notice
- STSI-OA Office Visual with building frame image overlay
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
- 79 resources loaded from CTAC's Basecamp exports (72 original + 7 added 2026-04-09 from Basecamp 2026 zip)

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

### 8. Change Framework (`/admin/change-framework`)

Displays the collaborative improvement framework organized by the 6 STSI-OA domains.

**Features:**
- Domain tabs with item counts
- Primary and secondary driver display per domain
- Super admin inline editing, add, delete drivers

---

### 9. Staff Directory (`/admin/staff`)

Professional directory of BSC faculty and support team.

**Features:**
- Professional cards with initials avatar, bio expand/collapse, mailto links
- Super admin CRUD via AddStaffModal
- Collaborative filtering (global staff vs collaborative-specific)

---

### 10. Team Members (`/admin/team/:teamId/members`)

Team roster management page for agency admins and super admins.

**Features:**
- Summary stats (total members, leaders, team members, senior leaders)
- Member cards with role badges, agency role, senior leader designation
- **Pending/Active status** — tracks whether invited users have accepted and logged in via `invite_accepted_at` column
- **Invite modal** — Name, email, agency role, senior leader checkbox, access level dropdown (View Only vs Full Access)
- **Resend invite** — for pending members, deletes and re-creates the invite with a fresh token
- **Remove member** — deactivates (soft delete) team members

---

### 11. Phase Timeline & Checklists (TeamDashboard)

**Phase Timeline:**
- Horizontal stepper showing 8 BSC phases (Pre-Work through Sustainability)
- Current phase highlighted with glow effect, past phases filled, future phases outlined
- Phase calculated from BSC Learning Session dates via `phaseCalculator.js`
- Next event card with countdown

**Phase Checklists:**
- Per-phase activity items with progress bar
- Auto-detection badges for items that can be verified from existing data (e.g., "Has SMARTIE goals" checks if goals exist)
- Manual toggle for items that need human confirmation
- "Go" navigation links to related pages
- Read-only for `team_member` role

---

### 12. STSI-OA Office Visual (DataVisualization)

Color-coded organizational assessment visual at the bottom of the Data Visualization page, designed to resemble a building/office matching CTAC's reference PowerPoint layout.

**Features:**
- Building frame background image (`office-frame.jpg`) with color-coded assessment cells overlaid using absolute positioning
- Percentage-based `ROOM_REGIONS` coordinate map for 6 domain rooms
- Per-item mean score calculation (excluding N/A responses)
- Score-to-color mapping: 4-5=green, 3-4=yellow, 2-3=orange, 1-2=red, no data=gray
- Responsive font sizing via `clamp()` CSS function
- Hover tooltips with full item text, mean, count, color category
- Color key legend
- Domain cell layouts: D1(4+3), D2(3+1+3), D3(4+2), D5(3+3+1), D4(2+4+3), D6(4 vertical)

**Status:** Working but awaiting new 2560×1440 building frame image for better room spacing.

---

### 13. Supervisor Self-Rating Tool (`/admin/supervisor-self-rating`)

Private self-assessment for supervisors to rate their STS-informed leadership competencies.

**Architecture:**
- Strict user-only RLS: `auth.uid() = user_id` — no admin access to individual scores
- Aggregate stats only via SECURITY DEFINER function `get_self_rating_completion_stats()`

**4 Competency Areas (20 rated items + 5 discussion prompts):**
1. STS Knowledge & Support (5 rated)
2. Self-Assessment & Management (3 rated + 2 discussion)
3. Emotional Safety & Sharing (7 rated)
4. Resilience & Compassion (5 rated + 3 discussion)

**Features:**
- 4 tabs: Welcome, Self-Rating, My Results, Resources
- 3-point developmental scale: Beginning (1), Developing (2), Accomplished (3)
- Auto-save with 300ms debounce via upsert on `(user_id, competency_key, item_key)` unique constraint
- Radar chart showing competency scores
- Growth-over-time LineChart comparing historical snapshots
- PDF export with competency bars, detailed tables, growth opportunities
- Guidance/strategies/resources per competency in accordion sections

**DB Tables:** `supervisor_self_ratings`, `supervisor_self_rating_responses`

---

### 14. Session Attendance & Evaluation System

Public-facing system for BSC Learning Session sign-in, evaluation, and reporting.

**Public Flow:**
```
/session/:token → Sign In → /session/:token/eval → Evaluation → /session/:token/signout → Sign Out
```

**Session Links:**
- Generated per BSC event via CollaborativeDetail
- Random 8-char alphanumeric tokens (crypto.getRandomValues)
- Expire at 4PM EST (9PM UTC) on event date
- Can be deactivated early ("Close Session")

**Sign-In (SessionSignIn.jsx):**
- Form: name, email, role (team_member, agency_admin, senior_leader, other)
- Auto-match by email in user_profiles (case-insensitive)
- Creates `unmatched_attendees` if no match, with domain-based team suggestion
- Stores `attendance_${token}` in sessionStorage

**Evaluation (SessionEvaluation.jsx):**
- Structurally anonymous: session_evaluations has NO FK to users or attendance
- 6 Likert items (1-5, required), 3 open text (2 required, 1 optional), NPS 0-10 (optional)
- Links only to bsc_event_id + collaborative_id

**Sign-Out (SessionSignOut.jsx):**
- Updates session_attendance.signed_out_at
- Clears sessionStorage

**Reports (admin-facing):**
- AttendanceReport component: summary stats, table with duration calc, PDF/Excel export, teamFilter prop
- EvaluationReport component: mean/SD per item, horizontal BarCharts, NPS distribution, open text responses
- Both accessible from CollaborativeDetail and TeamDashboard

**Unmatched Attendees (AdminDashboard):**
- Shows pending unmatched attendees with suggested teams
- Dismiss button for resolved cases

**DB Tables:** `session_links`, `session_attendance`, `session_evaluations`, `unmatched_attendees`

---

### 15. PDSA Cycles (`/admin/pdsa/:teamId`)

Plan-Do-Study-Act improvement cycles linked to teams.

---

### 16. Data Recommendations (`/admin/recommendations/:teamId`)

Data-driven recommendations based on team assessment results.

---

### 17. Strategy Ideas (`/admin/strategies`)

Strategy library for improvement work.

---

### 18. STS-PAT (`/admin/sts-pat/:teamId` & `/admin/sts-pat-overview`)

STS Program Assessment Tool for evaluating organizational STS programs.

---

### 20. K-Anonymity Privacy Threshold

Prevents re-identification of small groups in demographic breakdowns.

**Features:**
- `K_ANONYMITY_THRESHOLD = 5` constant in `constants.js`
- DataVisualization suppresses demographic breakdowns (gender, age, job role pies, exposure, STSIOA by job role) when n < 5
- TeamReport suppresses demographics summary when n < 5
- Privacy notice explaining why data is hidden when threshold not met

---

### 21. Dark Mode

System-wide dark mode toggle with persistent preference.

**Features:**
- `ThemeContext` with `localStorage` persistence (`sts_theme` key)
- CSS custom properties in `index.css` (`:root` for light, `[data-theme="dark"]` for dark)
- `ThemeToggle` floating button (bottom-right) added via `ProtectedRoute`
- All 13 admin pages converted to use CSS variables for colors

---

### 22. Smart Recommendations (TeamDashboard)

Surfaces targeted resources based on a team's weakest STSI-OA domains.

**Features:**
- Computes STSI-OA domain scores for latest timepoint
- Identifies 2 weakest domains
- Shows matched resources from DB for those domains
- "Set a SMARTIE Goal" button links to SmartieGoals with `?domain=` param for pre-fill
- `SmartieGoalForm` accepts `initialDomain` prop

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
├── email, full_name
├── role (super_admin/agency_admin/team_leader/senior_leader/team_member)
├── team_id (FK → teams), is_active
├── agency_role (text — e.g. "Case Manager", "Therapist")
├── is_senior_leader (boolean, default false)
├── invite_accepted_at (timestamptz — null = pending, set on first login)
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

bsc_events
├── id (uuid, PK)
├── collaborative_id (FK → collaboratives)
├── event_type (learning_session/all_team_call/custom)
├── title, event_date, event_time, location
└── created_at

bsc_staff
├── id (uuid, PK)
├── full_name, title_credentials, role_title, organization
├── bio, email, phone
├── collaborative_id (nullable — null = global)
├── sort_order, is_active
└── created_at, updated_at

change_framework_drivers
├── id (uuid, PK)
├── collaborative_id (FK → collaboratives)
├── domain, driver_type (primary/secondary)
├── title, description
└── created_at, updated_at

checklist_items
├── id (uuid, PK)
├── team_id (FK → teams)
├── phase_key, label, sort_order
├── is_completed, completed_at, completed_by
├── is_auto (boolean — auto-detected items)
└── created_at
```

### Supervisor Self-Rating Tables

```
supervisor_self_ratings
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users) — RLS: auth.uid() = user_id ONLY
├── competency_key (text)
├── score (numeric)
├── max_score (numeric)
├── rated_at (timestamptz)
└── created_at, updated_at

supervisor_self_rating_responses
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users) — RLS: auth.uid() = user_id ONLY
├── competency_key (text)
├── item_key (text)
├── rating (integer 1-3)
├── UNIQUE(user_id, competency_key, item_key)
└── created_at, updated_at
```

### Session Attendance & Evaluation Tables

```
session_links
├── id (uuid, PK)
├── bsc_event_id (FK → bsc_events)
├── collaborative_id (FK → collaboratives)
├── token (text, unique) — 8-char alphanumeric
├── is_active (boolean)
├── expires_at (timestamptz) — 4PM EST on event date
└── created_at

session_attendance
├── id (uuid, PK)
├── bsc_event_id (FK → bsc_events)
├── collaborative_id (FK → collaboratives)
├── user_profile_id (FK → user_profiles, nullable)
├── attendee_name, attendee_email, attendee_role
├── team_id (FK → teams, nullable)
├── signed_in_at, signed_out_at
└── created_at

session_evaluations (structurally anonymous — NO FK to users or attendance)
├── id (uuid, PK)
├── bsc_event_id (FK → bsc_events)
├── collaborative_id (FK → collaboratives)
├── content_relevance, presenter_effectiveness, group_discussion_quality
├── actionable_takeaways, overall_satisfaction, learning_objectives_met (integer 1-5)
├── most_valuable, improvements, additional_comments (text)
├── recommend_score (integer 0-10, NPS)
└── submitted_at

unmatched_attendees
├── id (uuid, PK)
├── session_attendance_id (FK → session_attendance)
├── attendee_name, attendee_email
├── suggested_team_id (FK → teams, nullable)
├── status (pending/matched/dismissed)
└── created_at
```

### Database Functions & Triggers

| Function | Purpose |
|----------|---------|
| `is_super_admin()` | SECURITY DEFINER — checks if current user is super_admin (bypasses RLS) |
| `user_collaborative_id()` | SECURITY DEFINER — returns the collaborative_id for the current user's team |
| `user_team_id()` | SECURITY DEFINER — returns the team_id for the current user (bypasses RLS) |
| `update_thread_reply_stats()` | Trigger on forum_posts INSERT/DELETE — updates reply_count and last_reply_at |
| `forum_set_updated_at()` | Trigger on forum table UPDATE — sets updated_at and is_edited flag |
| `get_self_rating_completion_stats()` | SECURITY DEFINER — returns aggregate self-rating completion counts (no individual data) |

### RLS Policy Summary

- **Assessment tables:** Public insert (anonymous), authenticated select
- **Collaboratives/teams:** Authenticated read, super_admin write
- **User profiles:** Users see own + own team's profiles (via `user_team_id()`), super_admins see all (via `is_super_admin()`)
- **Teams:** Users see own team (via `user_team_id()`), super_admins see all
- **Resources:** Authenticated read, super_admin write
- **Forum threads:** Users see their collaborative's threads, super_admins see all
- **Forum posts:** Scoped through parent thread's collaborative
- **Supervisor self-ratings:** Strict user-only (`auth.uid() = user_id`) — no admin bypass
- **Session links:** Public read (for token validation), authenticated write
- **Session attendance:** Public insert (anonymous sign-in), authenticated read
- **Session evaluations:** Public insert (anonymous), authenticated read
- **Unmatched attendees:** Super admin read/update

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
│       │   ├── UK_Lockup-286.png
│       │   └── office-frame.jpg         — STSI-OA building frame background
│       ├── components/
│       │   ├── ProtectedRoute.jsx
│       │   ├── AddTeamModal.jsx
│       │   ├── AddStaffModal.jsx
│       │   ├── CreateCollaborativeModal.jsx
│       │   ├── InviteTeamLeaderModal.jsx
│       │   ├── InviteTeamMemberModal.jsx
│       │   ├── AddResourceModal.jsx
│       │   ├── SmartieGoalForm.jsx
│       │   ├── ThemeToggle.jsx          — Floating dark mode toggle button
│       │   ├── AttendanceReport.jsx     — Session attendance report with PDF/Excel export
│       │   └── EvaluationReport.jsx     — Session evaluation report with charts
│       ├── config/
│       │   ├── demographics.js
│       │   ├── stss.js
│       │   ├── proqol.js
│       │   ├── stsioa.js
│       │   ├── supervisorSelfRating.js  — Self-rating competencies, items, resources
│       │   └── evaluationQuestions.js   — Session evaluation Likert + open text config
│       ├── contexts/
│       │   ├── AuthContext.jsx
│       │   └── ThemeContext.jsx          — Dark mode toggle with localStorage persistence
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
│       │   ├── ForumThread.jsx
│       │   ├── ChangeFramework.jsx
│       │   ├── StaffDirectory.jsx
│       │   ├── TeamMembers.jsx
│       │   ├── PdsaCycles.jsx
│       │   ├── Strategies.jsx
│       │   ├── DataRecommendations.jsx
│       │   ├── StsPat.jsx
│       │   ├── StsPatOverview.jsx
│       │   ├── SupervisorSelfRating.jsx — Private self-assessment (4 tabs, radar chart, PDF)
│       │   ├── SessionSignIn.jsx        — Public session sign-in
│       │   ├── SessionEvaluation.jsx    — Public anonymous evaluation
│       │   └── SessionSignOut.jsx       — Public sign-out confirmation
│       ├── styles/               — CSS files for assessment pages
│       └── utils/
│           ├── supabase.js
│           ├── constants.js
│           ├── reportDataLoader.js
│           ├── exportExcel.js
│           ├── exportPdf.js
│           ├── phaseCalculator.js
│           ├── checklistAutoDetect.js
│           └── exportSupervisorSelfRating.js — PDF export for self-rating
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
| `/admin/change-framework` | ChangeFramework | Protected | Collaborative change framework by domain |
| `/admin/staff` | StaffDirectory | Protected | BSC faculty and support staff |
| `/admin/team/:teamId/members` | TeamMembers | Protected | Team roster with invite/manage members |
| `/admin/pdsa/:teamId` | PdsaCycles | Protected | PDSA improvement cycles |
| `/admin/strategies` | Strategies | Protected | Strategy ideas library |
| `/admin/recommendations/:teamId` | DataRecommendations | Protected | Data-driven recommendations |
| `/admin/sts-pat/:teamId` | StsPat | Protected | STS Program Assessment Tool |
| `/admin/sts-pat-overview` | StsPatOverview | Protected | STS-PAT overview across teams |
| `/admin/supervisor-self-rating` | SupervisorSelfRating | Protected | Private self-assessment tool |
| `/session/:token` | SessionSignIn | Public | Learning session sign-in |
| `/session/:token/eval` | SessionEvaluation | Public | Anonymous session evaluation |
| `/session/:token/signout` | SessionSignOut | Public | Session sign-out |

---

## Deployment

### Vercel
- Project: `sts-bsc-manager`
- URL: `https://bsc.ctac.app/`
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

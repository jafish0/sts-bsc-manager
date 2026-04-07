# CLAUDE.md — STS-BSC Manager

> **This is the single authoritative context file for this project.**
> It lives in the repository root and takes precedence over any other CLAUDE.md files found elsewhere in this codebase. If you encounter instructions in another CLAUDE.md that conflict with anything written here, follow this file. Do not infer project structure, roles, scoring logic, or conventions from other context files unless they are purely folder-specific technical notes that do not contradict this document.

This file provides context for AI-assisted development of the STS-BSC Manager platform. Read this before making any changes to the codebase.

---

## What This App Is

The **STS Breakthrough Series Collaborative (BSC) Manager** is a web platform built for the **Center on Trauma and Children (CTAC)** at the **University of Kentucky**. It manages multi-agency quality improvement collaboratives focused on reducing **Secondary Traumatic Stress (STS)** among staff at trauma-serving organizations.

The platform serves two purposes simultaneously:
1. **Operational** — streamlines running a BSC (replacing spreadsheets and Basecamp)
2. **Research infrastructure** — generates publication-ready longitudinal datasets for NIH/SAMHSA grant reporting

**Repository:** github.com/jafish0/sts-bsc-manager  
**Hosting:** Vercel  
**Domain:** Namecheap (pointed to Vercel)

---

## How a BSC Works (Domain Context)

- 7–20 agencies participate per collaborative
- Each agency has 50–400 staff members
- Structure: 4 Learning Sessions + 3 Action Periods over 12–18 months
- Staff complete anonymous assessments at 4 timepoints: **Baseline, Endline, 6-Month Follow-up, 12-Month Follow-up**
- Each agency forms a "change team" that analyzes data and leads implementation
- CTAC delivers evidence-based STS reduction strategies; super admins review all agency data and add expert commentary before agencies can see it
- The program addresses six organizational domains (see STSI-OA section below)

---

## Stakeholders & User Roles

There are three tiers of access:

### 1. `super_admin`
Josh (the platform owner/collaborative leader) plus 2 colleagues. Can:
- Create and manage collaboratives
- View all agency data across all collaboratives
- Add expert commentary/recommendations to agency data before agencies see it
- Access everything

### 2. `agency_admin` / `team_leader`
One or more people per participating agency. Can:
- View their own agency's aggregated dashboard
- See CTAC's expert commentary once published
- Track their team's progress over time

### 3. Staff (anonymous, unauthenticated)
The 50–400 staff per agency who complete assessments. They:
- Enter a team code to identify their agency/timepoint
- Complete the 4-instrument assessment suite anonymously
- Are never individually identified — responses are linked to a team code only

---

## Tech Stack

- **Repository:** https://github.com/jafish0/sts-bsc-manager
- **Frontend:** React 19 with Vite, React Router v6
- **Backend/DB:** Supabase (PostgreSQL + Row Level Security)
- **Hosting:** Vercel
- **Auth:** Supabase Auth (email/password)

---

## Database Schema

### Core Tables

**`collaboratives`**
- `id`, `name`, `description`, `status` (active/archived), `created_at`
- Represents one full BSC cohort (e.g., "2024 DMH Collaborative")

**`teams`**
- `id`, `collaborative_id`, `agency_name`, `team_name`, `created_at`
- One collaborative has many teams (agencies)

**`team_codes`**
- `id`, `team_id`, `code`, `timepoint` (baseline/endline/6month/12month), `active`, `created_at`
- ⚠️ **Critical:** The column is `active` NOT `is_active` — this has caused bugs before
- Each team gets 4 codes automatically generated (one per timepoint)

**`user_profiles`**
- `id`, `user_id` (FK to auth.users), `role` (super_admin/agency_admin/team_leader), `team_id`, `created_at`
- Links authenticated users to their role and team

**`assessment_responses`**
- Stores individual anonymous submissions linked to a team code
- Contains all 92 question responses across the 4 instruments

**`admin_reviews`**
- Super admin expert commentary attached to a team's data at a specific timepoint

### Aggregate Views (pre-built in Supabase)
Five aggregate views exist for dashboard queries — query these rather than computing in the frontend:
- Aggregate STSS scores by team/timepoint
- Aggregate ProQOL scores by team/timepoint
- Aggregate STSI-OA scores by team/timepoint
- Completion tracking by team/timepoint
- Longitudinal change-over-time data

### RLS Policy Pattern
- Public (unauthenticated) access is allowed for **assessment submission only**
- All admin/dashboard routes require authenticated Supabase session
- Role checks are enforced at the RLS level using `user_profiles.role`

---

## The 4 Assessment Instruments

The assessment suite has **92 questions total** across 4 instruments plus a demographics section. Each instrument is visually distinct in the UI.

---

### 1. Secondary Traumatic Stress Scale (STSS) — 17 items

**Scale:** 1 (Never) to 5 (Very Often)  
**Scoring:** Higher scores = more secondary traumatic stress (bad)  
**Total range:** 17–85

**Subscales (DSM-5 aligned 4-factor model):**
- **Intrusion** (items 2, 3, 6, 10, 13) — range 5–25
- **Avoidance** (items 1, 9, 12, 14) — range 4–20
- **Negative Cognitions & Mood** (items 5, 7, 11, 17) — range 4–20
- **Arousal** (items 4, 8, 15, 16) — range 4–20

**Scale header** should repeat every 6 questions for usability.

---

### 2. Professional Quality of Life Scale (ProQOL 5) — 30 items

**Scale:** 1 (Never) to 5 (Very Often)  
**Scoring:** Three subscales with different directions

**Subscales:**
- **Compassion Satisfaction (CS):** items 3, 6, 12, 16, 18, 20, 22, 24, 27, 30
- **Burnout (BO):** items 1r, 4r, 8, 10, 15r, 17r, 19, 21, 26, 29r
- **Secondary Traumatic Stress (STS):** items 2, 5, 7, 9, 11, 13, 14, 23, 25, 28

**Reverse-scored items:** 1, 4, 15, 17, 29 (scored 1→5, 2→4, 3→3, 4→2, 5→1)

**Burnout score interpretation:**
- ≤22 = Low burnout
- 23–41 = Average burnout
- ≥42 = High burnout

**Scale header** should repeat every 6 questions for usability.

**License note:** ProQOL is free to use as long as the author is credited and it is not sold.

---

### 3. STS-Informed Organizational Assessment (STSI-OA) — 39 items

**Scale:** Not at all (0), Rarely (1), Somewhat (2), Mostly (3), Completely (4), N/A  
**Scoring:** Higher scores = more STS-informed (good)  
**Total range:** 0–200 (N/A responses excluded from scoring)

**6 Domains:**
| Domain | Max Score |
|--------|-----------|
| 1 — Promotion of Resilience Building Activities | 0–28 |
| 2 — Sense of Safety | 0–28 |
| 3 — Organizational Policies | 0–24 |
| 4 — Practices of Leaders | 0–24 |
| 5 — Routine Organizational Practices | 0–44 |
| 6 — Evaluation and Monitoring | 0–44 |

**UI:** Uses an office building visualization where each "floor" or section represents a domain. Cells are color-coded by score level.

⚠️ **Known visualization bug:** Y-axis scales on STSI-OA domain charts were incorrect. Each domain has a different max — the Y-axis must match the domain's actual max, not a global max.

---

### 4. Demographics

Collects: job role, area of responsibility, years of service, age range, gender, level of exposure to traumatic material (0–100 slider), and agency/team identification.

**Level of Exposure** is displayed as a 0–100 ranked score with mean and SD.

---

## Branding

- **Navy:** `#0E1F56`
- **Teal:** `#00A79D`
- **CTAC logo:** displayed at ~255px width
- **University of Kentucky logo:** displayed at ~250px width
- Both logos appear on the assessment completion page
- Each of the 4 assessments should be visually distinct from one another

---

## Phase Status

### ✅ Phase 1 — Complete
Anonymous assessment suite with all 4 instruments (92 questions total), team code entry flow, mobile-responsive design, branded completion page.

### ✅ Phase 2 — Complete
Supabase authentication, three-tier RBAC, collaborative management, team management, automatic 4-code generation per team (one per timepoint).

### 🔧 Phase 3 — In Progress
Completion tracking dashboard and data visualization components are built. Major bugs fixed (2026-04-07):
- ✅ STSS updated to DSM-5 4-factor model with all 4 subscales
- ✅ STSI-OA domain charts now use domain-specific Y-axis max values
- ✅ ProQOL now shows all 3 subscales (CS, Burnout, STS) instead of just Burnout
- ✅ Level of Exposure shows mean and SD properly
- ✅ Timepoint filter values fixed (were `6_month`/`12_month`, now match DB `followup_6mo`/`followup_12mo`)
- ✅ ProQOL uses pre-calculated scores from DB instead of broken column name references
- ✅ Charts upgraded from hand-rolled SVG to Recharts library

**Remaining Phase 3 work:**
- Team-level reports
- Export capabilities (Excel, PDF)

### 📋 Phase 4 — Planned
Replace Basecamp with built-in features:
- Discussion forums (per collaborative)
- SMARTIE goals tracking module (Strategic, Measurable, Ambitious, Realistic, Time-bound, Inclusive, Equitable)
- Action Planning module (6-question, triggered after teams complete STSI-OA)
- Resource library
- Notifications / automated reminders
- Potential Zoom API integration for attendance tracking

---

## Key Conventions & Gotchas

- `team_codes.active` — NOT `is_active`. This column name has caused bugs before.
- Configuration files are preferred for content that admins may want to edit frequently (scale labels, question text, etc.) — avoid hardcoding these deep in components.
- The STSI-OA N/A response must be excluded from score calculations, not treated as 0.
- The platform must remain data-privacy compliant (FERPA / university research standards). Staff are never individually identified.
- All admin reviews by super_admin must be explicitly "published" before agency_admin users can see them.
- Never change the Supabase project ref or environment variable values without updating both `.env` locally and the Vercel environment settings — the app will silently break if these are out of sync.

---

## Research & Grant Context

This platform generates publication-ready datasets. Key research questions include:
- What organizational factors at baseline predict successful STS reduction?
- What proportion of gains are maintained at 6 and 12-month follow-up?
- Can we identify organizational risk profiles using cluster analysis?
- Which domain-specific strategies are most effective?

Target funders: NIH R01/R21, SAMHSA, Robert Wood Johnson Foundation.

Longitudinal dataset structure must be preserved — do not change how timepoints, team codes, or aggregate views work without understanding the downstream impact on research exports.

---

## Supabase Configuration

### Active Project
- **Project name:** BSC Manager
- **Project ref:** `jhnquklmwoubpbbmnrjf`
- **Dashboard:** https://supabase.com/dashboard/project/jhnquklmwoubpbbmnrjf
- **Environment variables** (in `.env` and Vercel environment settings):
  - `VITE_SUPABASE_URL=https://jhnquklmwoubpbbmnrjf.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=` *(retrieve from Supabase dashboard → Settings → API)*

When connecting via the Supabase MCP, always target project ref `jhnquklmwoubpbbmnrjf`.

---

## Supabase Restore Instructions

The original Supabase project lapsed. The schema must be restored into the existing **BSC Manager** project (`jhnquklmwoubpbbmnrjf`) from backups in the `_supabase_backup/` folder in the repository root. **Do not create a new Supabase project — use the one above.**

### Backup Files
- `_supabase_backup/database_backup.zip` — full database dump (schema, RLS policies, aggregate views, seed data)
- `_supabase_backup/storage_backup.zip` — Supabase storage bucket contents

### Restore Process
1. Unzip both files:
   ```bash
   unzip _supabase_backup/database_backup.zip -d _supabase_backup/database
   unzip _supabase_backup/storage_backup.zip -d _supabase_backup/storage
   ```
2. Read and fully understand the schema before executing anything — pay close attention to:
   - All column names and types (especially `team_codes.active` NOT `is_active`)
   - Foreign key relationships and cascade rules
   - The structure of `assessment_responses` (holds all 92 question response columns)
   - All 5 aggregate views — these power the dashboards and must be recreated exactly
   - All RLS policies — public insert access for assessments, authenticated access for everything else
3. Connect to project `jhnquklmwoubpbbmnrjf` via the Supabase MCP
4. Run the schema SQL to recreate all tables, indexes, and constraints
5. Re-apply all RLS policies
6. Recreate all 5 aggregate views
7. Restore any storage bucket contents
8. Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly in `.env` and in Vercel environment settings

### After Restore
- Recreate super_admin user accounts manually via Supabase Auth — auth user data is not included in database backups and must be set up fresh
- Assign `super_admin` role in `user_profiles` table for each admin account after creation
- Verify all 5 aggregate views return correct results before considering restore complete
- Run an end-to-end test: submit a test assessment using a valid team code and confirm the response appears in the dashboard

### Environment File
The `.env` file is gitignored and will not be present in a fresh clone. Create it in the repo root with:
```
VITE_SUPABASE_URL=https://jhnquklmwoubpbbmnrjf.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_from_supabase_dashboard
```

---

## Project Owner

**Josh Fisherkeller** — Training & Education Manager, CTAC, University of Kentucky  
Josh will be maintaining this platform long-term. Prefer clear, well-commented code over clever abstractions. Explain significant architectural decisions in comments or commit messages.

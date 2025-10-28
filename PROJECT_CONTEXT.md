# STS-BSC Manager - Complete Project Context for Claude Code

## 🎯 Current Status: Phase 3 (Data Visualization) - IN PROGRESS

**Last Updated:** October 28, 2025  
**Repository:** https://github.com/jafish0/sts-bsc-manager  
**Environment:** GitHub Codespaces  
**Current Branch:** main  
**Last Commit:** "Add DMH-style Data Visualization dashboard with completion tracking"

---

## 📋 Project Overview

**Project Name:** STS-BSC Manager  
**Purpose:** Web application for managing Secondary Traumatic Stress Breakthrough Series Collaboratives, including assessment collection, team management, and data visualization.

**Tech Stack:**
- **Frontend:** React 19.1.1 + Vite
- **Backend:** Supabase (PostgreSQL + Auth)
- **Routing:** React Router v6
- **Styling:** Inline styles (no CSS framework)
- **Brand Colors:** 
  - Navy: `#0E1F56` (primary/headers)
  - Teal: `#00A79D` (accents/buttons)

---

## ✅ COMPLETED PHASES

### **Phase 1: Assessment Suite (100% COMPLETE)**
Four validated instruments with 92 total questions:

1. **Demographics (17 questions)**
   - Gender, age, years in service, job role
   - Areas of responsibility (multi-select)
   - Trauma exposure level (0-100 slider)
   - File: `frontend/src/pages/Demographics.jsx`

2. **STSS - Secondary Traumatic Stress Scale (17 questions)**
   - Measures STS symptoms across 3 subscales
   - Subscales: Intrusion, Avoidance, Arousal
   - 5-point Likert scale (1=Never to 5=Very Often)
   - File: `frontend/src/pages/STSS.jsx`

3. **ProQOL - Professional Quality of Life (30 questions)**
   - Measures compassion satisfaction, burnout, secondary trauma
   - 5-point Likert scale (1=Never to 5=Very Often)
   - Includes reverse-scored items (1, 4, 15, 17, 29)
   - File: `frontend/src/pages/ProQOL.jsx`

4. **STSI-OA - STS-Informed Organization Assessment (37 questions across 6 domains)**
   - Domain-based assessment with 6 sections
   - 6-point scale (0=N/A, 1=Not at all to 5=Completely)
   - Multi-page form with Previous/Next navigation
   - File: `frontend/src/pages/STSIOA.jsx`

**Assessment Flow:**
1. User enters team code → validates against database
2. Creates `assessment_response` record with timepoint
3. Completes all 4 instruments sequentially
4. Shows completion page with logos and thank you message
5. Data saved anonymously to Supabase

**Key Features:**
- Anonymous data collection via team codes
- Progress tracking across assessments
- Session management via sessionStorage
- Completion page (no popup) with branding
- Files: `TeamCodeEntry.jsx`, `AssessmentComplete.jsx`

---

### **Phase 2: Authentication & Management (100% COMPLETE)**

**Login System:**
- Supabase Auth integration
- Role-based access control: `super_admin`, `agency_admin`, `team_leader`
- Protected routes using `ProtectedRoute` component
- File: `frontend/src/pages/Login.jsx`

**Admin Dashboard:**
- Central hub with navigation cards
- Access to: Collaboratives, Completion Tracking, Data Visualization
- File: `frontend/src/pages/AdminDashboard.jsx`

**Collaborative Management:**
- Create/view/edit collaboratives (BSC cohorts)
- Fields: name, description, start_date, end_date, status (active/completed)
- Filter by status (Active, Completed, All)
- Files: `CollaborativesList.jsx`, `CollaborativeDetail.jsx`
- Modal: `CreateCollaborativeModal.jsx`

**Team Management:**
- Add teams/agencies to collaboratives
- Team fields: team_name, agency_name, contact_name, contact_email, contact_phone
- Auto-generation of 4 unique team codes (one per timepoint)
- Timepoints: Baseline, Endline, 6-Month Follow-up, 12-Month Follow-up
- Copy-to-clipboard functionality for codes
- Modal: `AddTeamModal.jsx`

**Tested End-to-End:**
- Code validation → assessment completion → data saves correctly
- All navigation working: `/admin`, `/admin/collaboratives`, `/admin/collaboratives/:id`
- Logo clicks and back buttons navigate correctly

---

### **Phase 3: Data Visualization (PARTIALLY COMPLETE - NEEDS REFINEMENT)**

**Current Status:** Dashboard displays data but needs significant visual improvements.

**What's Working:**
- DMH-style dashboard layout created
- Blue gradient background with diagonal stripes
- Filtering by: Collaborative, Timepoint, Team (new!)
- Data retrieval from database working correctly
- All calculations implemented and accurate

**Dashboard Components Created:**
1. **Demographics Summary** (text-based)
   - Female percentage
   - Average age
   - Average years in service

2. **Job Role Distribution** (pie chart - needs work)
3. **Area of Responsibility Distribution** (pie chart - needs work)
4. **Level of Exposure** (pie chart with percentiles - needs work)
5. **STSS Scores** (bar charts - needs work)
   - Total score + 4 subscales
6. **ProQOL Burnout** (bar chart - needs work)
7. **STSI-OA Scores** (bar charts - needs work)
   - Total score + 5 subscales

**Files:**
- `frontend/src/pages/DataVisualization.jsx` - Main dashboard
- `frontend/src/pages/CompletionTracking.jsx` - Created but not implemented

**Test Data Available:**
- 1 Collaborative: "Fall 2025 Child Welfare BSC"
- 1 Team: "STS Busters"
- 1 Complete Assessment: Baseline timepoint with all 4 instruments
- Team Code: `DCBSNO-B9U2CR-BASELINE`

---

## 🎨 CRITICAL VISUAL ISSUES TO FIX (PHASE 3 WORK NEEDED)

### **Reference Design:**
The dashboard should match the DMH example report style:
- Professional one-page layout
- Clean, print-friendly design
- Clear visual hierarchy
- Charts are readable and well-proportioned
- See uploaded DMH example: `DMH_STSBSC_Faker.pdf`

### **Current Problems:**

1. **Pie Charts are Broken/Ugly:**
   - Colors may not be rendering properly
   - Labels are overlapping or poorly positioned
   - Legend placement needs work
   - Percentages may be incorrectly calculated or displayed
   - Chart sizing inconsistent

2. **Bar Charts Need Improvement:**
   - May be too small or hard to read
   - Axis labels could be better
   - Color scheme needs refinement
   - Mean scores not clearly displayed
   - Grid lines may be missing or too prominent

3. **Layout Issues:**
   - Components may not align properly
   - Spacing could be inconsistent
   - Cards may be different sizes when they should match
   - Overall visual balance needs work

4. **Typography/Readability:**
   - Font sizes may be inconsistent
   - Headers might need better contrast
   - Some text could be hard to read

### **Goals for Phase 3 Completion:**
- Make visualizations match DMH professional quality
- Ensure all charts are clear, accurate, and visually appealing
- Fix any calculation errors in chart data
- Improve overall layout and spacing
- Make dashboard print-friendly
- Test with multiple data points (currently only 1 response exists)

---

## 🗂️ Complete File Structure
```
sts-bsc-manager/
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   │   ├── CTAC_white.png
│   │   │   ├── UKCTAC_logoasuite_web__primary_tagline_color.png
│   │   │   └── UK_Lockup-286.png
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── CreateCollaborativeModal.jsx
│   │   │   └── AddTeamModal.jsx
│   │   ├── config/
│   │   │   ├── demographics.js
│   │   │   ├── stss.js
│   │   │   ├── proqol.js
│   │   │   └── stsioa.js
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx ✅
│   │   │   ├── AdminDashboard.jsx ✅
│   │   │   ├── CollaborativesList.jsx ✅
│   │   │   ├── CollaborativeDetail.jsx ✅
│   │   │   ├── TeamCodeEntry.jsx ✅
│   │   │   ├── Demographics.jsx ✅
│   │   │   ├── STSS.jsx ✅
│   │   │   ├── ProQOL.jsx ✅
│   │   │   ├── STSIOA.jsx ✅
│   │   │   ├── AssessmentComplete.jsx ✅
│   │   │   ├── DataVisualization.jsx ⚠️ NEEDS WORK
│   │   │   └── CompletionTracking.jsx ❌ NOT IMPLEMENTED
│   │   ├── styles/
│   │   │   ├── TeamCodeEntry.css
│   │   │   ├── Demographics.css
│   │   │   ├── STSS.css
│   │   │   ├── ProQOL.css
│   │   │   └── STSIOA.css
│   │   ├── utils/
│   │   │   └── supabase.js
│   │   ├── App.jsx ✅
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── PROJECT_CONTEXT.md (this file)
```

---

## 🗄️ Database Schema (Supabase PostgreSQL)

### **Tables & Key Relationships:**
```
collaboratives (BSC cohorts)
├── id (uuid, PK)
├── name (text)
├── description (text)
├── start_date (date)
├── end_date (date)
├── status (text: 'active' or 'completed')
├── created_at (timestamp)
└── updated_at (timestamp)

teams (agencies within collaboratives)
├── id (uuid, PK)
├── collaborative_id (uuid, FK → collaboratives)
├── team_name (text)
├── agency_name (text)
├── contact_name (text)
├── contact_email (text)
├── contact_phone (text)
├── created_at (timestamp)
└── updated_at (timestamp)

team_codes (4 codes per team, one per timepoint)
├── id (uuid, PK)
├── team_id (uuid, FK → teams)
├── code (text, unique) - Format: XXXXXX-XXXXXX-TIMEPOINT
├── timepoint (text: 'baseline', 'endline', '6_month', '12_month')
├── active (boolean, default true)
├── expires_at (timestamp, nullable)
├── access_count (integer, default 0)
├── created_at (timestamp)
└── updated_at (timestamp)

assessment_responses (junction table)
├── id (uuid, PK)
├── team_code_id (uuid, FK → team_codes) ⚠️ REQUIRED
├── timepoint (text) ⚠️ REQUIRED - gets copied from team_codes
├── started_at (timestamp)
├── completed_at (timestamp)
├── is_complete (boolean)
├── demographics_complete (boolean)
├── stss_complete (boolean)
├── proqol_complete (boolean)
├── stsioa_complete (boolean)
├── session_id (text)
├── ip_address (inet)
├── user_agent (text)
├── created_at (timestamp)
└── updated_at (timestamp)

demographics
├── id (uuid, PK)
├── assessment_response_id (uuid, FK → assessment_responses)
├── gender (text: 'M', 'F', 'NB', 'not_listed')
├── gender_other (text, nullable)
├── age (integer)
├── age_over_65 (boolean)
├── years_in_service (integer)
├── years_over_30 (boolean)
├── job_role (text)
├── job_role_other (text, nullable)
├── areas_of_responsibility (jsonb array)
├── areas_of_responsibility_other (text, nullable)
├── exposure_level (integer 0-100)
├── created_at (timestamp)
└── updated_at (timestamp)

stss_responses
├── id (uuid, PK)
├── assessment_response_id (uuid, FK → assessment_responses)
├── item_1 through item_17 (integer, 1-5)
├── intrusion_score (integer, calculated)
├── avoidance_score (integer, calculated)
├── arousal_score (integer, calculated)
├── total_score (integer, calculated)
├── created_at (timestamp)
└── updated_at (timestamp)

proqol_responses
├── id (uuid, PK)
├── assessment_response_id (uuid, FK → assessment_responses)
├── item_1 through item_30 (integer, 1-5)
├── compassion_satisfaction_score (integer, calculated)
├── burnout_score (integer, calculated)
├── secondary_trauma_score (integer, calculated)
├── compassion_satisfaction_tscore (numeric, nullable)
├── burnout_tscore (numeric, nullable)
├── secondary_trauma_tscore (numeric, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

stsioa_responses
├── id (uuid, PK)
├── assessment_response_id (uuid, FK → assessment_responses)
├── item_1a through item_6d (integer, 0-5) - Note: both formats exist
├── item_1_a through item_6_d (integer, 0-5) - (underscore version)
├── domain_1_score through domain_6_score (integer, calculated)
├── resilience_score (integer, calculated)
├── safety_score (integer, calculated)
├── policies_score (integer, calculated)
├── leadership_score (integer, calculated)
├── routine_practices_score (integer, calculated)
├── evaluation_score (integer, calculated)
├── total_score (integer, calculated)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### **⚠️ CRITICAL DATABASE NOTES:**

1. **Assessment Response Link Pattern:**
```
   team_codes → assessment_responses → demographics/stss/proqol/stsioa
```
   - ALL assessment tables link via `assessment_response_id`
   - **NEVER** query demographics/assessments directly by `team_code_id`
   - Must go through `assessment_responses` table

2. **Required Fields:**
   - `assessment_responses` requires BOTH `team_code_id` AND `timepoint`
   - `timepoint` must be copied from `team_codes` table when creating record

3. **Correct Query Pattern:**
```sql
   -- ✅ CORRECT
   SELECT d.* 
   FROM demographics d
   JOIN assessment_responses ar ON d.assessment_response_id = ar.id
   WHERE ar.team_code_id = '<team_code_id>';

   -- ❌ WRONG - will fail
   SELECT * FROM demographics WHERE team_code_id = '<team_code_id>';
```

4. **Gender Values:**
   - Use 'M', 'F', 'NB', 'not_listed'
   - NOT 'male', 'female', etc.

5. **Areas of Responsibility:**
   - Stored as JSONB array
   - Example: `["Children's Services", "Multi-Team"]`

---

## 🔧 Key Implementation Details

### **Session Management:**
```javascript
// TeamCodeEntry.jsx validates and stores:
sessionStorage.setItem('teamCodeId', data.id)
sessionStorage.setItem('teamCode', data.code)

// Demographics.jsx creates assessment_response and stores:
sessionStorage.setItem('assessmentResponseId', data.id)

// All subsequent pages read from sessionStorage
const assessmentResponseId = sessionStorage.getItem('assessmentResponseId')

// AssessmentComplete.jsx clears everything
sessionStorage.removeItem('teamCodeId')
sessionStorage.removeItem('teamCode')
sessionStorage.removeItem('assessmentResponseId')
```

### **Navigation Flow:**
```
/ (TeamCodeEntry)
  ↓ validates code, stores in sessionStorage
/demographics
  ↓ creates assessment_response, saves data
/stss
  ↓ saves STSS data
/proqol
  ↓ saves ProQOL data
/stsioa
  ↓ saves STSI-OA data, marks complete
/complete
  ↓ shows success page, clears session
```

### **Score Calculations:**

**STSS Subscales:**
```javascript
Intrusion: Q1-5 (sum)
Avoidance: Q6-7 (sum)
Negative Cognitions: Q8-14 (sum)
Arousal: Q15-20 (sum) // Note: Only 17 items in STSS, not 20
Total: Sum of all subscales
```

**ProQOL Subscales:**
```javascript
// Reverse scoring for items: 1, 4, 15, 17, 29
// Formula: 6 - original_score

Compassion Satisfaction: Items 3,6,12,16,18,20,22,24,27,30
Burnout: Items 1,4,8,10,15,17,19,21,26,27
Secondary Trauma: Items 2,5,7,9,11,13,14,23,25,28,29
```

**STSI-OA Domains:**
```javascript
Domain 1 - Resilience: Items 1a-1g (7 items, 0-35 range)
Domain 2 - Safety: Items 2a-2g (7 items, 0-35 range)
Domain 3 - Policies: Items 3a-3f (6 items, 0-30 range)
Domain 4 - Leadership: Items 4a-4f (6 items, 0-30 range)
Domain 5 - Routine: Items 5a-5k (11 items, 0-55 range)
Domain 6 - Evaluation: Items 6a-6d (4 items, 0-20 range)
Total Score: 0-205 range
```

### **Exposure Level Percentiles:**
```javascript
0-25%: Low exposure
25-50%: Moderate exposure
50-75%: High exposure
75-100%: Very high exposure
```

---

## 🚀 Development Workflow

### **Start Dev Server:**
```bash
cd /workspaces/sts-bsc-manager/frontend
npm run dev
```

### **Access Points:**
- Assessment Entry: `http://localhost:5173/`
- Admin Login: `http://localhost:5173/login`
- Admin Dashboard: `http://localhost:5173/admin` (requires auth)
- Data Visualization: `http://localhost:5173/admin/data-visualization`

### **Test Credentials:**
- Check Supabase Auth dashboard for admin users
- Or create new admin via Supabase SQL:
```sql
  -- Add to users table after auth signup
  UPDATE auth.users 
  SET raw_user_meta_data = jsonb_set(
    raw_user_meta_data, 
    '{role}', 
    '"super_admin"'
  )
  WHERE email = 'your-email@example.com';
```

### **Git Workflow:**
```bash
git status
git add .
git commit -m "Descriptive message"
git push origin main
```

---

## 🐛 Known Issues & Quirks

1. **DataVisualization Charts:**
   - Custom SVG implementation (no Chart.js or Recharts)
   - Pie chart rendering may have issues
   - Bar chart scaling needs work
   - Colors need refinement

2. **CompletionTracking Page:**
   - File exists but not implemented
   - Needs similar database query structure as DataVisualization

3. **Logo Paths:**
   - All logos in `/frontend/src/assets/`
   - Must use relative imports: `import logo from '../assets/filename.png'`

4. **Database Column Name Inconsistencies:**
   - STSIOA has both `item_1a` and `item_1_a` formats
   - Always check actual column names in Supabase before coding

5. **No External Chart Libraries:**
   - Project uses custom SVG charts only
   - Do NOT install Chart.js, Recharts, or similar
   - Keep bundle size small

---

## 📊 Data Visualization Calculations (Current Implementation)

### **Demographics Processing:**
```javascript
// Gender
femalePercent = (femaleCount / total) * 100

// Age
avgAge = totalAge / ageCount

// Years in Service
avgYearsService = totalYearsService / serviceCount

// Exposure
exposureAvg = sum(exposureLevels) / exposureLevels.length

// Exposure Percentiles
0-25: count where level <= 25
25-50: count where 25 < level <= 50
50-75: count where 50 < level <= 75
75-100: count where level > 75
```

### **STSS Processing:**
```javascript
// For each response
intrusion = Q1 + Q2 + Q3 + Q4 + Q5
avoidance = Q6 + Q7
negCognition = Q8 + Q9 + Q10 + Q11 + Q12 + Q13 + Q14
arousal = Q15 + Q16 + Q17 + Q18 + Q19 + Q20 // Check: may only be Q15-Q17
total = intrusion + avoidance + negCognition + arousal

// Average across all responses
avgIntrusion = sum(intrusion) / responseCount
avgAvoidance = sum(avoidance) / responseCount
avgNegCognition = sum(negCognition) / responseCount
avgArousal = sum(arousal) / responseCount
avgTotal = sum(total) / responseCount
```

### **ProQOL Burnout Processing:**
```javascript
// Burnout items: 1,4,8,10,15,17,19,21,26,27
// Reverse scoring: 1,4,15,17,19

reverse = (val) => 6 - val

burnoutScore = 
  reverse(Q1) + Q4 + Q8 + Q10 + 
  reverse(Q15) + reverse(Q17) + reverse(Q19) + 
  Q21 + Q26 + Q27

avgBurnout = sum(burnoutScores) / responseCount

// Interpretation
<= 22: Low burnout
23-41: Average burnout
>= 42: High burnout
```

### **STSI-OA Processing:**
```javascript
// For each domain, sum all items
resilience = Q1a + Q1b + Q1c + Q1d + Q1e + Q1f + Q1g
safety = Q2a + Q2b + Q2c + Q2d + Q2e + Q2f + Q2g
policies = Q3a + Q3b + Q3c + Q3d + Q3e + Q3f
leadership = Q4a + Q4b + Q4c + Q4d + Q4e + Q4f
routine = Q5a + Q5b + Q5c + Q5d + Q5e + Q5f + Q5g + Q5h + Q5i + Q5j + Q5k
// evaluation domain exists but not used in current viz

total = resilience + safety + policies + leadership + routine

// Average across all responses
avgResilience = sum(resilience) / responseCount
avgSafety = sum(safety) / responseCount
avgPolicies = sum(policies) / responseCount
avgLeadership = sum(leadership) / responseCount
avgRoutine = sum(routine) / responseCount
avgTotal = sum(total) / responseCount
```

---

## 🎯 IMMEDIATE NEXT STEPS FOR CLAUDE CODE

### **Priority 1: Fix Data Visualization Charts** ⚠️ HIGH PRIORITY

**File to Edit:** `frontend/src/pages/DataVisualization.jsx`

**Problems to Solve:**
1. **Pie Charts (Lines ~358-410):**
   - Fix SVG path calculation if broken
   - Improve color palette
   - Better label positioning
   - Ensure percentages are accurate
   - Make legend readable

2. **Bar Charts (Lines ~412-520):**
   - Fix Y-axis scaling
   - Improve bar width/spacing
   - Better label formatting
   - Add grid lines if missing
   - Ensure mean scores are clearly displayed

3. **Layout (Lines ~550-900):**
   - Fix card alignment
   - Ensure consistent spacing
   - Improve responsive design
   - Make print-friendly

**Reference:**
- Look at `DMH_STSBSC_Faker.pdf` for the target design
- Match professional quality of that report
- Maintain brand colors (#0E1F56 and #00A79D)

**Testing:**
- Use team code: `DCBSNO-B9U2CR-BASELINE`
- Collaborative: "Fall 2025 Child Welfare BSC"
- Only 1 response exists currently

### **Priority 2: Add More Test Data**
Create additional test responses to better test the visualizations:
```sql
-- In Supabase SQL Editor
-- Add 5-10 more assessment responses with varied data
-- This will help test averages and distributions
```

### **Priority 3: Implement CompletionTracking.jsx**
**File:** `frontend/src/pages/CompletionTracking.jsx`

Show which teams have completed assessments at each timepoint:
- List all teams in a collaborative
- Show completion status for each timepoint
- Display completion rates
- Identify which teams need follow-up

Use similar database query structure as DataVisualization.jsx

### **Priority 4: Export Functionality**
Add ability to:
- Export dashboard to PDF
- Export dashboard to PNG
- Export raw data to CSV
- Email reports

---

## 🎨 Design Guidelines

**Brand Identity:**
- Navy (#0E1F56): Headers, primary UI elements
- Teal (#00A79D): Accents, buttons, highlights
- White backgrounds for content cards
- Professional, clean, academic style

**Typography:**
- System fonts only (no custom fonts)
- Clear hierarchy with size/weight
- Readable at print resolution

**Layout Principles:**
- One-page dashboard format
- Grid-based layout
- Consistent spacing (multiples of 0.5rem)
- Print-friendly (fits on letter/A4)

**Charts:**
- Custom SVG only (no libraries)
- Professional color palettes
- Clear labels and legends
- Accessible (consider colorblind users)

---

## 📚 Important Files to Review

**Before starting work, read these files:**
1. `frontend/src/pages/DataVisualization.jsx` - Current viz implementation
2. `DMH_STSBSC_Faker.pdf` - Target design reference
3. `frontend/src/utils/supabase.js` - Database connection
4. `PROJECT_CONTEXT.md` - This file

**Configuration Files:**
- `frontend/src/config/demographics.js` - Demographics options
- `frontend/src/config/stss.js` - STSS items and config
- `frontend/src/config/proqol.js` - ProQOL items and config
- `frontend/src/config/stsioa.js` - STSIOA domains and items

---

## 🔐 Supabase Configuration

**Connection:**
- URL: Stored in `frontend/src/utils/supabase.js`
- Keys managed via environment variables
- RLS policies enabled for security

**Important RLS Rules:**
- Public insert access for assessment submissions (anonymous)
- Authenticated read access for admins
- Row-level security on collaboratives/teams by organization

---

## 🧪 Testing Strategy

**Manual Testing Checklist:**
1. ✅ Complete full assessment flow (all 4 instruments)
2. ✅ Verify data saves to correct tables
3. ⚠️ Check dashboard displays data accurately
4. ❌ Test with multiple responses (need more test data)
5. ❌ Verify charts are readable and accurate
6. ❌ Test print layout
7. ❌ Test all filters (collaborative, timepoint, team)
8. ❌ Verify calculations match expected formulas

**Test Data Location:**
- Collaborative: "Fall 2025 Child Welfare BSC"
- Team: "STS Busters"
- Code: `DCBSNO-B9U2CR-BASELINE`
- Only 1 complete response currently exists

---

## 💡 Tips for Claude Code

**When Making Changes:**
1. ALWAYS provide complete file contents (not snippets)
2. Test thoroughly before committing
3. Follow existing code patterns
4. Maintain inline styles (no CSS files for new components)
5. Keep brand colors consistent
6. Check database schema before writing queries

**Common Pitfalls:**
- Don't forget `assessment_response_id` link pattern
- Don't use `team_code_id` directly on assessment tables
- Remember to include `timepoint` when creating assessment_responses
- Gender values are 'M'/'F', not 'male'/'female'
- Areas of responsibility is a JSONB array

**Git Best Practices:**
- Commit frequently with descriptive messages
- Test before pushing
- Keep commits focused on single features

---

## 📞 Project Contacts

**User:** jafish0 (GitHub)  
**Repository:** https://github.com/jafish0/sts-bsc-manager  
**Environment:** GitHub Codespaces  

---

## 🎯 Success Criteria for Phase 3 Completion

Phase 3 will be considered complete when:

✅ **Visualizations:**
- [ ] All charts render correctly and professionally
- [ ] Colors match brand guidelines
- [ ] Labels are clear and readable
- [ ] Layout matches DMH reference quality
- [ ] Print-friendly (fits on one page)

✅ **Functionality:**
- [ ] Filters work correctly (collaborative, timepoint, team)
- [ ] Calculations are accurate
- [ ] Data displays for multiple responses
- [ ] No console errors

✅ **Code Quality:**
- [ ] Clean, maintainable code
- [ ] Consistent styling
- [ ] Proper error handling
- [ ] Comments where needed

✅ **Testing:**
- [ ] Tested with 10+ responses
- [ ] Works across different timepoints
- [ ] Team filter works correctly
- [ ] Printed output looks professional

---

**END OF PROJECT CONTEXT**

*Last Updated: October 28, 2025*  
*Ready for Claude Code to continue work on Phase 3 Data Visualization improvements*
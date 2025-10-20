# STS-BSC Manager - Development Session Notes

## 🚀 HOW TO START A NEW SESSION WITH CLAUDE

**CRITICAL: Do this FIRST thing every new chat:**

1. Tell Claude: "We're working on the STS-BSC Manager project"
2. Give Claude this info:
   - Repository: https://github.com/jafish0/sts-bsc-manager (PUBLIC)
   - We work in GitHub Codespace
   - Tech stack: React + Supabase + Vite

3. Claude will clone the repo and we can start coding immediately

**To test the app:**
```bash
cd frontend
npm run dev
```
Then open in browser (port 5173)

**Test team code:** TEST-2025

---

## ✅ COMPLETED FEATURES (As of October 20, 2025)

### Phase 1 - Assessment Suite (IN PROGRESS)

**DONE:**
- ✅ Database setup (Supabase - all tables, RLS policies, triggers)
- ✅ Team Code Entry screen
- ✅ Demographics form (5 questions + trauma exposure slider with info button)
- ✅ STSS Assessment (17 questions with copyright notice and info button)
- ✅ STSI-OA Assessment (40 questions across 6 domains) - **NEEDS FIXES (see below)**
- ✅ Completion screen with thank you message

**CURRENT ISSUES TO FIX:**
1. ❌ **Text alignment** - All text is centered but should be left-justified
2. ❌ **ProQOL is MISSING** - We skipped building it! Flow currently goes: Demographics → STSS → STSI-OA (ProQOL should be between STSS and STSI-OA)
3. ❌ **STSI-OA has WRONG scale labels** - Currently says "1 - Needs Attention", "2 - Planning Stage", etc.
   - **Should be:** Not at all, Rarely, Somewhat, Mostly, Completely, N/A
   - See the official PDF: `/mnt/user-data/uploads/STSI_OA_English.pdf`

**TODO - NEXT SESSION:**
1. ⏳ Build ProQOL Assessment (30 questions) - **THIS IS THE PRIORITY**
2. ⏳ Fix STSI-OA scale labels (use official PDF for reference)
3. ⏳ Fix text alignment throughout the app (left-justify, not center)

---

## 📁 PROJECT STRUCTURE
```
sts-bsc-manager/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── TeamCodeEntry.jsx ✅
│   │   │   ├── Demographics.jsx ✅
│   │   │   ├── STSS.jsx ✅
│   │   │   ├── ProQOL.jsx ❌ NOT BUILT YET - PRIORITY!
│   │   │   └── STSIOA.jsx ✅ (needs scale fix)
│   │   ├── config/
│   │   │   ├── demographics.js ✅
│   │   │   ├── stss.js ✅
│   │   │   ├── proqol.js ❌ NOT BUILT YET - PRIORITY!
│   │   │   └── stsioa.js ✅ (needs scale fix)
│   │   ├── styles/
│   │   │   ├── TeamCodeEntry.css ✅
│   │   │   ├── Demographics.css ✅
│   │   │   ├── STSS.css ✅
│   │   │   ├── ProQOL.css ❌ NOT BUILT YET
│   │   │   └── STSIOA.css ✅
│   │   ├── utils/
│   │   │   └── supabase.js ✅
│   │   ├── App.jsx ✅ (needs ProQOL integration)
│   │   └── main.jsx ✅
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## 🗄️ DATABASE SCHEMA NOTES

**Key Tables:**
- `team_codes` - Stores team access codes
- `assessment_responses` - Main record for each participant's session
- `demographics` - Stores demographic data
- `stss_responses` - Stores STSS items (item_1 through item_17 as individual columns)
- `proqol_responses` - Will store ProQOL items (NOT BUILT YET)
- `stsioa_responses` - Stores STSI-OA items (item_1a through item_6d as individual columns)

**IMPORTANT:** Database uses individual item columns (item_1, item_2, etc.) NOT JSON objects

---

## 🎯 NEXT SESSION PRIORITIES

### 1. Build ProQOL Assessment (HIGHEST PRIORITY)

**ProQOL Details:**
- 30 questions total
- 3 subscales:
  - Compassion Satisfaction (10 items)
  - Burnout (10 items)  
  - Secondary Traumatic Stress (10 items)
- 5-point scale: 1=Never, 2=Rarely, 3=Sometimes, 4=Often, 5=Very Often
- Time frame: Last 30 days
- Copyright: Beth Hudnall Stamm, ProQOL.org
- Free to use with proper attribution

**Files to create:**
1. `frontend/src/config/proqol.js` - Questions, copyright, info
2. `frontend/src/pages/ProQOL.jsx` - Component
3. `frontend/src/styles/ProQOL.css` - Styling
4. Update `frontend/src/App.jsx` - Add ProQOL between STSS and STSI-OA

**Pattern to follow:** Copy the STSS structure (it's working perfectly)

### 2. Fix STSI-OA Scale Labels

Reference the official PDF at `/mnt/user-data/uploads/STSI_OA_English.pdf`

**Current (WRONG):**
```javascript
{ value: 1, label: '1 - Needs Attention' },
{ value: 2, label: '2 - Planning Stage' },
{ value: 3, label: '3 - Being Tested' },
{ value: 4, label: '4 - Ready for Spread' },
{ value: 5, label: '5 - Fully Implemented' },
{ value: 0, label: 'N/A - Not Applicable' }
```

**Should be:**
```javascript
{ value: 1, label: 'Not at all' },
{ value: 2, label: 'Rarely' },
{ value: 3, label: 'Somewhat' },
{ value: 4, label: 'Mostly' },
{ value: 5, label: 'Completely' },
{ value: 0, label: 'N/A' }
```

Update in: `frontend/src/config/stsioa.js`

### 3. Fix Text Alignment

All body text should be left-justified, not centered. Check these CSS files:
- Demographics.css
- STSS.css
- STSIOA.css
- ProQOL.css (when created)

---

## 🔧 COMMON ISSUES & SOLUTIONS

### Issue: "Cannot find module" error
**Solution:** Make sure you're in the `frontend` directory before running npm commands
```bash
cd frontend
npm run dev
```

### Issue: Database save error
**Solution:** Check that database columns match exactly what the code expects. Use individual item columns (item_1, item_2, etc.)

### Issue: Chat not responding
**Solution:** Start a new chat and immediately:
1. Say we're working on STS-BSC Manager
2. Give the GitHub repo URL
3. Claude clones it and we're back to coding

---

## 💡 DESIGN PATTERNS WE'RE USING

**Config-based forms:** All dropdown options, questions, etc. in separate config files so non-technical users can edit them easily

**Component structure:**
- Each assessment is a separate component
- Takes props: `teamCodeData`, `assessmentResponseId`, `onComplete`
- Returns: Full-page assessment with progress bar
- Saves to database on submit
- Calls `onComplete()` to move to next step

**Styling:** Purple/teal gradient background, white cards, consistent across all assessments

**Info buttons:** Collapsible panels explaining what each assessment measures

---

## 📝 DEVELOPMENT WORKFLOW

**At end of each session:**
1. Test that everything works
2. Commit code:
```bash
   git add .
   git commit -m "Descriptive message"
   git push
```
3. Update these SESSION_NOTES.md with what was completed
4. Push the notes too

**At start of each session:**
1. Tell Claude about the project and repo
2. Claude clones the repo
3. Review SESSION_NOTES.md together
4. Continue building

---

## 🎨 ASSESSMENT COPYRIGHT INFO TO INCLUDE

**STSS:** ✅ DONE
- Copyright © 1999 Brian E. Bride
- Citation: Bride, B.E., Robinson, M.R., Yegidis, B., & Figley, C.R. (2004)

**ProQOL:** ❌ NOT BUILT YET
- Copyright info at ProQOL.org
- Must include proper attribution
- Free for research/clinical use

**STSI-OA:** ✅ DONE (but scale needs fixing)
- ©Copyright 2014 Ginny Sprang, Leslie Ross, Kimberly Blackshear, Brian Miller, Cynthia Vrabel, Jacob Ham, James Henry, and James Caringi
- Contact sprang@uky.edu for permission

---

## 📞 PROJECT CONTACTS

**Project Owner:** Josh Fisherkeller (jafish0@uky.edu)
**Organization:** CTAC, University of Kentucky
**Supervisor:** Ginny Sprang
**GitHub:** jafish0/sts-bsc-manager

---

## 📊 CURRENT STATUS

**Last Session:** October 20, 2025
**Current Sprint:** Phase 1 - Assessment Suite
**Session Progress:** Built STSI-OA (needs fixes), identified ProQOL is missing
**Next Session Goal:** Build ProQOL Assessment + fix STSI-OA scale + fix text alignment

**Assessment Flow (CURRENT - WRONG):**
1. Team Code Entry ✅
2. Demographics ✅
3. STSS ✅
4. ~~ProQOL~~ ❌ MISSING!
5. STSI-OA ✅ (but has wrong scale)
6. Completion ✅

**Assessment Flow (SHOULD BE):**
1. Team Code Entry ✅
2. Demographics ✅
3. STSS ✅
4. **ProQOL** ❌ **BUILD THIS NEXT!**
5. STSI-OA ✅ (fix scale)
6. Completion ✅
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

## ✅ COMPLETED FEATURES

### Phase 1 - Assessment Suite (IN PROGRESS)

**DONE:**
- ✅ Database setup (Supabase - all 10 tables, RLS policies, triggers)
- ✅ Team Code Entry screen
- ✅ Demographics form (5 questions + trauma exposure slider with info button)
- ✅ STSS Assessment (17 questions with copyright notice and info button)

**TODO:**
- ⏳ ProQOL Assessment (30 questions)
- ⏳ STSI-OA Assessment (39 questions + office building visualization)
- ⏳ Completion/thank you screen

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
│   │   │   ├── ProQOL.jsx ⏳ NEXT
│   │   │   └── STSIOA.jsx ⏳
│   │   ├── config/
│   │   │   ├── demographics.js ✅
│   │   │   ├── stss.js ✅
│   │   │   └── proqol.js ⏳ NEXT
│   │   ├── styles/
│   │   │   ├── TeamCodeEntry.css ✅
│   │   │   ├── Demographics.css ✅
│   │   │   ├── STSS.css ✅
│   │   │   └── ProQOL.css ⏳ NEXT
│   │   ├── utils/
│   │   │   └── supabase.js ✅
│   │   ├── App.jsx ✅
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
- `proqol_responses` - Will store ProQOL items
- `stsioa_responses` - Will store STSI-OA items

**IMPORTANT:** Database uses individual item columns (item_1, item_2, etc.) NOT JSON objects

---

## 🎯 NEXT STEPS

### Immediate Next: Build ProQOL Assessment

**ProQOL Details:**
- 30 questions total
- 3 subscales:
  - Compassion Satisfaction (10 items)
  - Burnout (10 items)  
  - Secondary Traumatic Stress (10 items)
- 5-point scale (1=Never to 5=Very Often)
- Time frame: Last 30 days
- Copyright: Beth Hudnall Stamm, ProQOL.org
- Free to use with proper attribution

**Files to create:**
1. `frontend/src/config/proqol.js` - Questions, copyright, info
2. `frontend/src/pages/ProQOL.jsx` - Component
3. `frontend/src/styles/ProQOL.css` - Styling
4. Update `frontend/src/App.jsx` - Add ProQOL to flow

**Pattern to follow:** Copy the STSS structure (it's working perfectly)

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

**Styling:** Purple gradient background, white cards, consistent with all assessments

**Info buttons:** Collapsible panels explaining what each assessment measures (like trauma exposure in Demographics)

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

**ProQOL:** ⏳ NEXT
- Copyright info at ProQOL.org
- Must include proper attribution
- Free for research/clinical use

**STSI-OA:** ⏳ LATER
- © 2015 Sprang, G., & Ross, L.
- Contact sprang@uky.edu for permission

---

## 📞 PROJECT CONTACTS

**Project Owner:** Josh Fisherkeller (jafish0@uky.edu)
**Organization:** CTAC, University of Kentucky
**Supervisor:** Ginny Sprang
**GitHub:** jafish0/sts-bsc-manager

---

**Last Updated:** [Current Date]
**Current Sprint:** Phase 1 - Assessment Suite
**Next Session Goal:** Build ProQOL Assessment
# STS-BSC Manager

**Secondary Traumatic Stress Breakthrough Series Collaborative Manager**

A comprehensive web-based platform for managing breakthrough series collaboratives, collecting assessment data, and supporting organizations in reducing secondary traumatic stress among their staff.

---

## 🎯 Project Overview

The STS-BSC Manager is designed to support the Center on Trauma and Children (CTAC) at the University of Kentucky in delivering breakthrough series collaboratives to child-serving organizations. The platform enables:

- Anonymous assessment data collection from staff members
- Real-time dashboards for organizational leaders
- Collaborative management tools for CTAC facilitators
- Longitudinal tracking across multiple timepoints
- Research infrastructure for grant-funded studies

---

## ✅ Phase 1: Assessment Suite - COMPLETE!

### Current Status (October 21, 2025)

**All 4 validated assessment instruments are fully implemented:**

1. **Demographics** (5 questions)
   - Age, gender, race/ethnicity, job role
   - Trauma exposure slider (0-100 with info button)

2. **Secondary Traumatic Stress Scale (STSS)** (17 questions)
   - 3 subscales: Intrusion, Avoidance, Arousal
   - Copyright: Brian E. Bride (1999)
   - Navy blue gradient branding

3. **Professional Quality of Life Scale (ProQOL 5)** (30 questions)
   - 3 subscales: Compassion Satisfaction, Burnout, Secondary Trauma
   - Reverse scoring on items 1, 4, 15, 17, 29
   - Copyright: Beth Hudnall Stamm (2009)
   - Teal-to-navy gradient branding

4. **STS-Informed Organizational Assessment (STSI-OA)** (40 questions)
   - 6 domains displayed one at a time with navigation
   - Organizational-level assessment
   - Copyright: Sprang, et al. (2017)
   - Teal-to-navy gradient branding

**Total: 92 assessment questions across 4 validated instruments**

### Key Features Implemented

✅ **Brand Identity**
- Center on Trauma & Children logo (top)
- University of Kentucky logo (bottom)
- Brand colors: Navy (#0E1F56) and Teal (#00A79D)
- Consistent visual design across all assessments

✅ **User Experience**
- Mobile-responsive design
- Auto-scroll to top between assessments
- Progress tracking across all assessments
- Repeated scale headers for easier reference (STSS every 6 questions, ProQOL every 6 questions)
- Collapsible info panels explaining each assessment
- Real-time completion tracking

✅ **Data Management**
- Team code entry system
- Anonymous data collection
- Supabase database integration
- Individual item storage (not JSON) for better querying
- Domain and subscale scoring
- Proper handling of reverse-scored items

✅ **Assessment-Specific Features**
- STSI-OA: Domain-by-domain navigation (6 domains)
- STSI-OA: N/A option excluded from scoring
- ProQOL: Reverse scoring for 5 items
- All assessments: Copyright compliance and proper attribution

---

## 🏗️ Technical Architecture

### Frontend
- **Framework:** React 18 with Vite
- **Styling:** Custom CSS with mobile-first responsive design
- **Components:** Modular page-based architecture

### Backend
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Team code-based access (anonymous to staff)
- **Real-time:** Supabase real-time subscriptions ready for Phase 2

### Hosting
- **Platform:** Vercel (ready for deployment)
- **Domain:** Will use Namecheap subdomain

### Database Schema

**Tables:**
- `team_codes` - Team access codes
- `assessment_responses` - Master response tracking
- `demographics` - Demographic data
- `stss_responses` - STSS individual items + subscale scores
- `proqol_responses` - ProQOL individual items + subscale scores
- `stsioa_responses` - STSI-OA individual items + domain scores

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Vercel account (for deployment)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jafish0/sts-bsc-manager.git
cd sts-bsc-manager
```

2. Install dependencies:
```bash
cd frontend
npm install
```

3. Set up environment variables:
Create a `.env` file in the `frontend` directory:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run development server:
```bash
npm run dev
```

5. Open browser to `http://localhost:5173`

### Test Data

Use team code: **TEST-2025** for testing

---

## 📊 Assessment Details

### STSS (17 questions)
- **Scale:** 1-5 (Never to Very Often)
- **Subscales:** 
  - Intrusion (5 items)
  - Avoidance (7 items)
  - Arousal (5 items)
- **Score Range:** 17-85

### ProQOL (30 questions)
- **Scale:** 1-5 (Never to Very Often)
- **Subscales:**
  - Compassion Satisfaction (10 items)
  - Burnout (10 items)
  - Secondary Trauma (10 items)
- **Score Range:** 10-50 per subscale
- **Note:** Items 1, 4, 15, 17, 29 are reverse-scored

### STSI-OA (40 questions)
- **Scale:** 1-5 (Not at all to Completely) + N/A option
- **Domains:**
  1. Resilience-Building Activities (7 items)
  2. Staff Safety (7 items)
  3. STS-Informed Policies (6 items)
  4. Leader Practices (9 items)
  5. Routine Practices (7 items)
  6. Monitoring & Evaluation (4 items)
- **Score Range:** 0-200 (N/A excluded from totals)

---

## 📝 Next Steps: Phase 2

### Collaborative Management (4-6 weeks)

**Planned Features:**

1. **Master Admin Dashboard**
   - View all active and historical collaboratives
   - System-wide metrics and reporting

2. **Collaborative Creation & Management**
   - Create new breakthrough series collaboratives
   - Set timepoints (baseline, end, 6mo, 12mo)
   - Configure collaborative settings

3. **Agency/Team Management**
   - Add agencies to collaboratives
   - Generate unique team codes for each agency
   - Manage key contacts
   - Track agency information

4. **Completion Tracking**
   - Monitor assessment completion rates
   - Status dashboard by agency
   - Automated reminder system

5. **Data Visualization Dashboards**
   - Aggregate results by agency (anonymous)
   - Change-over-time charts
   - Domain/subscale breakdowns
   - Comparative visualizations

6. **Collaborative Leader Features**
   - Add expert comments/recommendations to agency dashboards
   - Review system before agencies see their data
   - Download reports for grant compliance

7. **Discussion Forums**
   - Replace Basecamp functionality
   - Threaded discussions by collaborative
   - File sharing

8. **Resource Repository**
   - Upload session materials
   - Organize handouts and resources
   - Version control

---

## 🎨 Design & Branding

### Color Palette
- **Primary Navy:** #0E1F56
- **Primary Teal:** #00A79D
- **Supporting colors** from CTAC brand guide used sparingly

### Gradients by Assessment
- **STSS:** Navy to lighter blue (#0E1F56 to #1e3a8a)
- **ProQOL:** Teal to navy (#00A79D to #0E1F56)
- **STSI-OA:** Teal to navy (#00A79D to #0E1F56)

### Typography
- Clean, professional sans-serif fonts
- Left-aligned body text for readability
- Adequate spacing and line height

---

## 📄 License & Copyright

### Assessments
- **STSS:** Copyright © 1999 Brian E. Bride
- **ProQOL:** Copyright © 2009 Beth Hudnall Stamm (www.ProQOL.org)
- **STSI-OA:** Copyright © 2017 Sprang, G., Ross, L., Miller, B., Blackshear, K., Ascienzo, S.

All assessments are used with proper attribution and in compliance with usage requirements.

### Platform
This platform is developed for the Center on Trauma and Children at the University of Kentucky.

---

## 👥 Team

**Project Lead:** Josh Fisherkeller, Center on Trauma and Children, University of Kentucky

**Development:** Built with Claude AI (Anthropic) in collaboration with Josh

**Contact:** For questions about the platform, contact CTAC at University of Kentucky

---

## 🔄 Version History

### v1.0.0 - Phase 1 Complete (October 21, 2025)
- ✅ All 4 assessment instruments implemented
- ✅ Brand identity and logos integrated
- ✅ Mobile-responsive design
- ✅ Database integration complete
- ✅ Ready for Phase 2 development

---

## 🛠️ Development Notes

### File Structure
```
frontend/
├── src/
│   ├── assets/          # Logos and images
│   ├── config/          # Assessment configurations
│   ├── pages/           # React components for each page
│   ├── styles/          # CSS files
│   ├── utils/           # Supabase client
│   ├── App.jsx          # Main app component
│   └── main.jsx         # Entry point
├── package.json
└── vite.config.js
```

### Key Technologies
- React Router (ready for Phase 2 multi-page navigation)
- Supabase Client Library
- Vite build tool
- CSS Modules (custom styling)

---

**Built with ❤️ for reducing secondary traumatic stress in child-serving organizations**
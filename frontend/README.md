# STS Breakthrough Series Collaborative (BSC) Manager

A comprehensive web application for managing Secondary Traumatic Stress (STS) assessments and breakthrough series collaboratives for child welfare agencies.

**Repository:** https://github.com/jafish0/sts-bsc-manager  
**Developer:** Josh Fisherkeller, Center on Trauma & Children (CTAC), University of Kentucky  
**Test Code:** TEST-2025

---

## 🎯 PROJECT STATUS

### ✅ **PHASE 1: COMPLETE & PRODUCTION READY** (October 21, 2025)
- Assessment suite with 4 validated instruments (92 total questions)
- Anonymous data collection with team codes
- Supabase database integration
- Brand colors and logos implemented
- All assessments saving correctly

### ✅ **PHASE 2: AUTHENTICATION SYSTEM COMPLETE** (October 26, 2025)
- Login page with email/password authentication
- Protected routes with role-based access control
- Auth context managing user state across app
- Admin dashboard shell with header/logout
- Public assessment flow preserved at `/assessment`
- Admin portal at `/login` and `/dashboard`

### 🚧 **PHASE 2: IN PROGRESS - Collaborative Management**
**Next to build:**
- Create new collaboratives interface
- View list of all collaboratives (active & historical)
- Edit collaborative details
- Team management (add teams, generate codes)
- Completion tracking dashboard
- Data visualization dashboards
- Review & commenting system
- Agency admin portal
- Discussion forums
- Resource repository

---

## 📊 ASSESSMENT INSTRUMENTS

### 1. **Demographics** (5 questions)
Anonymous demographic data collection

### 2. **Secondary Traumatic Stress Scale (STSS)** (17 questions)
- Intrusion subscale (5 items)
- Avoidance subscale (7 items)
- Arousal subscale (5 items)
- Navy blue gradient design (#0E1F56 to #1e3a8a)
- Scale headers repeat every 6 questions

### 3. **Professional Quality of Life (ProQOL)** (30 questions)
- Compassion Satisfaction (10 items)
- Burnout (10 items)
- Secondary Traumatic Stress (10 items)
- Teal-to-navy gradient (#00A79D to #0E1F56)
- Scale headers repeat every 6 questions

### 4. **STS-Informed Organizational Assessment (STSI-OA)** (40 questions)
- 6 domains displayed one at a time with Previous/Next navigation
- Office building visualization with color-coded domains
- Navy and teal brand colors

**Total: 92 questions across 4 validated instruments**

---

## 🏗️ TECHNICAL ARCHITECTURE

### **Frontend**
- **Framework:** React 18+ with Vite
- **Routing:** React Router v6
- **Authentication:** Supabase Auth with protected routes
- **State Management:** React Context API (AuthContext)
- **Styling:** Inline styles (no external CSS framework)

### **Backend**
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (email/password)
- **API:** Supabase JavaScript Client

### **Hosting**
- **Development:** GitHub Codespaces
- **Production:** Vercel (planned)
- **Domain:** Subdomain of ctachouston.org (planned)

### **Brand Colors**
- **Primary Navy:** #0E1F56
- **Primary Teal:** #00A79D

---

## 🗄️ DATABASE SCHEMA

### **Core Tables**
- `collaboratives` - Breakthrough series programs
- `teams` - Agency teams in collaboratives
- `team_codes` - Anonymous access codes
- `assessment_responses` - Master record linking all responses
- `demographics` - Anonymous demographic data
- `stss_responses` - STSS individual items + subscale scores
- `proqol_responses` - ProQOL individual items + subscale scores
- `stsioa_responses` - STSI-OA individual items + domain scores
- `admin_reviews` - Expert comments before agencies see data
- `user_profiles` - User accounts with roles

### **User Roles**
- `super_admin` - Josh (full access)
- `agency_admin` - Agency administrators
- `team_leader` - Team leaders
- `senior_leader` - Higher-level organizational view

### **Aggregate Views** (Auto-updating)
- `team_completion_status`
- `team_stss_aggregates`
- `team_proqol_aggregates`
- `team_stsioa_aggregates`
- `team_demographics_summary`

**Note:** All Phase 2 database tables, relationships, triggers, and Row Level Security policies are already configured in Supabase.

---

## 🚀 GETTING STARTED

### **Prerequisites**
- Node.js 18+ and npm
- Supabase account with project created
- GitHub account

### **Initial Setup**

1. **Clone the repository:**
```bash
   git clone https://github.com/jafish0/sts-bsc-manager.git
   cd sts-bsc-manager/frontend
```

2. **Install dependencies:**
```bash
   npm install
```

3. **Configure environment variables:**
   
   Create `/frontend/.env.local`:
```env
   VITE_SUPABASE_URL=your-project-url-here
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
   
   Get these values from: Supabase Dashboard → Settings → API

4. **Run development server:**
```bash
   npm run dev
```

5. **Access the application:**
   - Public assessments: `http://localhost:5173/assessment`
   - Admin login: `http://localhost:5173/login`
   - Admin dashboard: `http://localhost:5173/dashboard`

### **Creating a Test Admin User**

1. Go to Supabase Dashboard → Authentication → Users
2. Add User → Create New User
3. Enter email and password, check "Auto Confirm User"
4. Go to Table Editor → `user_profiles` → Insert Row
5. Add:
   - `id`: Copy UUID from Authentication user
   - `email`: Same email as above
   - `role`: `super_admin`
   - `full_name`: Your name (optional)

---

## 📁 PROJECT STRUCTURE
```
sts-bsc-manager/
├── frontend/
│   ├── src/
│   │   ├── assets/                 # Logos and images
│   │   ├── components/             # Reusable components
│   │   │   └── ProtectedRoute.jsx  # Route protection wrapper
│   │   ├── contexts/               # React contexts
│   │   │   └── AuthContext.jsx     # Authentication state
│   │   ├── config/                 # Assessment configurations
│   │   │   ├── demographics.js
│   │   │   ├── stss.js
│   │   │   ├── proqol.js
│   │   │   └── stsioa.js
│   │   ├── pages/                  # Page components
│   │   │   ├── AssessmentFlow.jsx  # Public assessment flow
│   │   │   ├── TeamCodeEntry.jsx   # Team code entry
│   │   │   ├── Demographics.jsx
│   │   │   ├── STSS.jsx
│   │   │   ├── ProQOL.jsx
│   │   │   ├── STSIOA.jsx
│   │   │   ├── Login.jsx           # Admin login
│   │   │   └── AdminDashboard.jsx  # Admin dashboard
│   │   ├── styles/                 # Component styles
│   │   ├── utils/                  # Utility functions
│   │   │   └── supabase.js         # Supabase client
│   │   ├── App.jsx                 # Main app with routing
│   │   └── main.jsx                # Entry point
│   ├── package.json
│   └── .env.local                  # Environment variables (not in git)
└── README.md
```

---

## 🔐 AUTHENTICATION & ROUTING

### **Public Routes**
- `/` → Redirects to `/assessment`
- `/assessment` → Public assessment flow (no login required)

### **Protected Routes**
- `/login` → Admin login page
- `/dashboard` → Admin dashboard (requires authentication)

### **Role-Based Access**
- Routes can require specific roles using `<ProtectedRoute requireSuperAdmin={true}>`
- Auth context provides: `isSuperAdmin`, `isAgencyAdmin`, `isSeniorLeader`

---

## 💾 SAVING PROGRESS

**After making changes:**
```bash
git add .
git commit -m "Description of what you built"
git push origin main
```

**Your work is automatically saved in GitHub Codespaces**, but pushing to GitHub ensures it's permanently saved.

---

## 🔄 RESUMING DEVELOPMENT

### **Option 1: Using GitHub Codespaces** (Recommended)
1. Go to https://github.com/jafish0/sts-bsc-manager
2. Click "Code" → "Codespaces" → Open existing or create new
3. Once loaded:
```bash
   cd frontend
   npm install  # Only needed first time or after package.json changes
   npm run dev
```

### **Option 2: Local Development**
1. Pull latest changes:
```bash
   git pull origin main
   cd frontend
   npm install
   npm run dev
```

---

## 🤖 INSTRUCTIONS FOR CLAUDE AI

**When resuming this project with Claude, provide this context:**

### **Quick Start Message:**
> "I'm ready to continue Phase 2 of the STS-BSC Manager. Last session we completed the authentication system. Next we need to build Collaborative Management features. The repository is at https://github.com/jafish0/sts-bsc-manager and I'm working in GitHub Codespaces."

### **Key Points for Claude:**
1. **Phase 1 is complete** - All assessment instruments are built and working
2. **Phase 2 authentication is complete** - Login, protected routes, and admin dashboard shell are working
3. **Database schema is fully built** - All tables, relationships, views, and RLS policies exist in Supabase
4. **Current tech stack:**
   - React 19.1.1 with Vite
   - React Router DOM v6
   - Supabase Auth and Database
   - Inline styles (no CSS framework)
   - Brand colors: Navy (#0E1F56) and Teal (#00A79D)

5. **Development workflow:**
   - Josh works in GitHub Codespaces
   - Always provide COMPLETE file contents (never "find and replace" instructions)
   - Wait for confirmation after each step
   - Test iteratively

6. **What's next to build:**
   - Collaborative creation and management interface
   - Team management (add teams, generate codes)
   - Completion tracking dashboard
   - Data visualization dashboards
   - Review & commenting system
   - Agency admin portal
   - Discussion forums
   - Resource repository

7. **Important database notes:**
   - The `team_codes` table uses `active` column (not `is_active`)
   - Assessment data is anonymous - linked to teams, not individuals
   - `user_profiles.team_id` links agency admins to their team
   - Aggregate views auto-update when new data comes in

8. **File locations:**
   - All source code: `/workspaces/sts-bsc-manager/frontend/src/`
   - Supabase client: `/frontend/src/utils/supabase.js`
   - Auth context: `/frontend/src/contexts/AuthContext.jsx`
   - Main routing: `/frontend/src/App.jsx`

### **How to Share Code with Claude (Network Limitations)**

Claude cannot directly access GitHub repositories due to network restrictions. When resuming work, provide Claude with the current code state by running these commands and pasting the output:

#### **Step 1: Show Current File Structure**
```bash
cd /workspaces/sts-bsc-manager/frontend
ls -R src/
```

#### **Step 2: Share Key Files (if needed)**
```bash
# Show last 5 commits to see what was changed
git log --oneline -5

# Show specific file contents as needed
cat src/App.jsx
cat src/pages/AdminDashboard.jsx
```

#### **Step 3: Provide Context**
Tell Claude:
- What you completed in the last session
- What you want to build next
- Any errors or issues you're encountering

#### **Example Resume Message for Claude:**
```
I'm resuming the STS-BSC Manager project. Here's where we are:

COMPLETED:
- Phase 1: All assessments working
- Phase 2: Authentication system complete (login, protected routes, admin dashboard)

CURRENT FILE STRUCTURE:
[paste output of: ls -R src/]

NEXT TO BUILD:
- Collaborative Management interface

Ready to continue!
```

This approach lets Claude see the current state without needing GitHub access.

### **Common Commands:**
```bash
# Start dev server
cd frontend && npm run dev

# Install new packages
npm install package-name

# Save progress
git add . && git commit -m "message" && git push origin main

# View current structure
ls -R src/
```

---

## 📞 CONTACT

**Josh Fisherkeller**  
Center on Trauma & Children (CTAC)  
University of Kentucky  

---

## 📄 LICENSE

Proprietary - University of Kentucky  
For research and service delivery purposes only.

---

**Last Updated:** October 26, 2025  
**Current Phase:** Phase 2 - Authentication Complete, Collaborative Management Next
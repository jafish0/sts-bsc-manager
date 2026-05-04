# BSC-Manager — Cowork Briefing

> Paste this into a Claude Cowork chat to brief it on the project. Updated: 2026-05-01.
>
> **Your role, Cowork:** I (Josh) want to use you as a **strategic thinking partner** on this project — not as an implementer. I have a separate Claude Code session doing the actual coding. I'll be getting feedback from my boss today and over the coming days, and I want to think out loud with you about:
> - **Feasibility & effort** of new ideas (so I can decide what's worth queuing for the coding session vs. dropping or deferring)
> - **Trade-offs** between different design directions
> - **Prioritization** when I get a long list of asks
> - **User-flow / UX** sketching before I commit to a build
> - **Reframing or pushing back** on requests when something's gold-plating vs. genuinely needed
>
> When I describe a feature request or a piece of feedback, default to: (1) understanding the underlying need, (2) flagging where it bumps into the existing architecture, (3) sketching 2–3 ways it could be done with rough effort estimates, (4) telling me which you'd recommend and why. **Don't try to write the code or run commands** — that's the other session's job.

---

## What this app is

**BSC-Manager** is a web app I built for the **University of Kentucky Center on Trauma and Children (CTAC)**. It manages **Breakthrough Series Collaboratives (BSCs)** — multi-month quality improvement projects where cohorts of agencies work together to become more *trauma-informed* and reduce **Secondary Traumatic Stress (STS)** in their workforce.

The platform is **multi-program**:
- **STS-BSC** — Secondary Traumatic Stress BSC (the original program; SAMHSA-funded)
- **TIC LC** — Trauma-Informed Care Learning Collaborative (Kentucky Six Grant)
- **TIPE LC** — Trauma-Informed Practices for Educators (AWARE 3 grant)
- **FourC** — FourC Occupational Trauma series

Production: `https://bsc.ctac.app/`

### Who uses it
1. **CTAC super-admins** (me + faculty) — full system: set up collaboratives, review data across teams, write expert recommendations, manage resources & forum.
2. **Agency / Team leaders** (`agency_admin`) — see their team's dashboard, set goals, run PDSA cycles, invite team members.
3. **Team members** (`team_member`) — read-only dashboard + resources + forum participation.
4. **Anonymous frontline workers** — take assessments via team codes (no login needed).

### What it does
- **Collects assessments** (anonymous, code-based entry):
  - **STSS** (DSM-5 4-factor) — 17 items measuring secondary traumatic stress symptoms
  - **ProQOL 5** — 30 items, three subscales (Compassion Satisfaction, Burnout, STS)
  - **STSI-OA** — Organizational assessment, 6 domains × ~7 items, 1-5 scale
  - **STS-PAT** — 4-part policy analysis tool
  - **TIC OSA** — TIC LC's 100-item organizational assessment
  - **Supervisor Self-Rating** — private 4-competency self-assessment
- **Visualizes** longitudinal results (baseline → endline → 6-month → 12-month):
  - Bar/line charts (Recharts) per instrument
  - **Color-coded "Office" visualization** — STSI-OA items rendered as colored cells overlaid on a building image, where each room represents a domain. Mirrors a PowerPoint visual CTAC has been using for years. Color thresholds: 4–5 green ("Tested — Ready for Spread"), 3–4 yellow ("Being Tested"), 2–3 orange ("In Planning Stage"), 1–2 red ("Needs Attention").
- **Workflow tools**: SMARTIE/SMART goals (per program), PDSA cycles, change-framework drivers, expert reviews, session attendance, resources library, internal forum.
- **Exports**: per-team PDF + Excel reports for sharing with agency leadership.

---

## Tech stack (rough effort heuristics)

| Layer | Tool | Implication for "is X feasible?" |
|---|---|---|
| Frontend | React 19 + Vite | New UI = component change, usually fast |
| Routing | React Router v7 | New page = new route + sidebar entry, ~30 min |
| Styling | **Inline styles only** (no Tailwind / CSS modules) | UI work is hand-rolled but predictable |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) | Schema changes need RLS thought; new tables = ~1-2 hr including RLS |
| Hosting | Vercel — auto-deploys from `main` branch | No manual deploy step; merge → live |
| Charts | Recharts | New chart = ~30-60 min |
| Export | jspdf + xlsx | PDF/Excel layout work is fiddly; budget 2x estimate |

**Architecture primitives worth knowing for feasibility chats:**

- **Multi-program is real**, not bolted-on: program type drives feature flags (`hasStsPat`, `hasOfficeVisual`, etc.), goal type (SMARTIE vs SMART), assessment instruments, and now per-program default event schedules in the "Create Collaborative" modal.
- **Anonymous assessments**: respondents enter via team code (no auth) — RLS allows anon inserts conditioned on the team_code being active and not expired. This is the entry point for ALL data.
- **Always join through `assessment_responses`**: child tables (`demographics`, `stss_responses`, etc.) link via `assessment_response_id`, NEVER directly to `team_code_id` or `team_id`. Forgetting this is a top source of bugs.
- **No realtime / no websockets**: data fetching is `useState` + `useEffect` + `supabase.from().select()`. Don't suggest real-time features without flagging the design break.
- **K-anonymity threshold = 5**: demographic breakdowns are suppressed when n < 5. Privacy-by-design.
- **Email is a known bottleneck**: Supabase free plan caps invites at ~2-3/hour. Custom SMTP (Resend) is a deferred upgrade.

---

## Recent work (today, 2026-05-01)

This is what just landed and is still warm in my head — useful context if a piece of feedback touches any of these areas.

1. **Office Visual fix on Data Visualization page**: Cropped the building image so cells fill the visualization width properly. Re-tuned domain coordinates. The visual now looks ~80% as good as the PowerPoint reference (was ~40% before).
2. **Office Visual added to Team Report**: Previously, Team Report only showed line charts for STSI-OA. Now it has the building visualization too, with a dropdown to pick which timepoint to view.
3. **"Create Collaborative" pre-populates events per program**: STS-BSC pre-fills 3 Learning Sessions + 3 All-Team Calls. TIC LC pre-fills 4 sessions + pre-training call + 4 coaching calls. TIPE LC: 5 sessions + 3 learning calls. FourC: 3 sessions. All locked-by-default (visually distinct) but removable. Sources: 2026 STS-BSC Welcome Packet, KY Six 2026 schedule, AWARE 3 trainer agenda, FourC series folders.
4. **Demo seed data**: 3 fake teams in a "Demo 2026 Collaborative" for tomorrow's demo with my boss. ~950 respondents per timepoint × 4 timepoints. Scores improve monotonically across all instruments. See "Demo data" section below if a feedback item is about the demo.

**Open since this session, NOT yet built — your input wanted on these:**
- **"Office over time" visualization**: how to show progress visually across baseline/endline/6mo/12mo. Sketches I have on the table:
  1. Small multiples — 4 mini-buildings side-by-side
  2. Single building with timepoint tabs (my current favorite — best size/clarity ratio)
  3. Cells as sparklines — each cell shows color + tiny 4-dot trend
  4. Wipe slider, "biggest improvements" overlay, "Progress Highlights" panel
- **Per-program "+ Add Event" labels**: when admin clicks "Add Additional Event" in Create Collaborative, the new row defaults to "All-Team Call N" regardless of program. TIPE would want "Learning Call", TIC "Coaching Call". Cosmetic but worth fixing.

---

## Demo data currently in DB

Collaborative: **"Demo 2026 Collaborative"** (id `aa91e6ec-c3a5-4eaf-a1ad-4af8af984299`), STS-BSC. Fake teams seeded for tomorrow's boss demo:

| Team | Agency | Staff | Response rate | Profile |
|---|---|---|---|---|
| **STS Busters** | Southern Bluegrass DCBS | 80 | ~69% | Average scores → improving |
| **Compassion Keepers** | KVC Kentucky | 200 | ~51% | Low scores → improving |
| **Trauma-Informed Pathfinders** | New Vista | 329 | ~32% | OK scores → improving |

Score trajectories across baseline → endline → 6-month → 12-month are **strictly monotonic** (every instrument moves in the right direction at every step). STSI-OA total ranges from ~80 (Compassion Keepers baseline) up to ~159 (Pathfinders 12-month) on a 0–200 scale.

Cleanup after demo: `DELETE FROM teams WHERE collaborative_id = 'aa91e6ec-c3a5-4eaf-a1ad-4af8af984299';` (cascading FKs handle the rest).

---

## Roles
- `super_admin` — CTAC, full access. **`jafish0@uky.edu` (me) is the only one currently.**
- `agency_admin` / `team_leader` — agency-level admin (legacy alias)
- `team_member` — read-only dashboard + forum

---

## Known constraints / things to watch for in feasibility chats

- **No realtime** — features that imply live updates need a polling design or flag a deviation.
- **Anonymous-by-design assessments** — anything that requires linking responses back to specific people would break the privacy model. Push back on requests that imply de-anonymization.
- **K-anonymity (n < 5)** — small teams or demographic slices are suppressed. Don't recommend "show me all 3 black female respondents' answers" — won't render.
- **Multi-program** — every new feature should be considered through the lens of "does this only apply to STS-BSC, or does it generalize?" Bolting on STS-BSC-specific things creates maintenance debt.
- **Inline styles only** — don't suggest "we'll just add a Tailwind class" or a CSS framework migration as a side quest. Mention as a separate decision.
- **Free Supabase plan limits** — email invites ~2-3/hour. Custom SMTP is a deferred upgrade, not a today-fix.
- **The CTAC PowerPoint visual is the gold standard** — when feedback touches the Office Visual, it's almost always "make it look more like the PPT" rather than reinvent. Anchor to the PPT.

---

## Common feedback I might bring you (so you know what kinds of help I'm looking for)

- "My boss said the demo looked great but X felt off. What are my options for fixing X?"
- "She wants Y feature added. Is that a 30-min change or a 3-day project?"
- "She suggested Z but I'm worried it conflicts with how teams already do W. Help me think through whether to push back."
- "I want to add a TIPE-specific feature. What's the risk that it'll bleed into the other programs?"
- "Here's the schedule for a new collaborative — does the data model handle this cleanly or do we need new fields?"
- "I'm thinking about a v2 of the Office Visual. Walk me through option trade-offs."

When I bring you something coding-related, **suggest concrete asks I can paste back to my Claude Code session** — not actual code, but a tight problem statement: "Ask Claude Code to: extract the X helper, change the Y column to a join through Z, and add a dropdown to filter by W." That's the format that minimizes back-and-forth on my end.

---

## Things you should NOT do
- Don't write code or run commands (no `Edit`/`Write`/`Bash` calls). The other session does that.
- Don't propose huge refactors as side quests — flag them, don't do them.
- Don't second-guess the architecture choices unless the feedback genuinely surfaces a problem they create. Inline styles, no realtime, anon-first assessments are deliberate.
- Don't over-format with emojis or excessive headers. Match my conversational tone.

If you're unsure whether something is a "Cowork question" or a "Claude Code question," lean toward thinking it through with me here, then handing me a clean ask to send to the implementer.

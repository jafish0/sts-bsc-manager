// Program configuration for the multi-program BSC Platform
// Each program type defines branding, assessment info, and feature flags

// The three registration fields EVERY program must include. The public
// registration form, the email_confirm match rule, and the denormalized
// full_name / email columns on `event_registrations` all depend on these exact
// keys, so they're shared here rather than redefined per program.
// (Safe to share the objects: RegistrationLinkModal only ever replaces fields
// immutably — see updateField.)
const REGISTRATION_SYSTEM_FIELDS = [
  { key: 'full_name', label: 'Name', type: 'text', required: true, system: true },
  { key: 'email', label: 'Email', type: 'email', required: true, system: true },
  { key: 'email_confirm', label: 'Confirm Email', type: 'email_confirm', required: true, system: true, matches: 'email' },
]

export const PROGRAM_BRANDING = {
  sts_bsc: {
    key: 'sts_bsc',
    name: 'STS-BSC',
    fullName: 'Secondary Traumatic Stress Breakthrough Series Collaborative',
    assessmentTitle: 'STS-BSC Assessment',
    subtitle: 'STS Breakthrough Series Collaborative Manager',
    platformName: 'BSC Manager',
    // Feature flags
    hasStsPat: true,
    hasSupervisorSelfRating: true,
    hasOfficeVisual: true,
    hasResourceMapping: false,
    // Goal configuration
    goalType: 'smartie',
    goalLabel: 'SMARTIE Goal',
    goalFields: [
      { key: 'strategic', letter: 'S', label: 'Strategic', help: 'What do you hope you will accomplish?' },
      { key: 'measurable', letter: 'M', label: 'Measurable', help: 'How will you know if you are successful in achieving this goal? Include numbers or defined qualities so you know whether the goal has been met.' },
      { key: 'ambitious', letter: 'A', label: 'Ambitious', help: 'In what ways is this goal a stretch? What challenges do you anticipate?' },
      { key: 'realistic', letter: 'R', label: 'Realistic', help: 'Where are your opportunities? How will it be possible to achieve?' },
      { key: 'time_bound', letter: 'T', label: 'Time-Bound', help: 'What is your timeline and deadline for achieving this goal?' },
      { key: 'inclusive', letter: 'I', label: 'Inclusive', help: 'In what ways will this goal bring people who are often excluded into processes, activities, and decision/policy-making in a way that shares power?' },
      { key: 'equitable', letter: 'E', label: 'Equitable', help: 'In what ways will this goal address fairness or justice to address systemic injustice, inequity, or oppression?' },
    ],
    // Default events pre-populated when creating a collaborative.
    // Source: 2026 STS-BSC Welcome Packet — 3 Learning Sessions + 3 All-Team Calls (1st is Welcome & Orientation).
    defaultEvents: [
      { event_type: 'learning_session', title: 'Learning Session 1', sequence_number: 1 },
      { event_type: 'learning_session', title: 'Learning Session 2', sequence_number: 2 },
      { event_type: 'learning_session', title: 'Learning Session 3', sequence_number: 3 },
      { event_type: 'all_team_call', title: 'All-Team Call 1 (Welcome & Orientation)', sequence_number: 1 },
      { event_type: 'all_team_call', title: 'All-Team Call 2', sequence_number: 2 },
      { event_type: 'all_team_call', title: 'All-Team Call 3', sequence_number: 3 },
    ],
    // Used by the "+ Add Additional Event" button to seed the new row with a
    // sensible per-program default (label + event_type). The admin can still
    // change the type/title afterward.
    addEventDefault: { label: 'All-Team Call', event_type: 'all_team_call' },
    // Default registration-form fields. Labels vary per program, KEYS do not —
    // `agency` / `role` stay canonical so rosters, CSV exports, and anything
    // reading those columns behave the same across programs.
    registrationFields: [
      ...REGISTRATION_SYSTEM_FIELDS,
      { key: 'agency', label: 'Agency', type: 'text', required: true },
      { key: 'role', label: 'Role at agency', type: 'text', required: true },
    ],
  },
  tic_lc: {
    key: 'tic_lc',
    name: 'TIC LC',
    fullName: 'Trauma-Informed Care Learning Collaborative',
    assessmentTitle: 'TIC LC Assessment',
    subtitle: 'Trauma-Informed Care Learning Collaborative Manager',
    platformName: 'BSC Manager',
    hasStsPat: false,
    hasSupervisorSelfRating: false,
    hasOfficeVisual: false,
    hasResourceMapping: true,
    goalType: 'smart',
    goalLabel: 'S.M.A.R.T Goal',
    goalFields: [
      { key: 'strategic', letter: 'S', label: 'Specific', help: 'What exactly will you accomplish?' },
      { key: 'measurable', letter: 'M', label: 'Measurable', help: 'How will you measure success?' },
      { key: 'ambitious', letter: 'A', label: 'Achievable', help: 'Is this goal realistic and attainable?' },
      { key: 'realistic', letter: 'R', label: 'Relevant', help: 'Why does this goal matter to your organization?' },
      { key: 'time_bound', letter: 'T', label: 'Time-Bound', help: 'By when will this be accomplished?' },
    ],
    // Source: KY Six Year 3 (2026) Proposed Schedule — 1 Pre-training Call + 4 Sessions + 4 Coaching Calls (interleaved).
    defaultEvents: [
      { event_type: 'all_team_call', title: 'Pre-training Call (Intro & LC Overview)', sequence_number: 1 },
      { event_type: 'learning_session', title: 'Learning Session 1', sequence_number: 1 },
      { event_type: 'learning_session', title: 'Learning Session 2', sequence_number: 2 },
      { event_type: 'learning_session', title: 'Learning Session 3', sequence_number: 3 },
      { event_type: 'learning_session', title: 'Learning Session 4', sequence_number: 4 },
      { event_type: 'all_team_call', title: 'Coaching Call 1', sequence_number: 2 },
      { event_type: 'all_team_call', title: 'Coaching Call 2', sequence_number: 3 },
      { event_type: 'all_team_call', title: 'Coaching Call 3', sequence_number: 4 },
      { event_type: 'all_team_call', title: 'Coaching Call 4', sequence_number: 5 },
    ],
    addEventDefault: { label: 'Implementation Session', event_type: 'all_team_call' },
    // Same five as STS-BSC (Agency / Role at agency wording unchanged).
    registrationFields: [
      ...REGISTRATION_SYSTEM_FIELDS,
      { key: 'agency', label: 'Agency', type: 'text', required: true },
      { key: 'role', label: 'Role at agency', type: 'text', required: true },
    ],
  },
  tipe_lc: {
    key: 'tipe_lc',
    name: 'TIPE LC',
    fullName: 'Trauma-Informed Practices for Educators and School Personnel Learning Collaborative',
    assessmentTitle: 'TIPE LC Assessment',
    subtitle: 'Trauma-Informed Practices for Educators LC Manager',
    platformName: 'BSC Manager',
    hasStsPat: false,
    hasSupervisorSelfRating: false,
    hasOfficeVisual: false,
    hasResourceMapping: false,
    goalType: 'smart',
    goalLabel: 'S.M.A.R.T Goal',
    goalFields: [
      { key: 'strategic',  letter: 'S', label: 'Specific',      help: 'WHO is doing the work, and WHAT exactly needs to be done? Linked to a role, the goals of a team/department, and/or overall school or district goals.' },
      { key: 'measurable', letter: 'M', label: 'Measurable',    help: "HOW will we know we've reached this goal? Success can be objectively measured, counted, and/or observed." },
      { key: 'ambitious',  letter: 'A', label: 'Achievable',    help: 'Is this goal REASONABLE? Realistic and achievable in a specific, short amount of time.' },
      { key: 'realistic',  letter: 'R', label: 'Relevant',      help: 'What are we hoping to accomplish? Aligned with current tasks/projects, focused on one defined area; include the expected result.' },
      { key: 'time_bound', letter: 'T', label: 'Time-Oriented', help: 'WHEN? A clearly defined time-frame including a target or deadline date. Can be detailed in action steps.' },
    ],
    // Source: AWARE 3 Year 3 Trainer Agenda — 5 Learning Sessions + 3 Learning Calls (interleaved between sessions).
    defaultEvents: [
      { event_type: 'learning_session', title: 'Learning Session 1', sequence_number: 1 },
      { event_type: 'learning_session', title: 'Learning Session 2', sequence_number: 2 },
      { event_type: 'learning_session', title: 'Learning Session 3', sequence_number: 3 },
      { event_type: 'learning_session', title: 'Learning Session 4', sequence_number: 4 },
      { event_type: 'learning_session', title: 'Learning Session 5', sequence_number: 5 },
      { event_type: 'all_team_call', title: 'Learning Call 1', sequence_number: 1 },
      { event_type: 'all_team_call', title: 'Learning Call 2', sequence_number: 2 },
      { event_type: 'all_team_call', title: 'Learning Call 3', sequence_number: 3 },
    ],
    addEventDefault: { label: 'Implementation Session', event_type: 'all_team_call' },
    // TIPE registrants are school/district staff, so the labels are
    // schools-flavored — but the KEYS stay canonical (`agency` holds the school
    // or district, `role` holds the position) so rosters/exports don't fork.
    registrationFields: [
      ...REGISTRATION_SYSTEM_FIELDS,
      { key: 'agency', label: 'School or District', type: 'text', required: true },
      { key: 'role', label: 'Position or Title', type: 'text', required: true },
      { key: 'districts', label: 'District(s) Served', type: 'text', required: false },
      { key: 'grade_levels', label: 'Grade Level(s)', type: 'text', required: false },
    ],
    // Schools-flavored "add a common field" presets (falls back to the shared
    // list in RegistrationLinkModal when a program doesn't define these).
    registrationFieldPresets: [
      { key: 'phone', label: 'Phone (optional, for SMS reminders)', type: 'phone', required: false },
      { key: 'school', label: 'School (building)', type: 'text', required: false },
      { key: 'grade_levels', label: 'Grade Level(s)', type: 'text', required: false },
      { key: 'subject_areas', label: 'Subject Area(s)', type: 'text', required: false },
      { key: 'districts', label: 'District(s) Served', type: 'text', required: false },
      { key: 'how_heard', label: 'How did you hear about this training?', type: 'textarea', required: false },
      { key: 'accommodations', label: 'Accommodation needs (optional)', type: 'textarea', required: false },
    ],
  },
  fourc: {
    key: 'fourc',
    name: 'FourC',
    fullName: 'FourC Occupational Trauma',
    assessmentTitle: 'FourC Assessment',
    subtitle: 'FourC Occupational Trauma Manager',
    platformName: 'BSC Manager',
    hasStsPat: true,
    hasSupervisorSelfRating: false,
    hasOfficeVisual: false,
    hasResourceMapping: false,
    goalType: 'smartie',
    goalLabel: 'SMARTIE Goal',
    goalFields: [],
    // Source: FourC series folders (July 2025, December 2025, Spring 2026) — 3 Sessions: Calming, Cognitive Coping, Connections.
    defaultEvents: [
      { event_type: 'learning_session', title: 'Session 1: Calming', sequence_number: 1 },
      { event_type: 'learning_session', title: 'Session 2: Cognitive Coping', sequence_number: 2 },
      { event_type: 'learning_session', title: 'Session 3: Connections', sequence_number: 3 },
    ],
    addEventDefault: { label: 'All-Team Call', event_type: 'all_team_call' },
  },
}

// Default fallback for when program_type is unknown
export const DEFAULT_PROGRAM = PROGRAM_BRANDING.sts_bsc

// Get branding for a program type (with fallback)
export function getProgramBranding(programType) {
  return PROGRAM_BRANDING[programType] || DEFAULT_PROGRAM
}

// STS-BSC domain labels (kept as fallback for pages that haven't migrated to dynamic domains yet)
export const STS_DOMAIN_LABELS = {
  resilience: 'Promotion of Resilience Building Activities',
  safety: 'Sense of Safety',
  policies: 'Organizational Policies',
  leadership: 'Practices of Leaders',
  routine: 'Routine Organizational Practices',
  evaluation: 'Evaluation and Monitoring',
}

// Program type badge colors for admin UI
export const PROGRAM_TYPE_COLORS = {
  sts_bsc: { bg: '#dbeafe', color: '#1e40af', label: 'STS-BSC' },
  tic_lc: { bg: '#d1fae5', color: '#065f46', label: 'TIC LC' },
  tipe_lc: { bg: '#fef3c7', color: '#92400e', label: 'TIPE LC' },
  fourc: { bg: '#ede9fe', color: '#5b21b6', label: 'FourC' },
}

// Program types that can be selected when CREATING a new collaborative.
// FourC is intentionally excluded: it has no assessment routes or score
// columns, so a FourC collaborative would land on broken/empty dashboards.
// (PROGRAM_TYPE_COLORS still includes fourc so existing collaboratives and
// badges render correctly.) Order here is the order shown in the dropdown.
export const CREATABLE_PROGRAM_TYPES = ['sts_bsc', 'tic_lc', 'tipe_lc']

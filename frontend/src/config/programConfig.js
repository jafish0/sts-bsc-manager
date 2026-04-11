// Program configuration for the multi-program BSC Platform
// Each program type defines branding, assessment info, and feature flags

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
    goalFields: [],
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

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
  },
  fourc: {
    key: 'fourc',
    name: 'FourC',
    fullName: 'FourC Occupational Trauma',
    assessmentTitle: 'FourC Assessment',
    subtitle: 'FourC Occupational Trauma Manager',
    platformName: 'BSC Manager',
    hasStsPat: true, // confirmed needs equivalent
    hasSupervisorSelfRating: false,
    hasOfficeVisual: false,
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

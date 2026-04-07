// Shared constants for STS-BSC Manager

// STSI-OA domain max scores
export const STSIOA_DOMAIN_MAX = {
  resilience: 28,
  safety: 28,
  policies: 24,
  leadership: 24,
  routine: 44,
  evaluation: 44
}
export const STSIOA_TOTAL_MAX = 200

// STSS DSM-5 4-factor subscale item mapping
export const STSS_SUBSCALES = {
  intrusion: { items: [2, 3, 6, 10, 13], label: 'Intrusion', range: '5-25', max: 25 },
  avoidance: { items: [1, 9, 12, 14], label: 'Avoidance', range: '4-20', max: 20 },
  negCognitions: { items: [5, 7, 11, 17], label: 'Neg. Cognitions & Mood', range: '4-20', max: 20 },
  arousal: { items: [4, 8, 15, 16], label: 'Arousal', range: '4-20', max: 20 }
}

// Chart color palette
export const COLORS = {
  navy: '#0E1F56',
  teal: '#00A79D',
  blue: '#4682b4',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  lime: '#84cc16',
  indigo: '#6366f1'
}

export const PIE_COLORS = [COLORS.blue, COLORS.purple, COLORS.pink, COLORS.amber, COLORS.green, COLORS.cyan, COLORS.indigo, COLORS.lime]

// Timepoint definitions
export const TIMEPOINTS = [
  { value: 'baseline', label: 'Baseline' },
  { value: 'endline', label: 'Endline' },
  { value: 'followup_6mo', label: '6-Month Follow-up' },
  { value: 'followup_12mo', label: '12-Month Follow-up' }
]

export const TIMEPOINT_LABELS = {
  baseline: 'Baseline',
  endline: 'Endline',
  followup_6mo: '6-Month',
  followup_12mo: '12-Month'
}

export const TIMEPOINT_ORDER = ['baseline', 'endline', 'followup_6mo', 'followup_12mo']

// Compute STSS subscale score from item columns
export function computeSTSSSubscale(response, itemNumbers) {
  return itemNumbers.reduce((sum, num) => sum + (response[`item_${num}`] || 0), 0)
}

// Standard deviation helper (sample SD, n-1)
export function stddev(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

// Shared card styles
export const cardStyle = { background: 'white', borderRadius: '0.5rem', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
export const cardHeaderStyle = { background: COLORS.navy, color: 'white', padding: '0.6rem 1rem', marginBottom: '1rem', fontWeight: '600', textAlign: 'center', borderRadius: '0.25rem', fontSize: '0.9rem' }
export const subtitleStyle = { fontSize: '0.75rem', fontWeight: '600', textAlign: 'center', marginBottom: '0.5rem', color: '#374151' }

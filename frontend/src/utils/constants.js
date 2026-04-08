// Shared constants for STS-BSC Manager

// STSI-OA domain options (used in SmartieGoalForm, Resources, etc.)
export const DOMAIN_OPTIONS = [
  { value: 'resilience', label: 'Domain 1 — Promotion of Resilience Building Activities' },
  { value: 'safety', label: 'Domain 2 — Sense of Safety' },
  { value: 'policies', label: 'Domain 3 — Organizational Policies' },
  { value: 'leadership', label: 'Domain 4 — Practices of Leaders' },
  { value: 'routine', label: 'Domain 5 — Routine Organizational Practices' },
  { value: 'evaluation', label: 'Domain 6 — Evaluation and Monitoring' }
]

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

// K-anonymity: suppress demographic breakdowns when response count is below this threshold
export const K_ANONYMITY_THRESHOLD = 5

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

// Relative time helper
export function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

// Shared card styles (using CSS variables for dark mode support)
export const cardStyle = { background: 'var(--bg-card)', borderRadius: '0.5rem', padding: '1.25rem', boxShadow: 'var(--shadow-card)' }
export const cardHeaderStyle = { background: 'var(--header-navy)', color: 'white', padding: '0.6rem 1rem', marginBottom: '1rem', fontWeight: '600', textAlign: 'center', borderRadius: '0.25rem', fontSize: '0.9rem' }
export const subtitleStyle = { fontSize: '0.75rem', fontWeight: '600', textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-secondary)' }

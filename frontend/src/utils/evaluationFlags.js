// Rules-based flagging for contradictory session-evaluation responses.
//
// Derived from the first REAL evaluation dataset (41 responses, 2026-08-07
// standalone training): two respondents rated all six Likert items 1
// (Strongly Disagree) while writing glowing comments AND giving a recommend
// score of 10 — almost certainly reversed-scale confusion. Verified against
// that dataset: Rule A catches exactly those two rows with zero false
// positives across all 41.
//
// Constraints (Ginny's, for all data cleaning): purely numeric rules — no
// sentiment analysis, no keyword lists, no AI. Flag, never drop, never
// auto-correct: a flagged response stays in every count, mean, and NPS
// exactly as submitted.
//
// This is the first concrete data-cleaning rule derived from real data; it
// belongs in the (currently blocked) data-cleaning stage's ruleset when that
// feature unblocks. Keep the implementation HERE, shared, so the admin view,
// exports, and the future cleaning stage don't each reinvent it.

export const LIKERT_KEYS = [
  'trainer_effective',
  'content_objective_alignment',
  'applicable_to_work',
  'practical_knowledge',
  'methods_appropriate_audience',
  'methods_appropriate_subject',
]

// Returns an array of flags for one evaluation row (empty = clean).
// Each flag: { rule, severity: 'high'|'info', label, detail }
export function flagEvaluation(ev) {
  const flags = []
  const values = LIKERT_KEYS.map(k => ev?.[k]).filter(v => v != null)
  if (values.length === 0) return flags

  const min = Math.min(...values)
  const max = Math.max(...values)
  const nps = ev?.recommend_score

  // Rule A — contradiction (high confidence). Skipped entirely when the
  // recommend score is missing: without it there is no second signal to
  // contradict. A genuinely dissatisfied respondent rates low AND recommends
  // low, so real criticism is never flagged — contradictions are.
  if (nps != null) {
    if (max <= 2 && nps >= 9) {
      flags.push({
        rule: 'contradiction',
        severity: 'high',
        label: 'Likely reversed scale',
        detail: `Every item rated ${max <= 1 ? 'Strongly Disagree' : 'Disagree or lower'} (max ${max}) but recommend score is ${nps}/10 — ratings and recommendation contradict each other.`,
      })
    } else if (min >= 4 && nps <= 6) {
      flags.push({
        rule: 'contradiction',
        severity: 'high',
        label: 'Ratings/recommendation mismatch',
        detail: `Every item rated Agree or higher (min ${min}) but recommend score is ${nps}/10 — ratings and recommendation contradict each other.`,
      })
    }
  }

  // Rule B — straight-lining (weak signal, deliberately labelled as such).
  // All-5s is common and usually sincere; never present this at Rule A's
  // severity.
  if (values.length === LIKERT_KEYS.length && min === max) {
    flags.push({
      rule: 'straight_line',
      severity: 'info',
      label: 'Straight-lined',
      detail: `All six items rated ${min} — often sincere (especially all 5s), noted only as context.`,
    })
  }

  return flags
}

// Convenience over a list: returns [{ index, evaluation, flags }] for rows
// with at least one flag of the given minimum severity.
export function flagEvaluations(evaluations, { minSeverity = 'high' } = {}) {
  const out = []
  ;(evaluations || []).forEach((ev, index) => {
    const flags = flagEvaluation(ev)
    const kept = minSeverity === 'high' ? flags.filter(f => f.severity === 'high') : flags
    if (kept.length > 0) out.push({ index, evaluation: ev, flags })
  })
  return out
}

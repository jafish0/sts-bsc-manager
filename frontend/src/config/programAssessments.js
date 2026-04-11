// Program-specific assessment instrument sequences
// Maps each program_type to its ordered list of assessment instruments

export const ASSESSMENT_SEQUENCES = {
  sts_bsc: [
    { key: 'demographics', path: '/demographics', label: 'Demographics', storageKey: 'sts_demographics' },
    { key: 'stss', path: '/stss', label: 'STSS', storageKey: 'sts_stss' },
    { key: 'proqol', path: '/proqol', label: 'ProQOL', storageKey: 'sts_proqol' },
    { key: 'stsioa', path: '/stsioa', label: 'STSI-OA', storageKey: 'sts_stsioa', completeFlag: 'stsioa_complete' },
  ],
  tic_lc: [
    { key: 'demographics', path: '/demographics', label: 'Demographics', storageKey: 'sts_demographics' },
    { key: 'tic_osa', path: '/tic-osa', label: 'TIC OSA', storageKey: 'sts_ticosa', completeFlag: 'tic_osa_complete' },
  ],
}

// Default to STS-BSC if program type unknown
export function getAssessmentSequence(programType) {
  return ASSESSMENT_SEQUENCES[programType] || ASSESSMENT_SEQUENCES.sts_bsc
}

// Get the next path after a given step key
export function getNextAssessmentPath(programType, currentStepKey) {
  const sequence = getAssessmentSequence(programType)
  const currentIndex = sequence.findIndex(s => s.key === currentStepKey)
  if (currentIndex < 0 || currentIndex >= sequence.length - 1) return '/complete'
  return sequence[currentIndex + 1].path
}

// Get the progress steps for the progress bar
export function getProgressSteps(programType) {
  return getAssessmentSequence(programType).map(s => s.label)
}

// Get the index of the current step (for progress bar highlighting)
export function getStepIndex(programType, currentStepKey) {
  const sequence = getAssessmentSequence(programType)
  return sequence.findIndex(s => s.key === currentStepKey)
}

// Get all localStorage keys to clear on completion
export function getStorageKeysToClear(programType) {
  const sequence = getAssessmentSequence(programType)
  return [
    'sts_teamCodeId',
    'sts_teamCode',
    'sts_assessmentResponseId',
    'sts_programType',
    ...sequence.map(s => s.storageKey),
  ]
}

// Check if a program uses a specific instrument
export function programHasInstrument(programType, instrumentKey) {
  const sequence = getAssessmentSequence(programType)
  return sequence.some(s => s.key === instrumentKey)
}

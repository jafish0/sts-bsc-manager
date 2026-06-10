// Professional Quality of Life Scale (ProQOL 5) Configuration
// Copyright © 2009 Beth Hudnall Stamm
// www.ProQOL.org
// This measure may be freely copied as long as (a) author is credited, (b) no changes are made, 
// and (c) it is not sold.

export const PROQOL_COPYRIGHT = {
  text: 'Copyright © 2009 Beth Hudnall Stamm',
  citation: 'Beth Hudnall Stamm (2009). Professional Quality of Life: Compassion Satisfaction and Fatigue Version 5 (ProQOL). www.ProQOL.org. This measure may be freely copied as long as (a) author is credited, (b) no changes are made, and (c) it is not sold.',
  website: 'www.ProQOL.org'
}

export const PROQOL_INFO = {
  title: 'About the Professional Quality of Life Scale (ProQOL 5)',
  description: 'The ProQOL measures the effects of helping others who experience suffering and trauma.',
  // STS subscale dropped 2026-05-08 (STSS measures it more rigorously);
  // Compassion Satisfaction dropped 2026-06-10 — per Dr. Sprang, ProQOL
  // administration uses ONLY the burnout subscale to reduce respondent
  // burden.
  purpose: 'When you help people, you have direct contact with their lives. This assessment helps understand the strain (burnout) your work can create.',
  scoring: 'This shortened ProQOL administration includes the 10-item burnout subscale:',
  subscales: [
    {
      name: 'Burnout',
      description: 'Feelings of hopelessness and difficulties in dealing with work (10 items)',
      range: 'Scores of 22 or less = Low, 23-41 = Moderate, 42 or more = High',
      interpretation: 'Higher scores indicate higher risk of burnout'
    }
  ],
  confidentiality: 'Your responses are confidential and help your organization understand how your work affects you. Individual scores are not shared.',
  note: 'Note: Items marked with [helping] can be replaced with more specific terms such as [teaching], [coaching], or [nurse], depending on your profession.'
}

export const RESPONSE_OPTIONS = [
  { value: 1, label: 'Never' },
  { value: 2, label: 'Rarely' },
  { value: 3, label: 'Sometimes' },
  { value: 4, label: 'Often' },
  { value: 5, label: 'Very Often' }
]

// Per Dr. Sprang, ProQOL administration uses ONLY the burnout subscale:
// - secondary_trauma items (orig. IDs 2, 5, 7, 9, 11, 13, 14, 23, 25, 28)
//   dropped 2026-05-08 — STSS measures it more rigorously.
// - compassion_satisfaction items (orig. IDs 3, 6, 12, 16, 18, 20, 22, 24,
//   27, 30) dropped 2026-06-10 — respondent-burden reduction.
// Item IDs of the remaining 10 burnout items are intentionally left at
// their original ProQOL 5 values so historical proqol_responses rows
// remain comparable.
export const PROQOL_ITEMS = [
  {
    id: 1,
    text: 'I am happy.',
    subscale: 'burnout',
    reverseScored: true
  },
  {
    id: 4,
    text: 'I feel connected to others.',
    subscale: 'burnout',
    reverseScored: true
  },
  {
    id: 8,
    text: 'I am not as productive at work because I am losing sleep over traumatic experiences of a person I [help].',
    subscale: 'burnout'
  },
  {
    id: 10,
    text: 'I feel trapped by my job as a [helper].',
    subscale: 'burnout'
  },
  {
    id: 15,
    text: 'I have beliefs that sustain me.',
    subscale: 'burnout',
    reverseScored: true
  },
  {
    id: 17,
    text: 'I am the person I always wanted to be.',
    subscale: 'burnout',
    reverseScored: true
  },
  {
    id: 19,
    text: 'I feel worn out because of my work as a [helper].',
    subscale: 'burnout'
  },
  {
    id: 21,
    text: 'I feel overwhelmed because my case [work] load seems endless.',
    subscale: 'burnout'
  },
  {
    id: 26,
    text: 'I feel "bogged down" by the system.',
    subscale: 'burnout'
  },
  {
    id: 29,
    text: 'I am a very caring person.',
    subscale: 'burnout',
    reverseScored: true
  }
]

export const TIMEFRAME_NOTE = 'NOTE: Consider each of the following questions about you and your current work situation. Select the number that honestly reflects how frequently you experienced these things in the last 30 days.'

export const INSTRUCTIONS = 'When you [help] people, you have direct contact with their lives. As you may have found, your compassion for those you [help] can affect you in positive and negative ways. Below are some questions about your experiences, both positive and negative, as a [helper]. Consider each of the following questions about you and your current work situation.'

export const HELPER_NOTE = 'Note that the words "[help]" and "[helper]" and variations like "[helping]" can be replaced with more specific terms such as "teach" and "teacher", "coach", "therapist", "nurse", or other terms that better represent your work.'
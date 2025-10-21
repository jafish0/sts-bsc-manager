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
  description: 'The ProQOL measures the positive and negative effects of helping others who experience suffering and trauma.',
  purpose: 'When you help people, you have direct contact with their lives. This assessment helps understand both the positive aspects (compassion satisfaction) and negative aspects (burnout and secondary traumatic stress) of your work.',
  scoring: 'The ProQOL consists of 30 items divided into three subscales:',
  subscales: [
    {
      name: 'Compassion Satisfaction',
      description: 'The pleasure you derive from being able to do your work well (10 items)',
      range: 'Scores of 22 or less = Low, 23-41 = Moderate, 42 or more = High',
      interpretation: 'Higher scores indicate greater satisfaction with your ability to provide effective care'
    },
    {
      name: 'Burnout',
      description: 'Feelings of hopelessness and difficulties in dealing with work (10 items)',
      range: 'Scores of 22 or less = Low, 23-41 = Moderate, 42 or more = High',
      interpretation: 'Higher scores indicate higher risk of burnout'
    },
    {
      name: 'Secondary Traumatic Stress',
      description: 'Work-related secondary exposure to extremely stressful events (10 items)',
      range: 'Scores of 22 or less = Low, 23-41 = Moderate, 42 or more = High',
      interpretation: 'Higher scores indicate higher levels of secondary traumatic stress'
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

export const PROQOL_ITEMS = [
  {
    id: 1,
    text: 'I am happy.',
    subscale: 'burnout',
    reverseScored: true
  },
  {
    id: 2,
    text: 'I am preoccupied with more than one person I [help].',
    subscale: 'secondary_trauma'
  },
  {
    id: 3,
    text: 'I get satisfaction from being able to [help] people.',
    subscale: 'compassion_satisfaction'
  },
  {
    id: 4,
    text: 'I feel connected to others.',
    subscale: 'burnout',
    reverseScored: true
  },
  {
    id: 5,
    text: 'I jump or am startled by unexpected sounds.',
    subscale: 'secondary_trauma'
  },
  {
    id: 6,
    text: 'I feel invigorated after working with those I [help].',
    subscale: 'compassion_satisfaction'
  },
  {
    id: 7,
    text: 'I find it difficult to separate my personal life from my life as a [helper].',
    subscale: 'secondary_trauma'
  },
  {
    id: 8,
    text: 'I am not as productive at work because I am losing sleep over traumatic experiences of a person I [help].',
    subscale: 'burnout'
  },
  {
    id: 9,
    text: 'I think that I might have been affected by the traumatic stress of those I [help].',
    subscale: 'secondary_trauma'
  },
  {
    id: 10,
    text: 'I feel trapped by my job as a [helper].',
    subscale: 'burnout'
  },
  {
    id: 11,
    text: 'Because of my [helping], I have felt "on edge" about various things.',
    subscale: 'secondary_trauma'
  },
  {
    id: 12,
    text: 'I like my work as a [helper].',
    subscale: 'compassion_satisfaction'
  },
  {
    id: 13,
    text: 'I feel depressed because of the traumatic experiences of the people I [help].',
    subscale: 'secondary_trauma'
  },
  {
    id: 14,
    text: 'I feel as though I am experiencing the trauma of someone I have [helped].',
    subscale: 'secondary_trauma'
  },
  {
    id: 15,
    text: 'I have beliefs that sustain me.',
    subscale: 'burnout',
    reverseScored: true
  },
  {
    id: 16,
    text: 'I am pleased with how I am able to keep up with [helping] techniques and protocols.',
    subscale: 'compassion_satisfaction'
  },
  {
    id: 17,
    text: 'I am the person I always wanted to be.',
    subscale: 'burnout',
    reverseScored: true
  },
  {
    id: 18,
    text: 'My work makes me feel satisfied.',
    subscale: 'compassion_satisfaction'
  },
  {
    id: 19,
    text: 'I feel worn out because of my work as a [helper].',
    subscale: 'burnout'
  },
  {
    id: 20,
    text: 'I have happy thoughts and feelings about those I [help] and how I could help them.',
    subscale: 'compassion_satisfaction'
  },
  {
    id: 21,
    text: 'I feel overwhelmed because my case [work] load seems endless.',
    subscale: 'burnout'
  },
  {
    id: 22,
    text: 'I believe I can make a difference through my work.',
    subscale: 'compassion_satisfaction'
  },
  {
    id: 23,
    text: 'I avoid certain activities or situations because they remind me of frightening experiences of the people I [help].',
    subscale: 'secondary_trauma'
  },
  {
    id: 24,
    text: 'I am proud of what I can do to [help].',
    subscale: 'compassion_satisfaction'
  },
  {
    id: 25,
    text: 'As a result of my [helping], I have intrusive, frightening thoughts.',
    subscale: 'secondary_trauma'
  },
  {
    id: 26,
    text: 'I feel "bogged down" by the system.',
    subscale: 'burnout'
  },
  {
    id: 27,
    text: 'I have thoughts that I am a "success" as a [helper].',
    subscale: 'compassion_satisfaction'
  },
  {
    id: 28,
    text: 'I can\'t recall important parts of my work with trauma victims.',
    subscale: 'secondary_trauma'
  },
  {
    id: 29,
    text: 'I am a very caring person.',
    subscale: 'burnout',
    reverseScored: true
  },
  {
    id: 30,
    text: 'I am happy that I chose to do this work.',
    subscale: 'compassion_satisfaction'
  }
]

export const TIMEFRAME_NOTE = 'NOTE: Consider each of the following questions about you and your current work situation. Select the number that honestly reflects how frequently you experienced these things in the last 30 days.'

export const INSTRUCTIONS = 'When you [help] people, you have direct contact with their lives. As you may have found, your compassion for those you [help] can affect you in positive and negative ways. Below are some questions about your experiences, both positive and negative, as a [helper]. Consider each of the following questions about you and your current work situation.'

export const HELPER_NOTE = 'Note that the words "[help]" and "[helper]" and variations like "[helping]" can be replaced with more specific terms such as "teach" and "teacher", "coach", "therapist", "nurse", or other terms that better represent your work.'
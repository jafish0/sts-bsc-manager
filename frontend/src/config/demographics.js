// Demographics Configuration
// Edit these values to change dropdown options, ranges, etc.

export const GENDER_OPTIONS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'prefer_not_answer', label: 'Prefer Not to Answer' },
  { value: 'not_listed', label: 'Not Listed (please specify)' }
]

export const AGE_CONFIG = {
  min: 18,
  max: 65,
  over65Label: '>65'
}

export const YEARS_SERVICE_CONFIG = {
  min: 0,
  max: 30,
  over30Label: '>30'
}

export const JOB_ROLES = [
  'Case Manager',
  'Front-Line Clinician',
  'Clinical Supervisor',
  'Leadership',
  'Regional Leadership',
  'Peer Support Specialist',
  'Community Support Associate',
  'Medical Staff',
  'Other (please specify)'
]

export const AREAS_OF_RESPONSIBILITY = [
  'Developmental/Intellectual Disabilities',
  'Adult Mental Health Services',
  "Children's Services",
  'Crisis Response Services',
  'Substance Use Services',
  'Administrative/Financial Services',
  'Multi-Team',
  'Other (please specify)'
]

export const EXPOSURE_LEVEL_CONFIG = {
  min: 0,
  max: 100,
  labels: {
    low: 'No exposure to traumatic material',
    mid: 'Moderate exposure to traumatic material',
    high: 'Extreme/constant exposure to traumatic material'
  }
}

// Exposure explanation text (DSM-5 based)
export const EXPOSURE_EXPLANATION = {
  title: 'Understanding Trauma Exposure in Your Work',
  intro: 'People who work in helping professions may be exposed to traumatic events in different ways. According to the DSM-5, a traumatic event involves actual or threatened death, serious injury, or sexual violence.',
  types: [
    {
      title: 'Direct exposure',
      description: 'You personally experienced the traumatic event',
      example: 'Surviving a serious accident'
    },
    {
      title: 'Witnessing in person',
      description: 'You saw the traumatic event happen to others',
      example: 'Witnessing a violent assault'
    },
    {
      title: 'Learning about trauma to loved ones',
      description: 'A close family member or friend experienced the event',
      example: 'Learning your child was violently attacked'
    },
    {
      title: 'Indirect exposure through professional duties',
      description: 'You experience repeated or extreme indirect exposure to traumatic details through your work',
      examples: [
        'A police officer repeatedly reviewing forensic evidence of child abuse',
        'A therapist regularly hearing detailed accounts of clients\' traumatic experiences'
      ],
      note: 'This does not include learning about trauma through media, TV, or movies unless it\'s a work requirement'
    }
  ],
  conclusion: 'This fourth type of exposure is what we call Secondary Traumatic Stress (STS). Understanding your level of exposure helps us better support you and your organization.'
}
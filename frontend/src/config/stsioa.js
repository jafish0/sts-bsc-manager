// Secondary Traumatic Stress-Informed Organizational Assessment (STSI-OA)
// Copyright © Sprang, G., Ross, L., Miller, B., Blackshear, K., Ascienzo, S. (2017)
// Contact: sprang@uky.edu for permission

export const STSIOA_COPYRIGHT = {
  text: '© Copyright Sprang, G., Ross, L., Miller, B., Blackshear, K., Ascienzo, S. (2017)',
  contact: 'For questions about this assessment, contact sprang@uky.edu'
}

export const STSIOA_INFO = {
  title: 'About the STS-Informed Organizational Assessment (STSI-OA)',
  description: 'The STSI-OA measures how well an organization addresses Secondary Traumatic Stress through its policies, practices, and culture.',
  purpose: 'This assessment helps organizations identify strengths and areas for growth in creating a trauma-informed workplace that supports staff who work with traumatized populations.',
  domains: [
    {
      name: 'Resilience-Building Activities',
      description: 'Practices that enhance staff knowledge, skills, and coping strategies for managing STS'
    },
    {
      name: 'Staff Safety',
      description: 'Physical and psychological safety measures to protect staff wellbeing'
    },
    {
      name: 'STS-Informed Policies',
      description: 'Formal organizational policies that address staff resilience and safety'
    },
    {
      name: 'Leader Practices',
      description: 'How organizational leaders promote staff self-care, safety, and resilience'
    },
    {
      name: 'Routine Practices',
      description: 'Regular organizational activities that support staff in managing STS'
    },
    {
      name: 'Monitoring & Evaluation',
      description: 'Systems for assessing and responding to STS levels in the workforce'
    }
  ],
  scoring: 'Rate each item from 1-5 based on how well it describes your organization, or select N/A if not applicable.',
  totalRange: 'Total scores range from 0-200. Higher scores indicate a more STS-informed organization.',
  confidentiality: 'Your responses help leadership understand organizational strengths and areas for improvement in supporting staff who work with trauma.'
}

export const RESPONSE_OPTIONS = [
  { value: 1, label: '1 - Needs Attention' },
  { value: 2, label: '2 - Planning Stage' },
  { value: 3, label: '3 - Being Tested' },
  { value: 4, label: '4 - Ready for Spread' },
  { value: 5, label: '5 - Fully Implemented' },
  { value: 0, label: 'N/A - Not Applicable' }
]

export const STSIOA_DOMAINS = [
  {
    id: 1,
    name: 'Resilience-Building Activities',
    fullName: 'THE ORGANIZATION PROMOTES RESILIENCE-BUILDING ACTIVITIES THAT ENHANCE THE FOLLOWING:',
    questions: [
      { id: '1a', text: 'Basic knowledge about STS' },
      { id: '1b', text: 'Monitoring the impact of STS on professional well-being' },
      { id: '1c', text: 'Maintaining positive focus on the core mission for which the organization exists' },
      { id: '1d', text: 'A sense of hope (e.g., a belief in a client\'s potential for trauma recovery, healing and growth)' },
      { id: '1e', text: 'Specific skills that enhance a worker\'s sense of professional competency' },
      { id: '1f', text: 'Strong peer support among staff, supervisors and consultants' },
      { id: '1g', text: 'Healthy coping strategies to deal with the psychological demands of the job' }
    ]
  },
  {
    id: 2,
    name: 'Staff Safety',
    fullName: 'TO WHAT DEGREE DOES THE ORGANIZATION PROMOTE A SENSE OF SAFETY?',
    questions: [
      { id: '2a', text: 'The organization protects the physical safety of staff using strategies to reduce risk' },
      { id: '2b', text: 'Staff in the organization are encouraged to not share graphic details of trauma stories unnecessarily with co-workers' },
      { id: '2c', text: 'Periodically, the organization conducts a safety survey or forum that assesses worker perceptions of psychological safety' },
      { id: '2d', text: 'Periodically, the organization conducts a safety survey or forum that assesses worker perceptions of physical safety' },
      { id: '2e', text: 'Organizational leaders manage risk appropriately and protect workers as much as possible from dangerous clients' },
      { id: '2f', text: 'The organization provides training on how to manage dangerous situations' },
      { id: '2g', text: 'The organization has defined protocol for how to respond to staff when critical incidents occur' }
    ]
  },
  {
    id: 3,
    name: 'STS-Informed Policies',
    fullName: 'HOW STS-INFORMED ARE ORGANIZATIONAL POLICIES?',
    questions: [
      { id: '3a', text: 'The organization has defined practices addressing the psychological safety of staff' },
      { id: '3b', text: 'The organization has defined practices addressing the physical safety of staff' },
      { id: '3c', text: 'The organization has defined procedures to promote resilience-building in staff' },
      { id: '3d', text: 'The organization\'s strategic plan addresses ways to enhance staff resiliency' },
      { id: '3e', text: 'The organization\'s strategic plan addresses ways to enhance staff safety' },
      { id: '3f', text: 'The organization has a risk management policy in place to provide interventions to those who report high levels of STS' }
    ]
  },
  {
    id: 4,
    name: 'Leader Practices',
    fullName: 'HOW STS-INFORMED ARE THE PRACTICES OF LEADERS (EDs, CEOs, COOs, Administration, etc.)?',
    questions: [
      { id: '4a', text: 'Leadership actively encourages self-care' },
      { id: '4b', text: 'Leadership models good self-care' },
      { id: '4c', text: 'Staff provides input to leaders on ways the organization can improve its policies and practices regarding STS' },
      { id: '4d', text: 'Supervisors promote safety and resilience to STS by routinely attending to the risks and signs of STS' },
      { id: '4e', text: 'Supervisors address STS by referring those with high levels of disturbance to trained mental health professionals who can deliver services' },
      { id: '4f', text: 'Supervisors promote safety and resilience to STS by offering consistent supervision that includes discussion of the effect of the work on the worker' },
      { id: '4g', text: 'Supervisors promote safety and resilience to STS by offering additional supervision during times of high risk for STS' },
      { id: '4h', text: 'Supervisors promote safety and resilience to STS by intentionally managing caseloads and case assignments with the dose of indirect trauma exposure in mind' },
      { id: '4i', text: 'Leadership responds to STS as an occupational hazard and not a weakness' }
    ]
  },
  {
    id: 5,
    name: 'Routine Practices',
    fullName: 'HOW STS-INFORMED ARE OTHER ROUTINE ORGANIZATIONAL PRACTICES?',
    questions: [
      { id: '5a', text: 'The organization provides formal trainings on ways to enhance psychological safety' },
      { id: '5b', text: 'The organization provides formal trainings on ways to enhance physical safety' },
      { id: '5c', text: 'The organization provides formal trainings on enhancing resilience to STS' },
      { id: '5d', text: 'The organization offers activities (besides trainings) that promote resilience to STS' },
      { id: '5e', text: 'The organization discusses STS during new employee orientation' },
      { id: '5f', text: 'The organization has regular opportunities to provide team and peer support to individuals with high levels of exposure' },
      { id: '5g', text: 'The organization provides release time to allow employees to attend trainings focused on resilience building or STS management' }
    ]
  },
  {
    id: 6,
    name: 'Monitoring & Evaluation',
    fullName: 'HOW WELL DOES THE ORGANIZATION EVALUATE AND MONITOR STS POLICIES AND PRACTICES?',
    questions: [
      { id: '6a', text: 'The organization assesses the level of STS in the workplace' },
      { id: '6b', text: 'The organization routinely monitors workforce trends (e.g. attrition, absenteeism) that may signify a lack of safety or an increase in STS' },
      { id: '6c', text: 'The organization responds to what it learns through evaluation, monitoring and/or feedback in ways that promote safety and resilience' },
      { id: '6d', text: 'The organization routinely seeks feedback from the workforce regarding psychosocial trends that may signify an increase in STS' }
    ]
  }
]

export const INSTRUCTIONS = 'For each statement below, rate how well it describes your organization. Use the 1-5 scale, or select N/A if the item does not apply to your organization.'

export const DEFINITIONS = {
  title: 'Key Definitions',
  terms: [
    {
      term: 'Secondary Traumatic Stress (STS)',
      definition: 'The emotional and physical symptoms that can occur when helping professionals are repeatedly exposed to the traumatic experiences of the people they serve.'
    },
    {
      term: 'Resilience',
      definition: 'The ability to adapt and recover from stress, challenges, and difficult experiences while maintaining wellbeing.'
    },
    {
      term: 'STS-Informed Organization',
      definition: 'An organization that recognizes the impact of trauma work on staff and has policies, practices, and a culture that actively supports staff resilience and wellbeing.'
    }
  ]
}
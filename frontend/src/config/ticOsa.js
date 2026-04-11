// Trauma-Informed Organizational Self-Assessment (TIC OSA)
// Adapted from Qualtrics survey used in TIC Learning Collaborative
// 100 items across 5 domains, 4-point Likert + Do Not Know + N/A

export const TIC_OSA_INFO = {
  title: 'About the Trauma-Informed Organizational Self-Assessment (TIC OSA)',
  description: 'The TIC OSA measures how well an organization incorporates trauma-informed principles into its policies, practices, and environment.',
  purpose: 'This assessment helps organizations identify strengths and areas for growth across five domains of trauma-informed care.',
  domains: [
    { name: 'Supporting Staff Development', description: 'Training, supervision, support and self-care practices for staff' },
    { name: 'Creating a Safe & Supportive Environment', description: 'Physical safety, supportive environment, cultural competence, privacy, communication, and predictability' },
    { name: 'Assessing and Planning Services', description: 'Intake assessments, goal development, and trauma-specific interventions' },
    { name: 'Involving Consumers', description: 'Opportunities for current and former consumers to participate and provide feedback' },
    { name: 'Adapting Policies', description: 'Written policies and regular policy review through a trauma-informed lens' },
  ],
  scoring: 'Rate each item from 1 (Strongly Disagree) to 4 (Strongly Agree), or select Do Not Know / Not Applicable.',
  confidentiality: 'Your responses help leadership understand organizational strengths and areas for improvement in trauma-informed care.'
}

export const RESPONSE_OPTIONS = [
  { value: 1, label: 'Strongly Disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Agree' },
  { value: 4, label: 'Strongly Agree' },
  { value: 5, label: 'Do Not Know' },
  { value: 6, label: 'N/A' },
]

export const TIC_OSA_DOMAINS = [
  {
    id: 1,
    name: 'Supporting Staff Development',
    sections: [
      {
        heading: 'A. Training and Education',
        subtitle: 'Staff at all levels of the program receive training and education on the following topics:',
        questions: [
          { id: 1, text: 'What traumatic stress is.' },
          { id: 2, text: 'How traumatic stress affects the brain and body.' },
          { id: 3, text: 'The relationship between mental health and trauma.' },
          { id: 4, text: 'The relationship between substance use and trauma.' },
          { id: 5, text: 'The relationship between homelessness and trauma.' },
          { id: 6, text: 'How trauma affects a child\'s development.' },
          { id: 7, text: 'How trauma affects a child\'s attachment to his/her caregivers.' },
          { id: 8, text: 'The relationship between childhood trauma and adult re-victimization (e.g. domestic violence, sexual assault).' },
          { id: 9, text: 'Different cultural issues (e.g. different cultural practices, beliefs, rituals).' },
          { id: 10, text: 'Cultural differences in how people understand and respond to trauma.' },
          { id: 11, text: 'How working with trauma survivors impacts staff.' },
          { id: 12, text: 'How to help consumers identify triggers (i.e. reminders of dangerous or frightening things that have happened in the past).' },
          { id: 13, text: 'How to help consumers manage their feelings (e.g. helplessness, rage, sadness, terror).' },
          { id: 14, text: 'De-escalation strategies (i.e. ways to help people to calm down before reaching the point of crisis).' },
          { id: 15, text: 'How to develop safety and crisis prevention plans.' },
          { id: 16, text: 'What is asked in the intake assessment.' },
          { id: 17, text: 'How to establish and maintain healthy professional boundaries.' },
        ]
      },
      {
        heading: 'B. Staff Supervision, Support and Self-Care',
        subtitle: null,
        questions: [
          { id: 18, text: 'Staff members have regular team meetings.' },
          { id: 19, text: 'Topics related to trauma are addressed in team meetings.' },
          { id: 20, text: 'Topics related to self-care are addressed in team meetings (e.g. vicarious trauma, burn-out, stress-reducing strategies).' },
          { id: 21, text: 'Staff members have a regularly scheduled time for individual supervision.' },
          { id: 22, text: 'Staff members receive individual supervision from a supervisor who is trained in understanding trauma.' },
          { id: 23, text: 'Part of supervision time is used to help staff members understand their own stress reactions.' },
          { id: 24, text: 'Part of supervision time is used to help staff members understand how their stress reactions impact their work with consumers.' },
          { id: 25, text: 'The agency helps staff members debrief after a crisis.' },
          { id: 26, text: 'The agency has a formal system for reviewing staff performance.' },
          { id: 27, text: 'The agency provides opportunities for on-going staff evaluation of the program/agency.' },
          { id: 28, text: 'The agency provides opportunities for staff input into program practices.' },
          { id: 29, text: 'Outside consultants with expertise in trauma provide on-going education and consultation.' },
        ]
      }
    ]
  },
  {
    id: 2,
    name: 'Creating a Safe & Supportive Environment',
    sections: [
      {
        heading: 'A. Establishing a Safe Physical Environment',
        subtitle: null,
        questions: [
          { id: 30, text: 'Agency staff monitors who is coming in and out of the program/agency.' },
          { id: 31, text: 'Staff members ask consumers for their definitions of physical safety.' },
          { id: 32, text: 'The environment outside the organization is well lit.' },
          { id: 33, text: 'The common areas within the organization are well lit.' },
          { id: 34, text: 'Bathrooms are well lit.' },
          { id: 35, text: 'Consumers can lock bathroom doors.' },
          { id: 36, text: 'The organization incorporates child-friendly decorations and materials.' },
          { id: 37, text: 'The organization provides a space for children to play.' },
          { id: 38, text: 'The organization provides consumers with opportunities to make suggestions about ways to improve/change the physical space.' },
        ]
      },
      {
        heading: 'B. Establishing a Supportive Environment — Information Sharing',
        subtitle: null,
        questions: [
          { id: 39, text: 'The organization reviews rules, rights and grievance procedures with consumers regularly.' },
          { id: 40, text: 'Consumers are informed about how the program responds to personal crises (e.g. suicidal statements, violent behavior and mandatory reports).' },
          { id: 41, text: 'Consumer rights are posted in places that are visible (e.g. room checks, grievance policies, mandatory reporting rules).' },
          { id: 42, text: 'Materials are posted about traumatic stress (e.g. what it is, how it impacts people, and available trauma-specific resources).' },
        ]
      },
      {
        heading: 'Cultural Competence',
        subtitle: null,
        questions: [
          { id: 43, text: 'Program information is available in different languages.' },
          { id: 44, text: 'Staff and/or consumers are allowed to speak their native languages within the agency.' },
          { id: 45, text: 'Staff and/or consumers are allowed to prepare or have ethnic-specific foods.' },
          { id: 46, text: 'Staff shows acceptance for personal religious or spiritual practices.' },
          { id: 47, text: 'Outside agencies with expertise in cultural competence provide on-going training and consultation.' },
        ]
      },
      {
        heading: 'Privacy and Confidentiality',
        subtitle: null,
        questions: [
          { id: 48, text: 'The agency informs consumers about the extent and limits of privacy and confidentiality (kinds of records kept, where/who has access, when obligated to make report to police/child welfare).' },
          { id: 49, text: 'Staff and other professionals do not talk about consumers in common spaces.' },
          { id: 50, text: 'Staff does not talk about consumers outside of the agency unless at appropriate meetings.' },
          { id: 51, text: 'Staff does not discuss the personal issues of one consumer with another consumer.' },
          { id: 52, text: 'Consumers who have violated rules are approached in private.' },
          { id: 53, text: 'There are private spaces for staff and consumers to discuss personal issues.' },
        ]
      },
      {
        heading: 'Safety and Crisis Prevention Planning',
        subtitle: null,
        questions: [
          { id: 54, text: 'Written safety plans are incorporated into consumers\' individual goals and plans.' },
          { id: 55, text: 'Each consumer has a written crisis prevention plan which includes a list of triggers, strategies and responses which are helpful and those that are not helpful and a list of persons the consumer can go to for support.' },
        ]
      },
      {
        heading: 'Open and Respectful Communication',
        subtitle: null,
        questions: [
          { id: 56, text: 'Staff members ask consumers for their definitions of emotional safety.' },
          { id: 57, text: 'Staff members practice motivational interviewing techniques with consumers (e.g. open-ended questions, affirmations, and reflective listening).' },
          { id: 58, text: 'The agency uses "people first" language rather than labels (e.g. \'people who are experiencing homelessness\' rather than \'homeless people\').' },
          { id: 59, text: 'Staff uses descriptive language rather than characterizing terms to describe consumers (e.g. describing a person as \'having a hard time getting her needs met\' rather than \'attention seeking\').' },
        ]
      },
      {
        heading: 'Consistency and Predictability',
        subtitle: null,
        questions: [
          { id: 60, text: 'The organization has regularly scheduled procedures/opportunities for consumers to provide input.' },
          { id: 61, text: 'The organization has policy in place to handle any changes in schedules.' },
          { id: 62, text: 'The program is flexible with procedures if needed, based on individual circumstances.' },
        ]
      }
    ]
  },
  {
    id: 3,
    name: 'Assessing and Planning Services',
    sections: [
      {
        heading: 'A. Conducting Intake Assessments',
        subtitle: 'The intake assessment includes questions about:',
        questions: [
          { id: 63, text: 'Personal strengths.' },
          { id: 64, text: 'Cultural background.' },
          { id: 65, text: 'Cultural strengths (e.g. world view, role of spirituality, cultural connections).' },
          { id: 66, text: 'Social supports in the family and the community.' },
          { id: 67, text: 'Current level of danger from other people (e.g. restraining orders, history of domestic violence, threats from others).' },
          { id: 68, text: 'History of trauma (e.g. physical, emotional or sexual abuse, neglect, loss, domestic/community violence, combat, past homelessness).' },
          { id: 69, text: 'Previous head injury.' },
          { id: 70, text: 'Quality of relationship with child or children (i.e. caregiver/child attachment).' },
          { id: 71, text: 'Children\'s trauma exposure (e.g. neglect, abuse, exposure to violence).' },
          { id: 72, text: 'Children\'s achievement of developmental tasks.' },
          { id: 73, text: 'Children\'s history of mental health issues.' },
          { id: 74, text: 'Children\'s history of physical health issues.' },
        ]
      },
      {
        heading: 'Intake Assessment Process',
        subtitle: null,
        questions: [
          { id: 75, text: 'There are private, confidential spaces available to conduct intake assessments.' },
          { id: 76, text: 'The program informs consumers about why questions are being asked.' },
          { id: 77, text: 'The program informs consumers about what will be shared with others and why.' },
          { id: 78, text: 'Throughout the assessment process, the program staff observes consumers on how they are doing and responds appropriately.' },
          { id: 79, text: 'The program provides an adult translator for the assessment process if needed.' },
        ]
      },
      {
        heading: 'Intake Assessment Follow-Up',
        subtitle: null,
        questions: [
          { id: 80, text: 'Based on the intake assessment, adults and/or children are referred for specific services as necessary.' },
          { id: 81, text: 'Re-assessments are done on an on-going and consistent basis.' },
          { id: 82, text: 'The program updates releases and consent forms whenever it is necessary to speak with a new provider.' },
        ]
      },
      {
        heading: 'B. Developing Goals and Plans',
        subtitle: null,
        questions: [
          { id: 83, text: 'Staff collaborates with consumers in setting their goals.' },
          { id: 84, text: 'Consumer goals are reviewed and updated regularly.' },
          { id: 85, text: 'Before leaving the program, consumers and staff develop a plan to address any future needs.' },
        ]
      },
      {
        heading: 'C. Offering Services and Trauma-Specific Interventions',
        subtitle: null,
        questions: [
          { id: 86, text: 'The program provides opportunities for care coordination for services not provided within that organization.' },
          { id: 87, text: 'The program educates consumers about traumatic stress and triggers.' },
          { id: 88, text: 'The program has access to a clinician with expertise in trauma and trauma-related interventions (on-staff or available for regular consultation).' },
        ]
      }
    ]
  },
  {
    id: 4,
    name: 'Involving Consumers',
    sections: [
      {
        heading: 'A. Involving Current and Former Consumers',
        subtitle: null,
        questions: [
          { id: 89, text: 'Current consumers are given opportunities to evaluate the program and offer their suggestions for improvement in anonymous and/or confidential ways (e.g. suggestion boxes, regular satisfaction surveys, meetings focused on necessary improvements, etc).' },
          { id: 90, text: 'The program recruits former consumers to serve in an advisory capacity.' },
          { id: 91, text: 'Former consumers are invited to share their thoughts, ideas and experiences with the program.' },
        ]
      }
    ]
  },
  {
    id: 5,
    name: 'Adapting Policies',
    sections: [
      {
        heading: 'A. Creating Written Policies',
        subtitle: null,
        questions: [
          { id: 92, text: 'The program has a written statement that includes a commitment to understanding trauma and engaging in trauma-sensitive practices.' },
          { id: 93, text: 'Written policies are established based on an understanding of the impact of trauma on consumers and providers.' },
          { id: 94, text: 'The program has a written commitment to demonstrating respect for cultural differences and practices.' },
          { id: 95, text: 'The program has written policy to address potential threats to consumers and staff from natural or man-made threats (fire, tornado, bomb threat, and hostile intruder).' },
          { id: 96, text: 'The program has a written policy outlining program responses to consumer crisis/staff crisis (i.e. self harm, suicidal thinking, and aggression towards others).' },
          { id: 97, text: 'The program has written policies outlining professional conduct for staff (e.g. boundaries, responses to consumers, etc).' },
        ]
      },
      {
        heading: 'B. Reviewing Policies',
        subtitle: null,
        questions: [
          { id: 98, text: 'The program reviews its policies on a regular basis to identify whether they are sensitive to the needs of trauma survivors.' },
          { id: 99, text: 'The program involves staff in its review of policies.' },
          { id: 100, text: 'The program involves consumers in its review of policies.' },
        ]
      }
    ]
  }
]

// Domain score column mapping (matches tic_osa_responses table)
export const DOMAIN_SCORE_COLUMNS = {
  1: 'staff_development_score',
  2: 'safe_environment_score',
  3: 'assessing_planning_score',
  4: 'involving_consumers_score',
  5: 'adapting_policies_score',
}

export const INSTRUCTIONS = `The Agency Self-Assessment for Trauma-Informed Care is intended for use by staff members at all levels of child/family-serving organizations. It can be used to assess the degree to which the agency has incorporated trauma-informed principles into its culture and practices.

After reading each item, mark the response that best describes how your organization performs on that indicator.`

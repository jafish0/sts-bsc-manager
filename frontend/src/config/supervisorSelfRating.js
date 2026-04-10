// STS Core Competencies in Trauma-Informed Supervision Self-Rating Tool
// Cross-Disciplinary Version
// National Child Traumatic Stress Network (NCTSN)
// Adapted by University of Kentucky Center on Trauma and Children (CTAC)

export const SELF_RATING_INFO = {
  title: 'STS Supervisor Competencies Self-Rating Tool',
  subtitle: 'Cross-Disciplinary Version',
  description: 'A private self-assessment tool to help supervisors in any discipline evaluate their competencies in providing trauma-informed supervision and support to team members affected by secondary traumatic stress.',
  privacyNote: 'Your results are completely private. Only you can see your scores and responses. Team leaders, agency administrators, and CTAC staff cannot view your individual results.',
  source: 'National Child Traumatic Stress Network (NCTSN)',
  adaptedBy: 'University of Kentucky Center on Trauma and Children (CTAC)',
  scale: [
    { value: 1, label: 'Not part of my skill set yet', color: '#DC2626', bgColor: '#FEE2E2', description: 'This is an area for growth — you have not yet developed this skill.' },
    { value: 2, label: 'Doing OK but need more training', color: '#D97706', bgColor: '#FEF3C7', description: 'You have some ability here but would benefit from additional training and practice.' },
    { value: 3, label: 'I have confidence in my skills in this area', color: '#059669', bgColor: '#D1FAE5', description: 'You feel competent and confident in this area.' }
  ],
  scoring: {
    maxTotal: 60,
    competencies: {
      1: { name: 'Competency 1', shortName: 'STS Knowledge & Support', itemCount: 5, maxScore: 15 },
      2: { name: 'Competency 2', shortName: 'Self-Assessment & Management', itemCount: 3, maxScore: 9 },
      3: { name: 'Competency 3', shortName: 'Emotional Safety & Sharing', itemCount: 7, maxScore: 21 },
      4: { name: 'Competency 4', shortName: 'Resilience & Compassion', itemCount: 5, maxScore: 15 }
    }
  }
}

export const SELF_RATING_WELCOME = {
  title: 'STS Supervisor Competencies Self-Rating Tool',
  intro: 'This self-rating tool is designed to help supervisors in any discipline assess their skills in providing trauma-informed support and supervision to team members who may be affected by secondary traumatic stress (STS). It is a developmental self-assessment \u2014 not an evaluation tool. There are no "right" or "wrong" answers.',
  keyPoints: [
    'This assessment is completely private \u2014 only you can see your results.',
    'There are 4 competency areas with 20 rated items and several reflection prompts.',
    'Use the 3-point scale to honestly assess where you are now in your development.',
    'Companion materials with strategies and resources are available for each competency.',
    'You can retake this assessment over time to track your professional growth.',
    'You can export your results as a PDF at any time.'
  ],
  signsOfSts: {
    title: 'Signs of Secondary Traumatic Stress',
    intro: 'Before you begin, it may be helpful to review common signs of STS. These signs can appear in yourself or in the team members you supervise:',
    signs: [
      { category: 'Unwanted thoughts or reminders', examples: 'Nightmares, unwanted memories or flashbacks of clients\' trauma experiences' },
      { category: 'Avoidance', examples: 'Isolating from peers and supports, avoiding certain cases, not showing up to work' },
      { category: 'Changes in thinking', examples: 'Having negative expectations, exaggerated blame of self or others' },
      { category: 'Changes in feeling', examples: 'Feeling negative all the time, unable to experience positive emotions, feeling isolated' },
      { category: 'Changes in reactions', examples: 'Being irritable, jumpy, quick to anger, difficulty sleeping, trouble concentrating' }
    ]
  },
  formalSupports: {
    title: 'Formal Supports Available',
    intro: 'These are examples of formal supports that organizations may offer:',
    supports: [
      'Employee Assistance Programs (EAPs)',
      'Mental health/substance abuse benefits and services',
      'Paid time off',
      'Regular supervision and/or consultation',
      'Peer support/mentorship programs',
      'Wellness programs/initiatives',
      'Training on STS and resilience',
      'Changes in job role or assignments'
    ],
    informalNote: 'Informal supports may include: talking with peers, mentorship, time with friends/family/pets, and community resources (e.g., recreational, spiritual).'
  }
}

export const COMPETENCIES = [
  {
    number: 1,
    title: 'Knowledge of the Signs, Symptoms, and Risk Factors of Occupational Distress and Support Options for Team Members',
    shortTitle: 'STS Knowledge & Support',
    description: 'STS-informed supervisors in any discipline will know the signs, symptoms, and risk factors of STS and support options for team members.',
    items: [
      {
        key: 'c1_q1',
        text: 'Recognize the signs of occupational distress in team members.',
        type: 'rated',
        guidance: {
          benchmark: 'Recognize the signs of STS in team members.',
          strategies: [
            'Watch for unwanted thoughts or reminders: nightmares, unwanted memories or flashbacks of clients\' trauma experiences.',
            'Notice avoidance behaviors: isolating from peers and supports, avoiding certain cases, not showing up to work.',
            'Look for changes in thinking: negative expectations, exaggerated blame of self or others.',
            'Observe changes in feeling: persistent negativity, inability to experience positive emotions, feeling isolated.',
            'Be alert to changes in reactions: irritability, jumpiness, quick anger, difficulty sleeping, trouble concentrating.'
          ],
          resources: []
        }
      },
      {
        key: 'c1_q2',
        text: 'Describe reflective supervision and support options that are available, accessible, and culturally relevant, including formal and informal supports, both internal and external to the organization.',
        type: 'rated',
        guidance: {
          benchmark: 'Describe STS-informed services and support options that are available, accessible, and culturally relevant.',
          strategies: [
            'Know what formal supports your organization offers: EAPs, mental health benefits, paid time off, regular supervision, peer support programs, wellness initiatives, STS training, and role adjustments.',
            'Be aware of informal supports: talking with peers, mentorship, time with friends/family/pets, community resources (recreational, spiritual).',
            'Ensure supports are culturally relevant and accessible to all team members.'
          ],
          resources: []
        }
      },
      {
        key: 'c1_q3',
        text: 'Help people struggling with occupational distress access and make consistent use of reflective supervision and other supports in a nonjudgmental way.',
        type: 'rated',
        guidance: {
          benchmark: 'Help people struggling with STS access and make consistent use of services and supports in a non-judgmental way.',
          strategies: [
            'Normalize the use of STS supports as an expected part of doing trauma work.',
            'Inform team members of available services regularly \u2014 not just during crises.',
            'Assist team members to connect with services as needed (e.g., offer to make the first call with them, offer private office space to make a call during work hours).',
            'Set an example by using services and support yourself and sharing positive experiences with team members.'
          ],
          resources: []
        }
      },
      {
        key: 'c1_q4',
        text: 'Act as a champion within the organization for reflective supervision, training, and resources that can address the impact of occupational distress and that are accessible and culturally relevant for all team members; call attention to policies or practices that may be contributing to occupational distress.',
        type: 'rated',
        guidance: {
          benchmark: 'Act as an advocate within the organization for STS supports, training, and resources; call attention to policies or practices that may be contributing to STS.',
          strategies: [
            'Educate administrators and decision-makers about STS.',
            'Advocate with administrators to regularly review, assess, and expand the availability, accessibility, and quality of formal services and supports.',
            'Consider using the Secondary Traumatic Stress Informed Organization Assessment Tool (STSI-OA).',
            'Advocate changing policies and practices that may contribute to or intensify STS reactions, such as work conditions, caseloads, on-call expectations, policies/norms around leave time, and inadequate resources.'
          ],
          resources: [
            { text: 'STSI-OA Tool', url: 'https://www.uky.edu/ctac/stsioa' }
          ]
        }
      },
      {
        key: 'c1_q5',
        text: 'Identify how culture, race, gender, other identities, lived experiences, systemic oppression, and implicit bias may impact how occupational distress affects individuals and organizations.',
        type: 'rated',
        guidance: {
          benchmark: 'Identify how culture, race, gender, other identities, lived experiences, systemic oppression, and implicit bias may impact the way STS affects individuals and organizations.',
          strategies: [
            'Recognize that people of color and those who hold marginalized identities may have additional vulnerabilities to STS due to: exposure to the same oppression and institutional racism as client populations; identification with clients of a similar background; lack of safety or support in their agency; higher caseloads and being asked to take on additional responsibilities such as translation or contributing expertise about race.',
            'Reflect on how these dynamics might be relevant to your own work experience and for team members.',
            'Create space for open dialogue about how identity and systemic factors interact with STS.'
          ],
          resources: []
        }
      }
    ]
  },
  {
    number: 2,
    title: 'Knowledge and Ability to Self-Assess, Monitor, and Address Their Own Occupational Distress',
    shortTitle: 'Self-Assessment & Management',
    description: 'STS-informed supervisors in any discipline will self-assess, monitor, and address their own STS.',
    items: [
      {
        key: 'c2_q1',
        text: 'Recognize how culture, race, gender, other identities, lived experiences, systemic oppression, and implicit bias may affect you, your own experiences of occupational distress, and your supervisory relationships and practice.',
        type: 'discussion',
        guidance: {
          benchmark: 'Recognize how culture, race, gender, other identities, lived experiences, systemic oppression, and implicit bias may affect themselves, their own experiences of STS, and their supervisory relationships and practice.',
          reflectionQuestions: [
            'How have culture, race, historical trauma, systematic oppression, and/or implicit bias impacted you and your response to work-related trauma exposure?',
            'In what ways are you similar to your team members and in what ways are you different?',
            'How do these differences impact your relationships and interactions with team members?',
            'Have you assumed similarities or differences that may not be present based on external factors (e.g., both of you are of the same racial category or similar educational background)?',
            'What are some strategies for addressing these differences?'
          ],
          strategies: [
            'Build intentional self-awareness regarding implicit biases and issues of privilege and oppression.',
            'Use the "Self-Assessment of Culture in Regard to Privilege: Hot Spots, Hidden Spots, and Soft Spots" tool.',
            'Directly address diversity factors that may be crucial in terms of establishing trust in the supervisory process.'
          ],
          resources: [
            { text: 'Self-Assessment of Culture in Regard to Privilege', url: 'https://www.nctsn.org/resources/self-assessment-of-culture-in-regards-to-privilege-hot-spots-hidden-spots-and-soft-spots' },
            { text: 'How to Talk Effectively About Racism (Kenneth Hardy)', url: 'https://traumatransformed.org/documents/Effectively-Talk-About-Race-Dr-Kenneth-Hardy-11x17.pdf' }
          ]
        }
      },
      {
        key: 'c2_q2',
        text: 'Regularly assess how occupational distress may be affecting your own functioning.',
        type: 'rated',
        guidance: {
          benchmark: 'Regularly assess how STS may be affecting their own functioning.',
          strategies: [
            'Create opportunities to slow down and reflect on your wellness and functioning.',
            'Consider areas such as: physical health, emotional wellbeing, quality of sleep, satisfaction in your work.',
            'Use formal STS assessments periodically (such as the ProQOL).',
            'Consider using a wellness app to track your wellbeing over time.'
          ],
          resources: [
            { text: 'Professional Quality of Life (ProQOL)', url: 'https://proqol.org/proqol-measure' }
          ]
        }
      },
      {
        key: 'c2_q3',
        text: 'Seek to address occupational distress when it starts to impact your personal and/or work life.',
        type: 'rated',
        guidance: {
          benchmark: 'Seek to address STS when it starts to impact their personal and/or work life.',
          strategies: [
            'Practice mindfulness and relaxation exercises.',
            'Allow yourself to feel a wide range of feelings (rather than avoiding feelings) without judgment.',
            'Work on changing negative thinking patterns.',
            'Appreciate what is good and how you positively impact the families you work with and the community.',
            'Take breaks during the workday.',
            'Maintain healthy boundaries between professional and personal life.',
            'Build healthy support systems inside and outside of work.'
          ],
          resources: []
        }
      },
      {
        key: 'c2_q4',
        text: 'Actively seek support from other team members, your own supervisor, and/or other professional supports.',
        type: 'discussion',
        guidance: {
          benchmark: 'Actively seek support from other team members, their own supervisor, and/or other professional supports.',
          reflectionQuestions: [
            'Who do you turn to for support when you are feeling the effects of STS?',
            'Are there barriers preventing you from seeking support? What are they?',
            'What would make it easier for you to access support?'
          ],
          strategies: [
            'Reach out to your own supervisor or other organizational leadership.',
            'Access Employee Assistance Programs (EAPs) or other therapy services.',
            'Connect with peers and enhance peer support, within your agency and with others in your field outside your agency.',
            'Advocate for your needs to your supervisor and to leadership.'
          ],
          resources: []
        }
      },
      {
        key: 'c2_q5',
        text: 'Model and engage in reflective practice and promote opportunities for team members to participate when possible.',
        type: 'rated',
        guidance: {
          benchmark: 'Model and engage in self-care practices and promote opportunities for team members to participate when possible.',
          strategies: [
            'Ask team members to join you for a break or a walk.',
            'Build relaxation and/or mindfulness activities into team meetings.',
            'Encourage team members not to work on their days off and model it yourself (e.g., arranging coverage at work, not participating in calls or checking/sending emails on days off).',
            'Encourage team members to schedule leave days and model by announcing your own planned leave.'
          ],
          resources: []
        }
      }
    ]
  },
  {
    number: 3,
    title: 'Knowledge and Ability to Help Team Members Safely Share the Emotional Experience of Working with People Impacted by Trauma',
    shortTitle: 'Emotional Safety & Sharing',
    description: 'STS-informed supervisors in any discipline will help team members safely share the emotional experience of working with people impacted by trauma.',
    items: [
      {
        key: 'c3_q1',
        text: 'Work to enhance emotional safety when meeting with team members.',
        type: 'rated',
        guidance: {
          benchmark: 'Work to enhance emotional safety when meeting with team members.',
          strategies: [
            'Ensure physical safety in meeting spaces.',
            'Be aware of potential threats to emotional safety (e.g., trauma reminders or discrimination).',
            'Pay attention to group dynamics and safety in group supervision.',
            'Hold consistent and predictable meetings, related to both schedule and content.',
            'Minimize distractions and multitasking during meetings.',
            'Accept team members non-judgmentally.',
            'Make decisions with your team members instead of mandating next steps when possible.',
            'Acknowledge your mistakes.',
            'Model curiosity by asking questions about team members\' experiences and reactions.',
            'Make time for debriefing and calming activity when emotions are high.'
          ],
          resources: []
        }
      },
      {
        key: 'c3_q2',
        text: 'Use reflective listening skills to help understand and validate team members\' experiences.',
        type: 'rated',
        guidance: {
          benchmark: 'Use active listening skills to help understand and validate team members\' experiences.',
          strategies: [
            'Active or reflective listening involves seeking to understand the speaker\'s true message \u2014 attending to words, tone of voice, body language, etc.',
            'Offer the understood message back to the speaker to confirm understanding.',
            'Attend to the feelings being communicated, not just the content.',
            'Learn more about reflective supervision and listening practices.'
          ],
          resources: [
            { text: 'Reflective Supervision Guidelines (Minnesota Association for Children\'s Mental Health)', url: '' }
          ]
        }
      },
      {
        key: 'c3_q3',
        text: 'Identify and build on team members\' strengths to help increase their self-awareness, competence, and resilience.',
        type: 'rated',
        guidance: {
          benchmark: 'Identify and build on team members\' strengths to help increase their self-awareness, competence, and resilience.',
          strategies: [
            'Use a strengths-based approach to supervision.',
            'Help team members recognize their existing skills and positive qualities.',
            'Build on identified strengths when addressing challenges.'
          ],
          resources: [
            { text: 'Strengths-Based Supervision', url: 'http://strengthsbasedsupervision.com' }
          ]
        }
      },
      {
        key: 'c3_q4',
        text: 'Discuss and normalize common emotional responses to working with people impacted by trauma.',
        type: 'rated',
        guidance: {
          benchmark: 'Discuss and normalize common emotional responses to working with people impacted by trauma.',
          strategies: [
            'Identify and share emotional responses you have experienced.',
            'Describe common reactions you have observed in others.',
            'Refer to fact sheets, research articles, and other STS resources that list common responses.',
            'Emphasize that these are normal and expected responses to an abnormal event \u2014 an occupational hazard \u2014 and in no way suggests anything wrong with the team member for having these responses.'
          ],
          resources: []
        }
      },
      {
        key: 'c3_q5',
        text: 'Provide consistent emotional support to team members, considering their individual needs, histories, identities, and experience.',
        type: 'rated',
        guidance: {
          benchmark: 'Provide consistent emotional support to team members, considering their individual needs, histories, identities, and experience.',
          strategies: [
            'Validate and normalize their feelings and responses.',
            'Express empathy.',
            'Allow expression of emotions and sit with the team member in the emotion.',
            'Thank the team member for sharing.',
            'Call attention to team member\'s strengths in coping with the situation.',
            'Ask if there is anything you can do to provide additional support.'
          ],
          resources: []
        }
      },
      {
        key: 'c3_q6',
        text: 'Use emotion-focused questions to help team members or peers identify and process their feelings.',
        type: 'rated',
        guidance: {
          benchmark: 'Use emotion-focused questions to help team members process their feelings.',
          strategies: [
            'Ask open-ended questions about how situations made them feel.',
            'Help team members name and label their emotions.',
            'Create space for emotional processing without rushing to solutions.',
            'Use prompts like: "How did that make you feel?", "What emotions came up for you?", "What was the hardest part emotionally?"'
          ],
          resources: []
        }
      },
      {
        key: 'c3_q7',
        text: 'Use check-in questions to demonstrate interest and create space for difficult conversations.',
        type: 'rated',
        guidance: {
          benchmark: 'Use check-in questions to demonstrate interest and create space for difficult conversations.',
          strategies: [
            'Start meetings with brief check-ins about how team members are doing.',
            'Use open-ended questions that invite honest responses.',
            'Follow up on previously discussed concerns.',
            'Use prompts like: "How are you really doing?", "Is there anything weighing on you from this week?", "What do you need from me right now?"'
          ],
          resources: []
        }
      }
    ]
  },
  {
    number: 4,
    title: 'Ability to Support the Resilience of Team Members Individually and Collectively',
    shortTitle: 'Resilience & Compassion',
    description: 'STS-informed supervisors in any discipline will support the resilience of team members individually and collectively.',
    items: [
      {
        key: 'c4_q1',
        text: 'Notice and encourage when team members are using their understanding of occupational distress to be more effective in their role. Help them recognize their growing expertise.',
        type: 'rated',
        guidance: {
          benchmark: 'Notice and encourage when team members are using their understanding of trauma to be more effective in their role. Help them recognize their growing expertise.',
          strategies: [
            'Share resources about trauma and its impact on child and family behavior.',
            'Help team members identify and use effective skills to manage trauma reactions in children and families.',
            'Recognize, point out, and encourage when team members use these skills and/or show improvement.'
          ],
          resources: [
            { text: 'The 12 Core Concepts for Understanding Traumatic Stress (NCTSN)', url: 'https://www.nctsn.org/resources/12-core-concepts-concepts-understanding-traumatic-stress-responses-children-and-families' }
          ]
        }
      },
      {
        key: 'c4_q2',
        text: 'Identify and develop team members\' strengths and help apply those strengths to job-related activities.',
        type: 'rated',
        guidance: {
          benchmark: 'Identify and develop team member\'s strengths and help apply those strengths to job-related activities.',
          strategies: [
            'Use prompts to help team members identify their strengths:',
            '"Describe a time when you were able to overcome or handle a major challenge in life."',
            '"What did you learn about yourself?"',
            '"What personal strengths did you draw upon?"',
            '"How might you apply this strength now?"'
          ],
          resources: []
        }
      },
      {
        key: 'c4_q3',
        text: 'Offer opportunities for team members to connect with their team and other professional supports, in order to guard against isolation and develop a sense of shared responsibility to address difficult circumstances.',
        type: 'discussion',
        guidance: {
          benchmark: 'Offer opportunities for team members to connect with their team and other professional supports.',
          reflectionQuestions: [
            'What opportunities do you currently provide for team connection?',
            'Are there team members who may be isolated? What can you do to reach them?',
            'How can you foster a sense of shared responsibility within your team?'
          ],
          strategies: [
            'Enhance emotional safety within the team.',
            'Foster positive communication and conflict resolution skills.',
            'Encourage peer support.',
            'Help team members identify sources of team support and/or mentorship.',
            'Encourage "accountability partners": colleagues who collaborate to set and achieve wellness goals and support and encourage each other.'
          ],
          resources: []
        }
      },
      {
        key: 'c4_q4',
        text: 'Supporting acceptance of the complexity of the work and the things that cannot be changed.',
        type: 'rated',
        guidance: {
          benchmark: 'Promote the development of compassion satisfaction by supporting acceptance of the complexity of the work.',
          strategies: [
            'Help team members think through:',
            '"What can you do within the scope of your role?"',
            '"What can we do together to respond to this complex situation?"',
            '"What are some of the factors that are beyond your control?"',
            '"What can you do or say to yourself to cope with factors that are beyond your control?"'
          ],
          resources: []
        }
      },
      {
        key: 'c4_q5',
        text: 'Helping team members recognize partial successes, their professional growth, and their increased skill levels.',
        type: 'discussion',
        guidance: {
          benchmark: 'Promote the development of compassion satisfaction by helping team members recognize partial successes and growth.',
          reflectionQuestions: [
            'What are the gains that have been made?',
            'Can you tell me one thing that is going well with this family or situation?',
            'What is something you learned from this situation?',
            'What is something you have done that has made a positive difference for this child and family?',
            'What about this child or family inspires you?'
          ],
          strategies: [
            'Regularly point out progress and growth, even when it is incremental.',
            'Help team members see how their skills have developed over time.'
          ],
          resources: []
        }
      },
      {
        key: 'c4_q6',
        text: 'Engaging team members in creating a practice of noticing, acknowledging, and savoring positive moments within their role and the impact of their work.',
        type: 'discussion',
        guidance: {
          benchmark: 'Promote the development of compassion satisfaction by engaging team members in savoring positive moments.',
          reflectionQuestions: [
            'What was the best part of my day today, and who or what made it the best part?',
            'What did this teach me?',
            'What am I most proud of today?',
            'Where do I find meaning and purpose in my work?'
          ],
          strategies: [
            'Build a regular practice of reflection on positive moments into supervision.',
            'Model by sharing your own positive moments and sources of meaning.'
          ],
          resources: []
        }
      },
      {
        key: 'c4_q7',
        text: 'Reinforcing the benefits of engaging in restorative activities at work and off-hours.',
        type: 'rated',
        guidance: {
          benchmark: 'Promote the development of compassion satisfaction by reinforcing restorative activities.',
          strategies: [
            'Integrate relaxation and mindfulness activities into group and individual supervision sessions.',
            'Role model and encourage self-care during and after work: taking breaks, walking with a partner, encouraging moments of laughter and gratitude.',
            'Use mindfulness, relaxation, stretching, and/or physical exercise.',
            'Share favorite hobbies and encourage others to do the same.',
            'Help team members create a wellness plan: What will you do during work? What will you do after work? What can I or the team do to support your plan?'
          ],
          resources: []
        }
      },
      {
        key: 'c4_q8',
        text: 'Use compassion satisfaction prompts to help with perspective shifting and connection to positive experiences.',
        type: 'rated',
        guidance: {
          benchmark: 'Use compassion satisfaction prompts for perspective shifting.',
          strategies: [
            'Use prompts that help team members reconnect with the meaning and purpose of their work.',
            'Help team members shift perspective from what is overwhelming to what is rewarding.',
            'Encourage journaling or sharing practices around compassion satisfaction.'
          ],
          resources: []
        }
      }
    ]
  }
]

export const SELF_RATING_RESOURCES = {
  websites: [
    { name: 'NCTSN Secondary Traumatic Stress Resources', url: 'https://www.nctsn.org/trauma-informed-care/secondary-traumatic-stress' },
    { name: 'STS Innovations and Solutions Center (UK CTAC)', url: 'https://www.uky.edu/ctac/stsisc' },
    { name: 'Secondary Traumatic Stress Consortium', url: 'https://www.stsconsortium.com/' },
    { name: 'Southern Regional Child Advocacy Center STS Resources', url: 'https://www.srcac.org/reflect-refuel-reset/' },
    { name: 'Strengths-Based Supervision', url: 'http://strengthsbasedsupervision.com' },
    { name: 'TEND Academy', url: 'https://www.tendacademy.ca' },
    { name: 'Trauma Stewardship Institute', url: 'https://traumastewardship.com/' },
    { name: 'UK CTAC Well@Work', url: 'https://www.uky.edu/ctac/wellatwork' }
  ],
  assessments: [
    { name: 'Professional Quality of Life (ProQOL)', url: 'https://proqol.org/proqol-measure' },
    { name: 'Self-Assessment of Culture in Regard to Privilege', url: 'https://www.nctsn.org/resources/self-assessment-of-culture-in-regards-to-privilege-hot-spots-hidden-spots-and-soft-spots' },
    { name: 'Secondary Traumatic Stress Informed Organizational Assessment (STSI-OA)', url: 'https://www.uky.edu/ctac/stsioa' }
  ],
  factSheets: [
    'Secondary Traumatic Stress: A Fact Sheet for Child-Serving Professionals',
    'How to Talk Effectively About Racism (Kenneth Hardy)',
    'Secondary Trauma and Child Welfare Staff: Guidance for Supervisors and Administrators',
    'Secondary Traumatic Stress: A Fact Sheet for Organizations Employing Community Violence Workers',
    'Understanding Secondary Traumatic Stress for CAC Workers'
  ],
  articles: [
    'Mindful Practices to Enhance Diversity-Informed Reflective Supervision and Leadership',
    'The Psychology of Radical Healing',
    'Intersectionality, Power, and Relational Safety in Context: Key Concepts in Clinical Supervision',
    'Broadening the Scope: Next Steps in Reflective Supervision Training',
    'Reflective Local Practice: A Pragmatic Framework for Improving Culturally Competent Practice in Psychology'
  ],
  trainings: [
    'Secondary Traumatic Stress: Understanding the Impact on Professionals in Trauma-Exposed Workplaces',
    'Staying Inside the Window of Tolerance: An Advanced Training on STS and Resiliency'
  ],
  companionPdfs: [
    {
      name: 'STS Core Competencies for Trauma-Informed Supervision (Cross-Disciplinary Version)',
      description: 'The main competency framework document with all 4 competencies and benchmarks.',
      storageKey: 'sts-supervisor-competencies-cross-disciplinary.pdf'
    },
    {
      name: 'STS Core Competencies Companion Document',
      description: 'Detailed strategies and resources for each benchmark across all competencies.',
      storageKey: 'sts-supervisor-competencies-companion.pdf'
    },
    {
      name: 'Using the STS Core Competencies in Trauma-Informed Supervision',
      description: 'Original NCTSN guide explaining how to use the self-rating tool.',
      storageKey: 'using-sts-core-competencies-supervision.pdf'
    }
  ]
}

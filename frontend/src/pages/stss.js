// Secondary Traumatic Stress Scale (STSS) Configuration
// Copyright © 1999 Brian E. Bride
// Citation: Bride, B.E., Robinson, M.R., Yegidis, B., & Figley, C.R. (2004). 
// Development and validation of the Secondary Traumatic Stress Scale. 
// Research on Social Work Practice, 14, 27-35.

export const STSS_COPYRIGHT = {
  text: 'Copyright © 1999 Brian E. Bride',
  citation: 'Bride, B.E., Robinson, M.R., Yegidis, B., & Figley, C.R. (2004). Development and validation of the Secondary Traumatic Stress Scale. Research on Social Work Practice, 14, 27-35.'
}

export const STSS_INFO = {
  title: 'About the Secondary Traumatic Stress Scale (STSS)',
  description: 'The Secondary Traumatic Stress Scale measures the frequency of symptoms related to indirect exposure to trauma through your work with traumatized clients.',
  purpose: 'This assessment helps identify signs of secondary traumatic stress, which can occur when helping professionals are repeatedly exposed to the traumatic experiences of the people they serve.',
  scoring: 'The STSS consists of 17 items divided into three subscales that measure different aspects of secondary traumatic stress:',
  subscales: [
    {
      name: 'Intrusion',
      description: 'Unwanted thoughts, images, or memories related to clients\' trauma (5 items)',
      range: '5-25 points'
    },
    {
      name: 'Avoidance', 
      description: 'Efforts to avoid reminders of clients\' traumatic experiences (7 items)',
      range: '7-35 points'
    },
    {
      name: 'Arousal',
      description: 'Physical and emotional reactivity related to work with traumatized clients (5 items)',
      range: '5-25 points'
    }
  ],
  totalRange: 'Total scores range from 17-85, with higher scores indicating greater secondary traumatic stress.',
  confidentiality: 'Your responses are confidential and help your organization understand staff experiences with secondary trauma. Individual scores are not shared.'
}

export const RESPONSE_OPTIONS = [
  { value: 1, label: 'Never' },
  { value: 2, label: 'Rarely' },
  { value: 3, label: 'Occasionally' },
  { value: 4, label: 'Often' },
  { value: 5, label: 'Very Often' }
]

export const STSS_ITEMS = [
  {
    id: 1,
    text: 'I felt emotionally numb',
    subscale: 'avoidance'
  },
  {
    id: 2,
    text: 'My heart started pounding when I thought about my work with clients',
    subscale: 'intrusion'
  },
  {
    id: 3,
    text: 'It seemed as if I was reliving the trauma(s) experienced by my client(s)',
    subscale: 'intrusion'
  },
  {
    id: 4,
    text: 'I had trouble sleeping',
    subscale: 'arousal'
  },
  {
    id: 5,
    text: 'I felt discouraged about the future',
    subscale: 'avoidance'
  },
  {
    id: 6,
    text: 'Reminders of my work with clients upset me',
    subscale: 'intrusion'
  },
  {
    id: 7,
    text: 'I had little interest in being around others',
    subscale: 'avoidance'
  },
  {
    id: 8,
    text: 'I felt jumpy',
    subscale: 'arousal'
  },
  {
    id: 9,
    text: 'I was less active than usual',
    subscale: 'avoidance'
  },
  {
    id: 10,
    text: 'I thought about my work with clients when I didn\'t intend to',
    subscale: 'intrusion'
  },
  {
    id: 11,
    text: 'I had trouble concentrating',
    subscale: 'arousal'
  },
  {
    id: 12,
    text: 'I avoided people, places, or things that reminded me of my work with clients',
    subscale: 'avoidance'
  },
  {
    id: 13,
    text: 'I had disturbing dreams about my work with clients',
    subscale: 'intrusion'
  },
  {
    id: 14,
    text: 'I wanted to avoid working with some clients',
    subscale: 'avoidance'
  },
  {
    id: 15,
    text: 'I was easily annoyed',
    subscale: 'arousal'
  },
  {
    id: 16,
    text: 'I expected something bad to happen',
    subscale: 'arousal'
  },
  {
    id: 17,
    text: 'I noticed gaps in my memory about client sessions',
    subscale: 'avoidance'
  }
]

export const TIMEFRAME_NOTE = 'NOTE: "Client" is used to indicate persons with whom you have been engaged in a helping relationship. You may substitute another noun that better represents your work such as consumer, patient, recipient, etc.'

export const INSTRUCTIONS = 'The following is a list of statements made by persons who have been impacted by their work with traumatized clients. Read each statement then indicate how frequently the statement was true for you in the past seven (7) days.'
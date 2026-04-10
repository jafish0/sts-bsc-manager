export const SESSION_EVALUATION_CONFIG = {
  introText: "This evaluation is intended to help assess how well this online training was able to meet our learning objectives. It is anonymous and is for planning purposes only, so please be candid! Thank you for your time and efforts in helping us improve this course.",
  anonymityNotice: "Your responses are anonymous and cannot be linked to your sign-in information.",
  likertScale: [
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly Agree' },
  ],
  ratingItems: [
    { key: 'trainer_effective', text: 'The trainer was effective' },
    { key: 'content_objective_alignment', text: 'There was a high level of consistency between content and objectives' },
    { key: 'applicable_to_work', text: 'I will be able to incorporate the knowledge and skills I have gained from this training into my daily work' },
    { key: 'practical_knowledge', text: 'I am satisfied with the level of practical knowledge and skills presented in this training' },
    { key: 'methods_appropriate_audience', text: 'Teaching methods were appropriate for the intended audience' },
    { key: 'methods_appropriate_subject', text: 'Teaching methods were appropriate for the subject matter' },
  ],
  openTextQuestions: [
    { key: 'most_helpful', text: 'What part of the training was the most helpful?', required: true },
    { key: 'improvements', text: 'What are changes you would make to improve this training?', required: true },
    { key: 'additional_comments', text: 'Additional Comments', required: false },
  ],
  nps: {
    key: 'recommend_score',
    text: 'How likely are you to recommend this course to a friend or colleague?',
    min: 0,
    max: 10,
    minLabel: 'Not at all likely',
    maxLabel: 'Extremely likely',
    required: false,
  },
}

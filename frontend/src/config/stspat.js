// Secondary Traumatic Stress Policy Analysis Tool (STS-PAT)
// Sprang, G., Eslinger, J., Gottfried, R., & Gusler, S. (2022)
// University of Kentucky Center on Trauma and Children publication #22-STSPL-01

export const STS_PAT_INFO = {
  title: 'STS Policy Analysis Tool (STS-PAT)',
  description: 'A systematic review tool for analyzing organizational policies related to addressing Secondary Traumatic Stress.',
  citation: 'Sprang, G., Eslinger, J., Gottfried, R., & Gusler, S. (2022). The Secondary Traumatic Stress Policy Analysis Tool, University of Kentucky Center on Trauma and Children publication #22-STSPL-01',
  guidanceCitation: 'Sprang, G., Eslinger, J., Gottfried, R., & Gusler, S. (2022). The Secondary Traumatic Stress Policy Analysis Tool Implementation Guide, University of Kentucky Center on Trauma and Children publication #22-STSPL-02',
  scoring: {
    scale: [
      { value: 1, label: 'Not at All' },
      { value: 2, label: 'Very Little' },
      { value: 3, label: 'Somewhat' },
      { value: 4, label: 'Quite a Bit' },
      { value: 5, label: 'To a Great Degree' }
    ],
    maxTotal: 150,
    sections: {
      1: { name: 'Part 1: Existing STS Policies', itemCount: 13, maxScore: 65 },
      2: { name: 'Part 2: STS Policy Making Process', itemCount: 4, maxScore: 20 },
      3: { name: 'Part 3: Policy Implementation & Communication', itemCount: 5, maxScore: 25 },
      4: { name: 'Part 4: Policy Outcomes', itemCount: 8, maxScore: 40 }
    }
  }
}

export const STS_PAT_FAQ = {
  title: 'Secondary Traumatic Stress Policy Analysis Tool (STS-PAT)',
  items: [
    {
      question: 'What is the policy analysis tool?',
      answer: 'Organizations can best mitigate Secondary Traumatic Stress (STS) for staff when they have evidence-based policies that are STS-informed. This tool provides a series of questions that can help an organization analyze their policies for consistency with the principles of an STS-informed organization. This tool follows standards of care that indicate that STS is best considered from a primary and secondary prevention perspective and assists organizations in understanding more about the content and scope of existing policies, how they are developed and implemented, and whether desired outcomes are being achieved.'
    },
    {
      question: 'Who should use it?',
      answer: 'Internal teams or external consultants can use this tool to examine the content and process of policy-making, implementation and evaluation.'
    },
    {
      question: 'What is the purpose of this tool?',
      answer: 'This tool was developed to help organizations and units examine STS-related policies that they have in place and areas that may need to be developed. It can be used to establish a baseline understanding of how STS-informed the policies and policy-making process is and can be repeated over time to determine progress toward organizational STS related goals.'
    },
    {
      question: 'What is meant by a "policy?"',
      answer: 'For the purposes of this tool, a policy is defined as "A written policy or protocol that guides the allocation of resources, actions, and desired outcomes and serves as the mechanism by which regulations, procedures, and administrative actions are formalized."'
    },
    {
      question: 'How long will it take to use the tool?',
      answer: 'This tool will take approximately 30 minutes to complete.'
    },
    {
      question: 'How do I cite the STS-PAT?',
      answer: 'Sprang, G., Eslinger, J., Gottfried, R., & Gusler, S. (2022). The Secondary Traumatic Stress Policy Analysis Tool, University of Kentucky Center on Trauma and Children publication #22-STSPL-01'
    }
  ],
  beginnerMindset: 'We invite you to approach this assessment with a beginner\'s mindset. As Shunryu Suzuki in his book Zen Mindset, Beginner\'s Mindset suggests "In the beginner\'s mind there are many possibilities, in the expert\'s mind there are few." Regardless of where you are in your journey toward being STS-informed, we begin each step anew. This STS Policy analysis tool provides a range of policy options. Not all will be appropriate or necessary for your organization. If this is your first time using the tool, remember this is the beginning, think of the possibilities and avoid harsh judgments. The total score is only there so you can mark your progress over time.'
}

export const STS_PAT_SECTION_INTROS = {
  1: {
    title: 'Part 1: An Examination of Existing STS Policies',
    description: 'This section examines the content and scope of existing STS-related policies within your organization.',
    itemCount: 13
  },
  2: {
    title: 'Part 2: An Analysis of the STS Policy Making Process',
    description: 'This section analyzes the process by which STS-related policies are developed within your organization.',
    itemCount: 4
  },
  3: {
    title: 'Part 3: An Analysis on How STS Policies are Being Implemented, Communicated/Enforced',
    description: 'This section examines how STS-related policies are implemented and communicated to staff.',
    itemCount: 5
  },
  4: {
    title: 'Part 4: An Analysis of Policy Outcomes',
    description: 'This section evaluates the outcomes and effectiveness of STS-related policies.',
    itemCount: 8
  }
}

// All 30 questions organized by section
// Each question has: number, text, section, and guidance (from the Implementation Guide)
export const STS_PAT_QUESTIONS = [
  // ===== PART 1: Existing STS Policies (Q1-Q13) =====
  {
    number: 1,
    section: 1,
    text: 'To what degree does the organization\'s policy(ies) recognize STS as a trauma condition and respond accordingly?',
    guidance: {
      suggested: 'The diagnostic criteria for Post-Traumatic Stress Disorder (PTSD), Criterion A, defined in the DSM-5 (American Psychiatric Association, 2013), includes repeated or extreme exposure to aversive details of traumatic events. STS may develop with exposure to aversive details, that might not be repeated or extreme. Further STS may result in a significant trauma response, but this response may not meet full criteria for PTSD.',
      scoring: 'Scoring for this item should be based on the degree to which the policy acknowledges 1) indirect trauma exposure and 2) the need for a trauma informed intervention. Lower scores indicate that neither of these things is mentioned. Moderate scores indicate that only one of these things is mentioned, and higher scores indicate that both of these things are mentioned in the policy.',
      references: [
        'Sprang, G., Ford, J., Kerig, P., & Bride, B. (2018). Defining secondary traumatic stress and developing targeted assessments and interventions. Traumatology. http://dx.doi.org/10.1037/trm0000180'
      ]
    }
  },
  {
    number: 2,
    section: 1,
    text: 'To what degree does the organization demonstrate a commitment to addressing STS in the workplace through its mission and/or vision statement?',
    guidance: {
      suggested: 'Mission or vision statements formally communicate the purpose and values of an organization. Incorporating language about STS communicates to employees and others the value the organization places on mitigating STS within their workforce.',
      scoring: 'Scoring for this item should be based on the degree to which the organization demonstrates a commitment to addressing STS through its mission and/or vision statement. When scoring this item please remember that some organizations will have no reference to STS (low scores), some will have only brief mention of STS or related concepts (moderate scores), and some will have a mission/vision statement with expressed values and principles specific to STS (high scores).',
      references: []
    }
  },
  {
    number: 3,
    section: 1,
    text: 'To what degree does the organization demonstrate a commitment to addressing STS in its strategic plan?',
    guidance: {
      suggested: 'To address STS, an organization might engage in activities such as: monitoring, raising awareness, prevention, response strategies, etc.',
      scoring: 'Scoring for this item should reflect the degree to which the organization has expressed a formal commitment to address STS in its strategic plan. Lower scores reflect an absence of commitment outlined in the strategic plan. Moderate scores include only brief mention of STS in the strategic plan. Higher scores indicate clear statements of commitment to addressing STS for all employees.',
      references: []
    }
  },
  {
    number: 4,
    section: 1,
    text: 'To what degree does the organization\'s policy(ies) support the development of STS informed supervisors?',
    guidance: {
      suggested: 'The National Child Traumatic Stress Network has created a document titled "STS Core Competencies for Trauma Informed Supervision" that can be used to support the professional development of supervisors.',
      scoring: 'Scoring for this item should be based on the degree to which the policy provides that this developmental process will be followed. Lower scores reflect the absence of policy(ies) to support the development of STS informed supervisors. Moderate scores indicate the presence of policy(ies) that supports an overall trauma informed approach to workforce management but no mention of supervisors specifically. Higher scores reflect policy(ies) that clearly specify support for the development of STS informed supervisors within the organization.',
      references: [
        'https://www.nctsn.org/sites/default/files/resources/fact-sheet/using_the_secondary_traumatic_stress_core_competencies_in_trauma-informed_supervision.pdf'
      ]
    }
  },
  {
    number: 5,
    section: 1,
    text: 'To what degree do organizational policy(ies) encourage trauma-informed peer support opportunities to address STS?',
    guidance: {
      suggested: 'Peer support among employees can be an effective way of helping to mitigate the development of STS in staff. Opportunities that encourage peer support for staff can help build resilience. Peer support activities should be guided by the trauma-informed principles (e.g., creating trustworthiness as honoring privacy and confidentiality in the peer network).',
      scoring: 'Lower scores reflect an absence of trauma-informed peer support opportunities, moderate scores reflect peer support activities guided by inclusion of some of the elements of a trauma-informed approach, and higher scores reflect peer support activities guided by the inclusion of all trauma-informed elements (i.e., safety, trustworthiness and transparency, peer support, collaboration and mutuality, empowerment, voice and choice, and cultural, historical and gender issues).',
      references: []
    }
  },
  {
    number: 6,
    section: 1,
    text: 'To what degree is STS-related education included in the organization\'s onboarding policy(ies) for new staff?',
    guidance: {
      suggested: 'STS education provides baseline information about how indirect trauma exposure can impact an employee, and the subsequent symptoms or reactions the person could experience in response to these exposures. Topics include: terminology overview, signs/symptoms/impact, risk factors/vulnerabilities/protective factors, ethical issues, screening/assessment, resiliency, psychological/physical safety, resiliency/recovery strategies.',
      scoring: 'Scoring for this item should consider the comprehensiveness of the onboarding policy(ies) in covering this material. Lower scores indicate an absence of STS-related information included in the organization\'s onboarding policy(ies) for new staff. Moderate scores would indicate only some of the abovementioned topics are covered. Higher scores indicate that all of the abovementioned topics are covered.',
      references: [
        'Sprang et al. (2019). https://doi.org/10.1037/trm0000180'
      ]
    }
  },
  {
    number: 7,
    section: 1,
    text: 'To what degree does the organization\'s policy(ies) mandate ongoing, comprehensive STS awareness trainings for all employees?',
    guidance: {
      suggested: 'The frequency of STS awareness trainings is organization specific, yet a good STS policy would specify when trainings are delivered (e.g. quarterly, semi-annually, annually, etc.), and that trainings should be comprehensive in content and available to all employees.',
      scoring: 'Lower scores reflect a policy(ies) that does not specify the 1) frequency of trainings, 2) that trainings should be comprehensive in nature, and 3) available to all employees. Moderate scores reflect policy(ies) that have only part of these criteria met, and higher scores reflect policy(ies) that specify the above criteria.',
      references: []
    }
  },
  {
    number: 8,
    section: 1,
    text: 'To what degree does the organization\'s policy(ies) provide for external counseling services or an Employee Assistance Program (EAP) to address employees\' STS symptoms?',
    guidance: {
      suggested: 'Employees who are experiencing distressing symptoms with functional impairment related to STS may benefit from mental health services with an external trauma-informed provider.',
      scoring: 'Scoring for this item should be based on the degree to which the policy exists, and considers the need for STS specific resources. Lower scores reflect policy(ies) that does not identify external counseling resources for employees impacted by STS. Moderate scores indicate an EAP or external provider process exists but does not require these providers are proficient in treating trauma. Higher scores reflect policy(ies) that clearly identifies access to external trauma experts for staff.',
      references: []
    }
  },
  {
    number: 9,
    section: 1,
    text: 'To what degree is the policy(ies) about addressing staff responses to critical incidents trauma-informed?',
    guidance: {
      suggested: 'Understanding STS within the context of a trauma-informed care approach increases the likelihood that positive outcomes will be achieved. SAMHSA\'s six key principles of a trauma-informed approach: Safety, Trustworthiness and transparency, Peer support, Collaboration and mutuality, Empowerment voice and choice, Cultural historical and gender issues.',
      scoring: 'Scoring for this item should be based on the degree to which the organization\'s policy on responding to critical incidents is based on the key elements of trauma-informed care. Low scores indicate absence of trauma-informed elements related to responding to critical incidents, moderate scoring indicates inclusion of some of the elements of a trauma-informed approach, higher scores indicate inclusion of all trauma-informed elements.',
      references: [
        'SAMHSA: https://ncsacw.samhsa.gov/userfiles/files/SAMHSA_Trauma.pdf'
      ]
    }
  },
  {
    number: 10,
    section: 1,
    text: 'To what degree does the policy provide for an STS champion or team that is responsible for STS related topics within the organization, providing time and resources for this cause?',
    guidance: {
      suggested: 'When implementing a new policy it is helpful to identify a person or team who will champion the cause. Qualities of an STS Champion include knowledge about STS, ways to help mitigate the development of STS, agreement that STS-related policy(ies) can help improve STS-related outcomes, and enthusiasm about the endeavor.',
      scoring: 'Lower scores reflect policy(ies) that have not 1) identified an STS Champion or team, 2) specified an allowance of time for the STS Champion or team to engage in the role, or 3) provided necessary resources for the person(s) to engage in the role. Moderate scores reflect policy(ies) that have some but not all of the above. Higher scores reflect policy(ies) that includes all of the above.',
      references: [
        'https://sph.unc.edu/sph-news/what-is-an-innovation-champion-and-how-can-we-support-them/'
      ]
    }
  },
  {
    number: 11,
    section: 1,
    text: 'To what degree is a policy(ies) in place for ongoing monitoring of STS in the workplace in a confidential and non-stigmatizing manner?',
    guidance: {
      suggested: 'Ongoing confidential and non-stigmatizing monitoring of STS within the workplace should be a recommended component of an organization\'s STS policy. Monitoring may be conducted formally or informally via STS self-report measures, or via the organization monitoring related trends such as job satisfaction, absenteeism, turnover intentions and actual turnover.',
      scoring: 'Scoring for this should be based on the degree to which the STS policy refers to 1) ongoing monitoring of STS, 2) the confidentiality and non-stigmatizing manner of the monitoring process, and 3) how often STS monitoring actually occurs within the organization. Lower scores reflect policy(ies) that none or one of the above scoring instruction 4 items are included in the policy, moderate scores reflect policy(ies) that includes 2-3 items, and higher scores reflect policy(ies) that includes 3-4 items of the scoring guidance.',
      references: []
    }
  },
  {
    number: 12,
    section: 1,
    text: 'To what degree do STS policy(ies) reflect diversity, equity and inclusion?',
    guidance: {
      suggested: 'The STS policy should reflect all the interest groups that could be affected by it. It should thereby strive for DEI: Diversity, Equity and Inclusion.',
      scoring: 'This item should be scored based on the degree to which the STS policy reflects a DEI approach. Lower scores reflect policy(ies) that include little attention to DEI, moderate scores reflect policy(ies) that indicate attention to some of these elements, and higher scores reflect policy(ies) that indicate attention to all of these elements (i.e., diversity, equity and inclusion).',
      references: []
    }
  },
  {
    number: 13,
    section: 1,
    text: 'To what degree does policy(ies) allocate financial and instrumental support for its STS initiatives?',
    guidance: {
      suggested: 'Financial support can help ensure success of policy initiatives. There are also ways of supporting STS initiatives beyond financial allocations. Such instrumental supports may include but are not limited to: integration of STS related policy into current training plans, acknowledgment and support of the STS initiative(s) by leadership, communication within the organization about free resources related to STS policy(ies).',
      scoring: 'Scoring for this item is based on the degree to which the policy allocates financial and/or instrumental support for STS initiatives. Lower scores indicate little or no mention of financial or instrumental support for STS initiatives within the policy(ies). Moderate scores indicate either financial or instrumental support. Higher scores indicate allocation of both financial and instrumental support for STS initiatives by the stated policy(ies).',
      references: []
    }
  },

  // ===== PART 2: STS Policy Making Process (Q14-Q17) =====
  {
    number: 14,
    section: 2,
    text: 'To what degree are there different types of evidence that feed into the STS policy making process (e.g., scientific evidence, focus group findings, meeting minutes, etc.)?',
    guidance: {
      suggested: 'Utilizing different types of evidence can help an organization create policy(ies) that are more informed and attuned to the specific needs of the organization.',
      scoring: 'Scoring for this item should be based on the degree to which the policy making process considers a wide range of evidence. Lower scores reflect policy(ies) that does not use evidence at all to make policy decisions. Moderate scores indicate the policy is informed by only one type of evidence during the policy-making process. Higher scores reflect policy(ies) that specifies the incorporation of multiple types of evidence in the policy-making process.',
      references: [
        'Sprang, G., Ford, J., Kerig, P., & Bride, B. (2019). Defining Secondary Traumatic Stress and Developing Targeted Assessments and Interventions. Traumatology, 25, 2, 72-81. https://doi.org/10.1037/trm0000180'
      ]
    }
  },
  {
    number: 15,
    section: 2,
    text: 'To what degree is performance data used to make STS-related policy(ies) decisions?',
    guidance: {
      suggested: 'Performance data refers to any form of information about the impact of processes, services or systems on organizational, workforce or client outcomes.',
      scoring: 'Scoring for this item should be based on the degree to which performance data drives STS policy decision-making. Lower scores reflect a policy-making process that does not use performance data to make STS-related policy decisions. Moderate scores indicate only minimal use of performance data. Higher scores reflect an STS-related policy making process that specifies how performance data is used to inform policy decisions.',
      references: [
        'Akin, B. A., Strolin-Goltzman, J., & Collins-Camargo, C. (2017). Successes and challenges in developing trauma-informed child welfare systems. Children and Youth Services Review, 82, 42-52.'
      ]
    }
  },
  {
    number: 16,
    section: 2,
    text: 'To what degree does the STS policy making process include a diverse group of people including people who have been historically excluded, people of different cultural and linguistic backgrounds, and people with high levels of indirect trauma exposure?',
    guidance: {
      suggested: 'The STS policy making process should be influenced by all the interest groups that will be affected by the decided policy.',
      scoring: 'This item should be scored based on the degree of representation of those with high levels of indirect exposure and those who are culturally, linguistically, and/or racially marginalized groups on the policy making committee. Lower scores reflect a policy making process that does not refer to these issues at all. Moderate scores indicate some groups are included in policy making but not others. Higher scores reflect a policy-making process that includes all interest groups affected by the policy within the organization.',
      references: []
    }
  },
  {
    number: 17,
    section: 2,
    text: 'To what degree does the STS policy making process bring together people from different disciplines, projects and organizational units?',
    guidance: {
      suggested: 'The STS policy making process should involve an interdisciplinary team of employees that represent all disciplines, projects, and units across the organization to help create an informed policy-making process.',
      scoring: 'This item should be scored based on the degree of multidisciplinary and organizational representation involved in the STS policy making process. Lower scores reflect an organization\'s policy-making process that does not include representatives from different disciplines, projects and units. Moderate scores indicate mid-range representation. Higher scores reflect a policy-making process that includes full representation of an organization\'s employees from different disciplines, projects and organizational units.',
      references: []
    }
  },

  // ===== PART 3: Policy Implementation & Communication (Q18-Q22) =====
  {
    number: 18,
    section: 3,
    text: 'To what degree does the organization evaluate the effectiveness of its STS-related or STS-specific policy(ies)?',
    guidance: {
      suggested: 'Evaluating the effectiveness of an STS related policy is an important part of the implementation process.',
      scoring: 'Scoring for this item should be based on the degree to which evaluation components (e.g., outcome evaluations, cost-benefit analysis, etc.) are directed toward STS policy evaluation. Lower scores reflect a policy with an absence of a plan for evaluation of the STS policy(ies). Moderate scores indicate minimal attention to evaluation in the policy. Higher scores reflect policy(ies) with a clearly delineated evaluation component.',
      references: [
        'CDC Brief: Evaluating Implementation - https://www.cdc.gov/injury/pdfs/policy/Brief%205-a.pdf'
      ]
    }
  },
  {
    number: 19,
    section: 3,
    text: 'To what degree are STS related policy(ies) effectively communicated to all employees?',
    guidance: {
      suggested: 'Effectively and actively communicating information related to STS policy(ies) to employees is an important part of the implementation process.',
      scoring: 'This item should be scored based on the perceived level of communication of STS related policy(ies) with all staff. Lower scores reflect no communication of STS specific policy(ies) to staff. Moderate scores indicate only passive communication. Higher scores reflect policy(ies) that were effectively communicated through active dissemination.',
      references: []
    }
  },
  {
    number: 20,
    section: 3,
    text: 'To what degree does the organization honor policy commitments made to staff that relate to STS?',
    guidance: {
      suggested: 'Organizational follow-through on commitments made to staff related to STS policy(ies) is an important part of being an STS-informed organization, and can build employee trust and confidence in the organization.',
      scoring: 'Scoring for this item should be based on the degree to which the organization has implemented STS-related policy(ies) commitments made to employees. Lower scores reflect an organization that has not honored STS-related commitments made to staff. Moderate scores indicate minimal effort at honoring commitments. Higher scores reflect an organization that has honored most of or all STS-related commitments made to staff.',
      references: []
    }
  },
  {
    number: 21,
    section: 3,
    text: 'To what degree does the STS policy(ies) designate a role/position responsible for overseeing the implementation of the policy(ies)?',
    guidance: {
      suggested: 'Overseeing the implementation of STS-related policy(ies) is an important part of the process that informs outcomes.',
      scoring: 'Scoring for this item is based on the degree to which the organization has identified a role/position (aka STS Champion) specifically responsible for overseeing the implementation process related to the STS policy(ies). Lower scores indicate no identified role/position. Moderate scores indicate that the policy delineates who holds responsibility but the role/position has not yet been filled. Higher scores indicate that the policy(ies) clearly delineates who holds responsibility for overseeing implementation and the role/position has been filled.',
      references: []
    }
  },
  {
    number: 22,
    section: 3,
    text: 'To what degree does the organizational policy(ies) regarding STS training specify that trainings should be based on evidence-based principles (EBP)?',
    guidance: {
      suggested: 'Evidence-based principles (EBPs) draw on the highest form of empirical evidence. An EBP approach is the objective and responsible use of current research and the best available data to guide decision-making and produce the desired outcomes.',
      scoring: 'Scoring for this item should measure the degree to which the organizational policy(ies) regarding STS trainings specify that curriculum should be based on EBPs. Lower scores indicate that the policy(ies) does not refer to STS trainings being based on EBPs, moderate scores indicate criteria for the training content but the use of EBPs is not specified; and higher scores indicate that the policy(ies) clearly delineates that STS trainings should be based on EBPs.',
      references: [
        'NCTSN Evidence-Based Practice: https://www.nctsn.org/resources/evidence-based-practice',
        'Sprang, G., Lei, F., & Bush, H. (2021). Can organizational efforts lead to less secondary traumatic stress? American Journal of Orthopsychiatry. https://doi.org/10.1037/ort0000546'
      ]
    }
  },

  // ===== PART 4: Policy Outcomes (Q23-Q30) =====
  {
    number: 23,
    section: 4,
    text: 'To what degree do the organization\'s existing STS policy(ies) provide physical safety for staff at work?',
    guidance: {
      suggested: 'Federal and state statutes regulate workplace hazards to avoid or minimize employee injury and disease. As exposure to indirect trauma can undermine employees\' sense of physical safety, organizational policy(ies) should address how employees\' physical safety will be addressed.',
      scoring: 'Scoring for this item is based on the degree to which the organization\'s policy acknowledges, recognizes, and addresses physical safety at work. Lower scores reflect policy(ies) that do not target increasing the physical safety of staff. Moderate scores indicate some attention to increasing physical safety but with no way to monitor effectiveness. Higher scores reflect a policy(ies) that clearly delineates ways in which the organization provides for physical safety for staff in a measurable way.',
      references: [
        'OSHA: https://www.osha.gov/laws-regs/oshact/completeoshact'
      ]
    }
  },
  {
    number: 24,
    section: 4,
    text: 'To what degree do the organization\'s existing STS policy(ies) provide psychological safety for staff?',
    guidance: {
      suggested: 'STS-informed organizations understand that STS is an occupational hazard and that the impact of STS can be mitigated through supportive organizational policies. Psychological safety is "a belief that one will not be punished or humiliated for speaking up with ideas, questions, concerns or mistakes" within a workplace (Edmondson, 2014).',
      scoring: 'The scoring for this item should be based on the degree to which STS related policy(ies) provide psychological safety for staff at work. Lower scores reflect policy(ies) that do not target increasing the psychological safety of staff. Moderate scores indicate some attention to increasing psychological safety but with no way to monitor effectiveness. Higher scores reflect a policy(ies) that clearly delineates ways in which the organization provides for psychological safety for staff in a measurable way.',
      references: [
        'Edmondson, A. (2014). Building a psychologically safe workplace. https://www.youtube.com/watch?v=LhoLuui9gX8'
      ]
    }
  },
  {
    number: 25,
    section: 4,
    text: 'To what degree do the organization\'s existing STS policy(ies) effectively promote resilience building activities?',
    guidance: {
      suggested: 'Resilience is an individual\'s ability to adapt to stress and adversity in a healthy manner. Building resiliency in staff members can help mitigate the development of STS symptoms.',
      scoring: 'Scoring for this item should be based on the degree to which the organization\'s policy effectively promotes resiliency building activities. Lower scores reflect a policy(ies) that does not promote resilience building activities for staff. Moderate scores indicate a policy that is moderately effective at promoting resilience building. High scores reflect a policy(ies) that is highly effective at promoting resilience building.',
      references: []
    }
  },
  {
    number: 26,
    section: 4,
    text: 'To what degree are the organization\'s policy outcomes related to STS achieved?',
    guidance: {
      suggested: 'An important part of the policy analysis process is determining the degree to which intended outcomes are achieved.',
      scoring: 'Scoring should reflect the degree to which the organization has achieved its STS related outcomes. Lower scores reflect an absence of STS-related policy(ies). Moderate scores indicate a policy that is moderately effective. High scores reflect a policy(ies) that is highly effective at addressing STS.',
      references: [
        'Sprang, G., Lei, F., & Bush, H. (2021). Can organizational efforts lead to less secondary traumatic stress? American Journal of Orthopsychiatry. https://doi.org/10.1037/ort0000546'
      ]
    }
  },
  {
    number: 27,
    section: 4,
    text: 'To what degree does the organization utilize both quantitative and qualitative methods to evaluate the effectiveness of STS related policy(ies)?',
    guidance: {
      suggested: 'Utilizing both quantitative and qualitative methods (also known as a mixed methods approach) can help ensure that evaluation activities provide a broad perspective on successes and areas in need of improvement.',
      scoring: 'Scoring for this item should be based on the degree to which the organization incorporates both quantitative and qualitative evaluation methods into the STS policy evaluation plan. Lower scores reflect that no evaluation has occurred, moderate scores reflect that one methodology only is used, and higher scores reflect that both methodologies are used.',
      references: [
        'SAMHSA Evaluate Your Program: https://www.samhsa.gov/workplace/toolkit/evaluate-program'
      ]
    }
  },
  {
    number: 28,
    section: 4,
    text: 'To what degree are the achievements of and/or lessons learned from the organization\'s STS related policy(ies) effectively communicated within the organization?',
    guidance: {
      suggested: 'Along with evaluation of the implementation process and policy outcomes, it is important to communicate policy achievements and lessons learned to employees.',
      scoring: 'Scoring for this item should be based on the degree to which the organization communicates STS-related policy(ies) successes and lessons learned with employees. Lower scores indicate an absence or limited communication. Moderate scores indicate some occasional communication. Higher scores indicate communication of STS related policy achievements and lessons learned occur regularly within the organization.',
      references: [
        'Husain, Z. (2013). Effective Communication Brings Successful Organizational Change. The Business & Management Review, 3(2), 43-50.'
      ]
    }
  },
  {
    number: 29,
    section: 4,
    text: 'How effectively are barriers to implementation of the organization\'s STS policy(ies) addressed?',
    guidance: {
      suggested: 'Barriers to implementation of the organization\'s STS-related policy(ies) can arise even when thorough implementation planning has occurred.',
      scoring: 'Scoring for this item should be based on the degree to which the organization effectively assesses and responds to implementation barriers related to STS policy(ies). Lower scores reflect an organization that has not assessed and addressed STS related implementation barriers. Moderate scores indicate an organization has assessed but not yet addressed (or vice-versa) implementation barriers. Higher scores reflect an organization that has been able to assess barriers to the implementation of STS policy(ies) and has used information/data to make necessary adjustments.',
      references: [
        'https://www.healthpolicyproject.com/pubs/272_ImplementationBarriersResourceGuide.pdf'
      ]
    }
  },
  {
    number: 30,
    section: 4,
    text: 'To what degree are unintended, negative consequences of the STS policy making process addressed?',
    guidance: {
      suggested: 'Unintended consequences can occur throughout the policy development and implementation process.',
      scoring: 'Scoring for this item is based on the degree to which the organization assesses and responds to unintended negative consequences during the STS policy implementation process. Lower scores reflect an organization that has not assessed and addressed unintended negative consequences that have occurred. Moderate scores indicate organizations that have identified unintended negative consequences but have not yet addressed them. Higher scores reflect an organization that has assessed unintended negative consequences and has used this information/data to make necessary adjustments to the STS policy implementation process or has assessed and has not identified any unintended, negative consequences to address.',
      references: [
        'Oliver, K., Lorenc, T., Tinkler, J., & Bonell, C. (2019). Understanding the unintended consequences of public health policies. BMC Public Health, 1057. https://doi.org/10.1186/s12889-019-7389-6'
      ]
    }
  }
]

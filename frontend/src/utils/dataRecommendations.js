import { STSS_SUBSCALES, STSIOA_DOMAIN_MAX, STSIOA_TOTAL_MAX } from './constants'

const DOMAIN_LABELS = {
  resilience: 'Resilience Building (Domain 1)',
  safety: 'Sense of Safety (Domain 2)',
  policies: 'Organizational Policies (Domain 3)',
  leadership: 'Practices of Leaders (Domain 4)',
  routine: 'Routine Organizational Practices (Domain 5)',
  evaluation: 'Evaluation & Monitoring (Domain 6)'
}

// STSS Total interpretation thresholds (range 17-85)
function classifySTSSTotal(mean) {
  if (mean <= 28) return { level: 'low', label: 'Low STS', interpretation: 'Staff report low levels of secondary traumatic stress symptoms. This is a positive indicator of organizational health.' }
  if (mean <= 37) return { level: 'mild', label: 'Mild STS', interpretation: 'Staff are experiencing some STS symptoms. Monitor these levels and consider preventive measures.' }
  if (mean <= 43) return { level: 'moderate', label: 'Moderate STS', interpretation: 'Staff are experiencing moderate STS. Active intervention is recommended to prevent escalation.' }
  if (mean <= 52) return { level: 'high', label: 'High STS', interpretation: 'Staff STS levels are elevated. Prioritize resilience and safety interventions.' }
  return { level: 'severe', label: 'Severe STS', interpretation: 'Staff are experiencing severe STS symptoms. Immediate organizational response is needed.' }
}

// ProQOL subscale classifications (range 10-50)
function classifyProQOLCS(mean) {
  if (mean >= 42) return { level: 'high', label: 'High Compassion Satisfaction' }
  if (mean >= 23) return { level: 'average', label: 'Average Compassion Satisfaction' }
  return { level: 'low', label: 'Low Compassion Satisfaction' }
}

function classifyProQOLBurnout(mean) {
  if (mean <= 22) return { level: 'low', label: 'Low Burnout' }
  if (mean <= 41) return { level: 'average', label: 'Average Burnout' }
  return { level: 'high', label: 'High Burnout' }
}

function classifyProQOLSTS(mean) {
  if (mean <= 22) return { level: 'low', label: 'Low Secondary Trauma' }
  if (mean <= 41) return { level: 'average', label: 'Average Secondary Trauma' }
  return { level: 'high', label: 'High Secondary Trauma' }
}

// STSI-OA domain classification by percentage of max
function classifySTSIOADomain(mean, max) {
  const pct = (mean / max) * 100
  if (pct >= 75) return { level: 'strong', pct }
  if (pct >= 50) return { level: 'moderate', pct }
  return { level: 'needs_attention', pct }
}

// Map STSS subscales to relevant STSI-OA domains
const SUBSCALE_DOMAIN_MAP = {
  intrusion: ['resilience', 'safety'],
  avoidance: ['safety', 'policies'],
  negCognitions: ['resilience', 'leadership'],
  arousal: ['safety', 'resilience']
}

/**
 * Analyze a team's assessment data and generate recommendations.
 * @param {Object} reportData - { data: { [timepoint]: { stss, proqol, stsioa, demographics, n } } }
 * @param {string} timepoint - Which timepoint to analyze
 * @returns {Object} { strengths, growthAreas, insights, summary }
 */
export function generateRecommendations(reportData, timepoint) {
  const tp = reportData[timepoint]
  if (!tp || tp.n === 0) return null

  const strengths = []
  const growthAreas = []
  const insights = []

  // --- STSS Analysis ---
  if (tp.stss && tp.stss.n > 0) {
    const stssClass = classifySTSSTotal(tp.stss.total.mean)

    if (stssClass.level === 'low') {
      strengths.push({
        source: 'stss',
        label: 'Low STS Symptoms',
        score: tp.stss.total.mean.toFixed(1),
        interpretation: stssClass.interpretation,
        leverageAdvice: 'Continue current practices that are keeping STS levels low. Use this as a foundation to strengthen organizational policies and monitoring.'
      })
    } else if (stssClass.level === 'moderate' || stssClass.level === 'high' || stssClass.level === 'severe') {
      growthAreas.push({
        source: 'stss',
        label: `${stssClass.label} Symptoms`,
        score: `${tp.stss.total.mean.toFixed(1)} / 85`,
        severity: stssClass.level,
        interpretation: stssClass.interpretation,
        suggestedDomains: ['resilience', 'safety'],
        suggestedActions: [
          'Implement regular stress management or mindfulness practices',
          'Review workload and caseload distribution',
          'Ensure supervisors check in about the emotional impact of the work',
          'Consider establishing peer support groups'
        ]
      })
    }

    // Check individual subscales
    const subscaleThresholds = {
      intrusion: { max: 25, flag: 15, label: 'Intrusion' },
      avoidance: { max: 20, flag: 12, label: 'Avoidance' },
      negCognitions: { max: 20, flag: 12, label: 'Negative Cognitions & Mood' },
      arousal: { max: 20, flag: 12, label: 'Arousal' }
    }

    let highestSubscale = null
    let highestPct = 0

    Object.entries(subscaleThresholds).forEach(([key, config]) => {
      const mean = tp.stss[key]?.mean || 0
      const pct = mean / config.max
      if (pct > highestPct) {
        highestPct = pct
        highestSubscale = { key, mean, ...config }
      }

      if (mean > config.flag) {
        growthAreas.push({
          source: 'stss',
          label: `Elevated ${config.label} Symptoms`,
          score: `${mean.toFixed(1)} / ${config.max}`,
          severity: mean > config.flag * 1.2 ? 'high' : 'moderate',
          interpretation: `Staff are reporting elevated ${config.label.toLowerCase()} symptoms. This subscale is above the threshold for concern.`,
          suggestedDomains: SUBSCALE_DOMAIN_MAP[key] || ['resilience'],
          suggestedActions: getSubscaleActions(key)
        })
      }
    })
  }

  // --- ProQOL Analysis ---
  if (tp.proqol && tp.proqol.n > 0) {
    const csClass = classifyProQOLCS(tp.proqol.cs.mean)
    const burnoutClass = classifyProQOLBurnout(tp.proqol.burnout.mean)
    const stsClass = classifyProQOLSTS(tp.proqol.sts.mean)

    // Compassion Satisfaction
    if (csClass.level === 'high') {
      strengths.push({
        source: 'proqol',
        label: 'High Compassion Satisfaction',
        score: tp.proqol.cs.mean.toFixed(1),
        interpretation: 'Your team reports high satisfaction from their work helping others. This is a protective factor against burnout and STS.',
        leverageAdvice: 'This strength can help buffer against stress symptoms. Consider building peer support activities that reinforce this shared sense of purpose.'
      })
    } else if (csClass.level === 'low') {
      growthAreas.push({
        source: 'proqol',
        label: 'Low Compassion Satisfaction',
        score: `${tp.proqol.cs.mean.toFixed(1)} / 50`,
        severity: 'high',
        interpretation: 'Staff are not finding satisfaction in their work. This is a risk factor for turnover and disengagement.',
        suggestedDomains: ['resilience', 'leadership'],
        suggestedActions: [
          'Strengthen mission-focused activities and team celebrations',
          'Improve supervision quality with focus on recognizing meaningful work',
          'Create opportunities for staff to reflect on the positive impact of their work'
        ]
      })
    }

    // Burnout
    if (burnoutClass.level === 'low') {
      strengths.push({
        source: 'proqol',
        label: 'Low Burnout',
        score: tp.proqol.burnout.mean.toFixed(1),
        interpretation: 'Your team reports low burnout levels. Staff feel effective and engaged in their roles.',
        leverageAdvice: 'Maintain workload balance and supportive supervision practices that are keeping burnout low.'
      })
    } else if (burnoutClass.level === 'high') {
      growthAreas.push({
        source: 'proqol',
        label: 'High Burnout',
        score: `${tp.proqol.burnout.mean.toFixed(1)} / 50`,
        severity: 'high',
        interpretation: 'Staff are experiencing high burnout. This affects job satisfaction, retention, and quality of care.',
        suggestedDomains: ['leadership', 'policies'],
        suggestedActions: [
          'Review and reduce administrative burden',
          'Ensure adequate staffing and caseload distribution',
          'Improve supervision with focus on support rather than oversight',
          'Create policies that protect staff time and energy'
        ]
      })
    }

    // Secondary Trauma (ProQOL)
    if (stsClass.level === 'low') {
      strengths.push({
        source: 'proqol',
        label: 'Low Secondary Trauma (ProQOL)',
        score: tp.proqol.sts.mean.toFixed(1),
        interpretation: 'The ProQOL secondary trauma subscale indicates low levels of work-related trauma symptoms.',
        leverageAdvice: 'Current trauma-informed practices appear effective. Continue and reinforce them.'
      })
    } else if (stsClass.level === 'high') {
      growthAreas.push({
        source: 'proqol',
        label: 'High Secondary Trauma (ProQOL)',
        score: `${tp.proqol.sts.mean.toFixed(1)} / 50`,
        severity: 'high',
        interpretation: 'The ProQOL secondary trauma subscale is elevated, confirming significant trauma-related distress among staff.',
        suggestedDomains: ['safety', 'resilience'],
        suggestedActions: [
          'Implement trauma-specific coping strategies and debriefing',
          'Ensure access to EAP and mental health support',
          'Train supervisors in recognizing and responding to STS'
        ]
      })
    }
  }

  // --- STSI-OA Domain Analysis ---
  if (tp.stsioa && tp.stsioa.n > 0) {
    const domains = ['resilience', 'safety', 'policies', 'leadership', 'routine', 'evaluation']

    domains.forEach(domain => {
      const mean = tp.stsioa[domain]?.mean || 0
      const max = STSIOA_DOMAIN_MAX[domain]
      const cls = classifySTSIOADomain(mean, max)

      if (cls.level === 'strong') {
        strengths.push({
          source: 'stsioa',
          label: DOMAIN_LABELS[domain],
          score: `${mean.toFixed(1)} / ${max} (${cls.pct.toFixed(0)}%)`,
          interpretation: `Your organization has strong practices in this domain.`,
          leverageAdvice: `Use your strength in ${DOMAIN_LABELS[domain].split(' (')[0].toLowerCase()} to support improvement in weaker domains.`
        })
      } else if (cls.level === 'needs_attention') {
        growthAreas.push({
          source: 'stsioa',
          label: DOMAIN_LABELS[domain],
          score: `${mean.toFixed(1)} / ${max} (${cls.pct.toFixed(0)}%)`,
          severity: cls.pct < 35 ? 'high' : 'moderate',
          interpretation: `Your organization scores below 50% on this domain, indicating significant room for improvement.`,
          suggestedDomains: [domain],
          suggestedActions: getDomainActions(domain)
        })
      }
    })
  }

  // --- Demographics / Exposure Analysis ---
  const exposureMean = tp.demographics ? parseFloat(tp.demographics.exposureMean) : null

  // --- Cross-Cutting Insights ---
  const stssTotal = tp.stss?.total?.mean || 0
  const csScore = tp.proqol?.cs?.mean || 0
  const burnoutScore = tp.proqol?.burnout?.mean || 0
  const safetyPct = tp.stsioa ? ((tp.stsioa.safety?.mean || 0) / STSIOA_DOMAIN_MAX.safety) * 100 : null
  const evalPct = tp.stsioa ? ((tp.stsioa.evaluation?.mean || 0) / STSIOA_DOMAIN_MAX.evaluation) * 100 : null

  // High exposure + low safety
  if (exposureMean && exposureMean > 50 && safetyPct !== null && safetyPct < 50) {
    insights.push({
      title: 'High exposure with limited safety practices',
      text: `Your staff report significant trauma exposure (mean: ${exposureMean.toFixed(0)}/100), but your organization scores low on safety practices (${safetyPct.toFixed(0)}%). Staff are significantly exposed but the organization lacks safety systems to protect them. Strengthening safety practices should be a priority.`
    })
  }

  // High CS + high STSS
  if (csScore >= 42 && stssTotal >= 38) {
    insights.push({
      title: 'Compassion satisfaction as a buffer',
      text: 'Despite elevated STS symptoms, your team reports high compassion satisfaction. Research shows this is a powerful protective factor. Strengthening peer support and mission-focused activities can help maintain this buffer while you address the symptom-level concerns.'
    })
  }

  // Low burnout + high STSS
  if (burnoutScore <= 22 && stssTotal >= 38) {
    insights.push({
      title: 'Trauma exposure — not workload — is the primary concern',
      text: 'Staff are not burnt out but are experiencing STS specifically. This suggests the trauma exposure itself (not workload) is the primary issue. Focus on trauma-specific interventions like low-impact processing and resilience building rather than workload reduction.'
    })
  }

  // High burnout + low CS
  if (burnoutScore >= 42 && csScore <= 22) {
    insights.push({
      title: 'Burnout and disengagement — retention risk',
      text: 'Staff are burnt out and not finding satisfaction in their work. This combination is a significant retention risk. Address workload, supervision quality, and mission connection as a priority.'
    })
  }

  // High exposure + low evaluation
  if (exposureMean && exposureMean > 50 && evalPct !== null && evalPct < 50) {
    insights.push({
      title: 'High exposure without monitoring systems',
      text: `Your staff report high levels of trauma exposure (mean: ${exposureMean.toFixed(0)}/100), but your organization scores low on Evaluation & Monitoring (${evalPct.toFixed(0)}%). This means staff are significantly exposed but the organization lacks systems to detect and respond to STS. This is a high-priority gap.`
    })
  }

  // Multiple STSI-OA domains below 50%
  if (tp.stsioa) {
    const domains = ['resilience', 'safety', 'policies', 'leadership', 'routine', 'evaluation']
    const weakDomains = domains.filter(d => {
      const mean = tp.stsioa[d]?.mean || 0
      const max = STSIOA_DOMAIN_MAX[d]
      return (mean / max) * 100 < 50
    })
    if (weakDomains.length >= 3) {
      insights.push({
        title: 'Multiple organizational domains need attention',
        text: `${weakDomains.length} of 6 STSI-OA domains score below 50%. Rather than trying to address everything at once, prioritize 1-2 domains to start. Focus on the areas that will have the greatest impact on staff wellbeing given your specific context.`
      })
    }
  }

  // Build summary
  const summary = {
    stssTotal: tp.stss ? { mean: tp.stss.total.mean, ...classifySTSSTotal(tp.stss.total.mean) } : null,
    proqolCS: tp.proqol ? { mean: tp.proqol.cs.mean, ...classifyProQOLCS(tp.proqol.cs.mean) } : null,
    proqolBurnout: tp.proqol ? { mean: tp.proqol.burnout.mean, ...classifyProQOLBurnout(tp.proqol.burnout.mean) } : null,
    proqolSTS: tp.proqol ? { mean: tp.proqol.sts.mean, ...classifyProQOLSTS(tp.proqol.sts.mean) } : null,
    stsioaTotal: tp.stsioa ? {
      mean: tp.stsioa.total.mean,
      pct: ((tp.stsioa.total.mean / STSIOA_TOTAL_MAX) * 100),
      label: `${((tp.stsioa.total.mean / STSIOA_TOTAL_MAX) * 100).toFixed(0)}% of max`
    } : null,
    exposureMean: exposureMean || null,
    n: tp.n,
    timepoint
  }

  // Deduplicate growth areas — keep only the most severe per source+domain combo
  const deduped = []
  const seen = new Set()
  // Sort by severity so we keep worst first
  const severityOrder = { severe: 0, high: 1, moderate: 2, mild: 3 }
  growthAreas.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3))
  growthAreas.forEach(ga => {
    const key = `${ga.source}-${ga.label}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(ga)
    }
  })

  return { strengths, growthAreas: deduped, insights, summary }
}

function getSubscaleActions(subscale) {
  const actions = {
    intrusion: [
      'Implement grounding and mindfulness techniques',
      'Provide training on managing intrusive thoughts related to client trauma',
      'Ensure staff have access to clinical supervision for processing difficult cases'
    ],
    avoidance: [
      'Create safe spaces for staff to process difficult experiences',
      'Normalize discussions about the emotional impact of the work',
      'Address workload factors that may be driving avoidance behaviors'
    ],
    negCognitions: [
      'Provide cognitive-behavioral strategies for challenging negative thought patterns',
      'Strengthen peer support and team cohesion',
      'Ensure leadership communicates the value and impact of staff\'s work'
    ],
    arousal: [
      'Implement stress management or mindfulness practices',
      'Review workload and caseload distribution',
      'Ensure supervisors check in about the emotional impact of the work'
    ]
  }
  return actions[subscale] || []
}

function getDomainActions(domain) {
  const actions = {
    resilience: [
      'Introduce regular resilience-building activities (e.g., mindfulness, wellness check-ins)',
      'Create a calming or decompression space for staff',
      'Educate all staff about STS and how it impacts them personally'
    ],
    safety: [
      'Build peer support groups within the organization',
      'Create safe ways for staff to signal when they need support',
      'Train supervisors to check in about emotional safety regularly'
    ],
    policies: [
      'Include STS education as part of new employee orientation',
      'Develop written policies that address staff wellbeing',
      'Create guidelines for caseload management and rotation'
    ],
    leadership: [
      'Train leaders to recognize and respond to STS in their teams',
      'Have leaders model self-care and discuss their own experiences',
      'Create regular touchpoints between leadership and frontline staff'
    ],
    routine: [
      'Incorporate STS-related learning into ongoing staff meetings',
      'Use low-impact processing techniques in supervision',
      'Share resources regularly and create discussion opportunities'
    ],
    evaluation: [
      'Establish regular check-ins or surveys about staff wellbeing',
      'Create a process for reviewing and acting on assessment results',
      'Designate someone to track workforce trends related to STS'
    ]
  }
  return actions[domain] || []
}

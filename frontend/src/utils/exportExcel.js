import * as XLSX from 'xlsx'
import { TIMEPOINT_LABELS, TIMEPOINT_ORDER } from './constants'

/**
 * Export a full team report to Excel with multiple sheets.
 * Called from the TeamReport page.
 */
export function exportTeamReportExcel(report) {
  const { team, data: tpData, reviews } = report
  const wb = XLSX.utils.book_new()
  const date = new Date().toLocaleDateString('en-US')

  // Sheet 1: Summary
  const summaryRows = [
    ['STS-BSC Team Report'],
    ['Generated:', date],
    ['Agency:', team.agencyName],
    ['Team:', team.teamName],
    ['Display Name:', team.displayName || team.teamName],
    ...(team.motto ? [['Motto:', team.motto]] : []),
    ['Collaborative:', team.collaborativeName],
    [],
    ['Timepoint', 'Responses', 'Demographics', 'STSS', 'ProQOL', 'STSI-OA']
  ]
  TIMEPOINT_ORDER.forEach(tp => {
    const d = tpData[tp]
    if (d && d.n > 0) {
      summaryRows.push([
        TIMEPOINT_LABELS[tp],
        d.completion.responses,
        d.completion.demographics,
        d.completion.stss,
        d.completion.proqol,
        d.completion.stsioa
      ])
    } else {
      summaryRows.push([TIMEPOINT_LABELS[tp], 0, 0, 0, 0, 0])
    }
  })
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows)
  summaryWs['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  // Sheet 2: STSS
  const stssRows = [
    ['STSS — Secondary Traumatic Stress Scale (DSM-5 4-Factor Model)'],
    ['Timepoint', 'n', 'Total M', 'Total SD', 'Intrusion M', 'Intrusion SD', 'Avoidance M', 'Avoidance SD', 'Neg. Cog. M', 'Neg. Cog. SD', 'Arousal M', 'Arousal SD']
  ]
  TIMEPOINT_ORDER.forEach(tp => {
    const d = tpData[tp]?.stss
    if (d) {
      stssRows.push([
        TIMEPOINT_LABELS[tp], d.n,
        round(d.total.mean), round(d.total.sd),
        round(d.intrusion.mean), round(d.intrusion.sd),
        round(d.avoidance.mean), round(d.avoidance.sd),
        round(d.negCognitions.mean), round(d.negCognitions.sd),
        round(d.arousal.mean), round(d.arousal.sd)
      ])
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stssRows), 'STSS')

  // Sheet 3: ProQOL
  const proqolRows = [
    ['ProQOL 5 — Professional Quality of Life'],
    ['Timepoint', 'n', 'Compassion Satisfaction M', 'CS SD', 'Burnout M', 'Burnout SD', 'Secondary Trauma M', 'STS SD']
  ]
  TIMEPOINT_ORDER.forEach(tp => {
    const d = tpData[tp]?.proqol
    if (d) {
      proqolRows.push([
        TIMEPOINT_LABELS[tp], d.n,
        round(d.cs.mean), round(d.cs.sd),
        round(d.burnout.mean), round(d.burnout.sd),
        round(d.sts.mean), round(d.sts.sd)
      ])
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(proqolRows), 'ProQOL')

  // Sheet 4: STSI-OA
  const stsioaRows = [
    ['STSI-OA — STS-Informed Organizational Assessment'],
    ['Timepoint', 'n', 'Total M', 'Total SD', 'Resilience M', 'Resilience SD', 'Safety M', 'Safety SD', 'Policies M', 'Policies SD', 'Leadership M', 'Leadership SD', 'Routine M', 'Routine SD', 'Evaluation M', 'Evaluation SD']
  ]
  TIMEPOINT_ORDER.forEach(tp => {
    const d = tpData[tp]?.stsioa
    if (d) {
      stsioaRows.push([
        TIMEPOINT_LABELS[tp], d.n,
        round(d.total.mean), round(d.total.sd),
        round(d.resilience.mean), round(d.resilience.sd),
        round(d.safety.mean), round(d.safety.sd),
        round(d.policies.mean), round(d.policies.sd),
        round(d.leadership.mean), round(d.leadership.sd),
        round(d.routine.mean), round(d.routine.sd),
        round(d.evaluation.mean), round(d.evaluation.sd)
      ])
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stsioaRows), 'STSI-OA')

  // Sheet 5: Demographics
  const demoRows = [
    ['Demographics Summary'],
    ['Timepoint', 'n', 'Female %', 'Male %', 'Avg Age', 'Avg Years Service', 'Exposure Mean', 'Exposure SD']
  ]
  TIMEPOINT_ORDER.forEach(tp => {
    const d = tpData[tp]?.demographics
    if (d) {
      demoRows.push([
        TIMEPOINT_LABELS[tp], d.n,
        d.femalePercent, d.malePercent,
        d.avgAge, d.avgYearsService,
        d.exposureMean, d.exposureSD
      ])
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(demoRows), 'Demographics')

  // Generate filename and download
  const safeName = team.agencyName.replace(/[^a-zA-Z0-9]/g, '_')
  XLSX.writeFile(wb, `${safeName}_Team_Report_${formatDate()}.xlsx`)
}

/**
 * Export the current DataVisualization view as a single-sheet Excel file.
 * Called from the DataVisualization page.
 */
export function exportDataVizExcel(data, filters) {
  const wb = XLSX.utils.book_new()
  const rows = [
    ['STS-BSC Data Visualization Export'],
    ['Generated:', new Date().toLocaleDateString('en-US')],
    ['Collaborative:', filters.collaborative],
    ['Timepoint:', filters.timepoint],
    ['Team:', filters.team],
    ['Total Responses:', data.totalResponses],
    []
  ]

  // Demographics section
  if (data.demographics) {
    rows.push(['--- Demographics ---'])
    rows.push(['Female %', data.demographics.femalePercent])
    rows.push(['Male %', data.demographics.malePercent])
    rows.push(['Avg Age', data.demographics.avgAge])
    rows.push(['Avg Years Service', data.demographics.avgYearsService])
    rows.push(['Exposure Mean', data.demographics.exposureMean])
    rows.push(['Exposure SD', data.demographics.exposureSD])
    rows.push([])
  }

  // STSS section
  if (data.stss) {
    rows.push(['--- STSS (n=' + data.stss.n + ') ---'])
    rows.push(['Measure', 'Mean', 'SD'])
    rows.push(['Total', round(data.stss.total.mean), round(data.stss.total.sd)])
    rows.push(['Intrusion', round(data.stss.intrusion.mean), round(data.stss.intrusion.sd)])
    rows.push(['Avoidance', round(data.stss.avoidance.mean), round(data.stss.avoidance.sd)])
    rows.push(['Neg. Cognitions & Mood', round(data.stss.negCognitions.mean), round(data.stss.negCognitions.sd)])
    rows.push(['Arousal', round(data.stss.arousal.mean), round(data.stss.arousal.sd)])
    rows.push([])
  }

  // ProQOL section
  if (data.proqol) {
    rows.push(['--- ProQOL (n=' + data.proqol.n + ') ---'])
    rows.push(['Subscale', 'Mean', 'SD'])
    rows.push(['Compassion Satisfaction', round(data.proqol.cs.mean), round(data.proqol.cs.sd)])
    rows.push(['Burnout', round(data.proqol.burnout.mean), round(data.proqol.burnout.sd)])
    rows.push(['Secondary Traumatic Stress', round(data.proqol.sts.mean), round(data.proqol.sts.sd)])
    rows.push([])
  }

  // STSI-OA section
  if (data.stsioa) {
    rows.push(['--- STSI-OA (n=' + data.stsioa.n + ') ---'])
    rows.push(['Domain', 'Mean', 'SD'])
    rows.push(['Total', round(data.stsioa.total.mean), round(data.stsioa.total.sd)])
    rows.push(['Resilience', round(data.stsioa.resilience.mean), round(data.stsioa.resilience.sd)])
    rows.push(['Safety', round(data.stsioa.safety.mean), round(data.stsioa.safety.sd)])
    rows.push(['Policies', round(data.stsioa.policies.mean), round(data.stsioa.policies.sd)])
    rows.push(['Leadership', round(data.stsioa.leadership.mean), round(data.stsioa.leadership.sd)])
    rows.push(['Routine', round(data.stsioa.routine.mean), round(data.stsioa.routine.sd)])
    rows.push(['Evaluation', round(data.stsioa.evaluation.mean), round(data.stsioa.evaluation.sd)])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Data')

  const safeName = filters.collaborative.replace(/[^a-zA-Z0-9]/g, '_')
  XLSX.writeFile(wb, `${safeName}_${filters.timepoint}_${formatDate()}.xlsx`)
}

function round(val) {
  return Math.round(val * 100) / 100
}

function formatDate() {
  return new Date().toISOString().split('T')[0]
}

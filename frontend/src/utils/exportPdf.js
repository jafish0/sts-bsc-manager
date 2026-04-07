import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { TIMEPOINT_LABELS, TIMEPOINT_ORDER } from './constants'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'
import ukLogo from '../assets/UK_Lockup-286.png'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function round(val) {
  return Math.round(val * 100) / 100
}

function msd(stat) {
  if (!stat) return '—'
  return `${round(stat.mean)} (${round(stat.sd)})`
}

/**
 * Export a full team report as a branded PDF.
 */
export async function exportTeamReportPdf(report) {
  const { team, data: tpData, reviews } = report
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // Load logos
  const [ctacImg, ukImg] = await Promise.all([loadImage(ctacLogo), loadImage(ukLogo)])

  // --- Page 1: Cover ---
  // Logos
  if (ctacImg) doc.addImage(ctacImg, 'PNG', margin, y, 55, 18)
  if (ukImg) doc.addImage(ukImg, 'PNG', pageW - margin - 45, y, 45, 15)
  y += 28

  // Title bar
  doc.setFillColor(14, 31, 86) // Navy
  doc.rect(margin, y, pageW - margin * 2, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('STS-BSC Team Report', pageW / 2, y + 9.5, { align: 'center' })
  y += 22

  doc.setTextColor(14, 31, 86)
  doc.setFontSize(13)
  doc.text(team.agencyName, pageW / 2, y, { align: 'center' })
  y += 7
  if (team.displayName && team.displayName !== team.teamName && team.displayName !== team.agencyName) {
    doc.setFontSize(11)
    doc.text(`"${team.displayName}"`, pageW / 2, y, { align: 'center' })
    y += 6
  }
  if (team.motto) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.text(`"${team.motto}"`, pageW / 2, y, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    y += 6
  }
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`${team.collaborativeName}`, pageW / 2, y, { align: 'center' })
  y += 6
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageW / 2, y, { align: 'center' })
  y += 14

  // --- Completion Table ---
  sectionHeader(doc, 'Completion Status', margin, y, pageW)
  y += 10

  const completionBody = TIMEPOINT_ORDER.map(tp => {
    const d = tpData[tp]
    if (!d || d.n === 0) return [TIMEPOINT_LABELS[tp], '0', '0', '0', '0', '0']
    return [
      TIMEPOINT_LABELS[tp],
      String(d.completion.responses),
      String(d.completion.demographics),
      String(d.completion.stss),
      String(d.completion.proqol),
      String(d.completion.stsioa)
    ]
  })

  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Timepoint', 'Responses', 'Demographics', 'STSS', 'ProQOL', 'STSI-OA']],
    body: completionBody,
    theme: 'grid',
    headStyles: { fillColor: [14, 31, 86], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold' } }
  })
  y = doc.lastAutoTable.finalY + 10

  // --- Demographics ---
  const firstTp = TIMEPOINT_ORDER.find(tp => tpData[tp]?.demographics)
  if (firstTp) {
    const d = tpData[firstTp].demographics
    sectionHeader(doc, `Demographics (${TIMEPOINT_LABELS[firstTp]})`, margin, y, pageW)
    y += 10
    doc.setFontSize(9)
    doc.setTextColor(55, 65, 81)
    const demoText = `N=${d.n}  |  Female: ${d.femalePercent}%  |  Male: ${d.malePercent}%  |  Avg Age: ${d.avgAge}  |  Avg Years Service: ${d.avgYearsService}  |  Exposure: M=${d.exposureMean}, SD=${d.exposureSD}`
    doc.text(demoText, margin, y)
    y += 10
  }

  // --- STSS Table ---
  const stssTimepoints = TIMEPOINT_ORDER.filter(tp => tpData[tp]?.stss)
  if (stssTimepoints.length > 0) {
    checkPageBreak(doc, y, 50, margin)
    y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y
    sectionHeader(doc, 'STSS — Secondary Traumatic Stress Scale (DSM-5 4-Factor)', margin, y, pageW)
    y += 10

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Timepoint', 'n', 'Total M(SD)', 'Intrusion M(SD)', 'Avoidance M(SD)', 'Neg.Cog. M(SD)', 'Arousal M(SD)']],
      body: stssTimepoints.map(tp => {
        const d = tpData[tp].stss
        return [TIMEPOINT_LABELS[tp], String(d.n), msd(d.total), msd(d.intrusion), msd(d.avoidance), msd(d.negCognitions), msd(d.arousal)]
      }),
      theme: 'grid',
      headStyles: { fillColor: [14, 31, 86], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      columnStyles: { 0: { fontStyle: 'bold' } }
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // --- ProQOL Table ---
  const proqolTimepoints = TIMEPOINT_ORDER.filter(tp => tpData[tp]?.proqol)
  if (proqolTimepoints.length > 0) {
    if (y > 220) { doc.addPage(); y = margin }
    sectionHeader(doc, 'ProQOL 5 — Professional Quality of Life', margin, y, pageW)
    y += 10

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Timepoint', 'n', 'Compassion Satisfaction M(SD)', 'Burnout M(SD)', 'Secondary Trauma M(SD)']],
      body: proqolTimepoints.map(tp => {
        const d = tpData[tp].proqol
        return [TIMEPOINT_LABELS[tp], String(d.n), msd(d.cs), msd(d.burnout), msd(d.sts)]
      }),
      theme: 'grid',
      headStyles: { fillColor: [14, 31, 86], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { fontStyle: 'bold' } }
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // --- STSI-OA Table ---
  const stsioaTimepoints = TIMEPOINT_ORDER.filter(tp => tpData[tp]?.stsioa)
  if (stsioaTimepoints.length > 0) {
    if (y > 200) { doc.addPage(); y = margin }
    sectionHeader(doc, 'STSI-OA — Organizational Assessment (6 Domains)', margin, y, pageW)
    y += 10

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Timepoint', 'n', 'Total', 'Resilience', 'Safety', 'Policies', 'Leadership', 'Routine', 'Evaluation']],
      body: stsioaTimepoints.map(tp => {
        const d = tpData[tp].stsioa
        return [
          TIMEPOINT_LABELS[tp], String(d.n), msd(d.total),
          msd(d.resilience), msd(d.safety), msd(d.policies),
          msd(d.leadership), msd(d.routine), msd(d.evaluation)
        ]
      }),
      theme: 'grid',
      headStyles: { fillColor: [14, 31, 86], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      columnStyles: { 0: { fontStyle: 'bold' } }
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // --- Admin Reviews ---
  const reviewTimepoints = TIMEPOINT_ORDER.filter(tp => reviews[tp])
  if (reviewTimepoints.length > 0) {
    if (y > 200) { doc.addPage(); y = margin }
    sectionHeader(doc, 'Expert Review & Recommendations', margin, y, pageW)
    y += 10

    reviewTimepoints.forEach(tp => {
      const r = reviews[tp]
      if (y > 240) { doc.addPage(); y = margin }

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(14, 31, 86)
      doc.text(`${TIMEPOINT_LABELS[tp]}${r.released_to_agency ? ' (Published)' : ' (Draft)'}`, margin, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(55, 65, 81)

      if (r.overall_comments) { y = writeWrappedField(doc, 'Overall:', r.overall_comments, margin, y, pageW) }
      if (r.strengths) { y = writeWrappedField(doc, 'Strengths:', r.strengths, margin, y, pageW) }
      if (r.areas_for_improvement) { y = writeWrappedField(doc, 'Areas for Improvement:', r.areas_for_improvement, margin, y, pageW) }
      if (r.recommended_actions) { y = writeWrappedField(doc, 'Recommended Actions:', r.recommended_actions, margin, y, pageW) }
      y += 4
    })
  }

  // Footer on each page
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(156, 163, 175)
    doc.text(`Page ${i} of ${totalPages}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
    doc.text('STS Breakthrough Series Collaborative — University of Kentucky CTAC', pageW / 2, doc.internal.pageSize.getHeight() - 4, { align: 'center' })
  }

  // Save
  const safeName = team.agencyName.replace(/[^a-zA-Z0-9]/g, '_')
  doc.save(`${safeName}_Team_Report_${new Date().toISOString().split('T')[0]}.pdf`)
}

function sectionHeader(doc, text, margin, y, pageW) {
  doc.setFillColor(0, 167, 157) // Teal
  doc.rect(margin, y, pageW - margin * 2, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(text, margin + 3, y + 5)
}

function checkPageBreak(doc, y, needed, margin) {
  if (y + needed > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage()
    return margin
  }
  return y
}

function writeWrappedField(doc, label, text, margin, y, pageW) {
  if (y > 250) { doc.addPage(); y = 15 }
  doc.setFont('helvetica', 'bold')
  doc.text(label, margin, y)
  doc.setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(text, pageW - margin * 2 - 5)
  y += 4
  lines.forEach(line => {
    if (y > 260) { doc.addPage(); y = 15 }
    doc.text(line, margin + 2, y)
    y += 3.5
  })
  y += 2
  return y
}

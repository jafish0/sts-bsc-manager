import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { TIMEPOINT_LABELS } from './constants'
import { STS_PAT_INFO, STS_PAT_QUESTIONS, STS_PAT_SECTION_INTROS } from '../config/stspat'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

/**
 * Export STS-PAT assessment as PDF
 */
export function exportStsPatPdf(assessment, responses, teamName) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // Title
  doc.setFillColor(14, 31, 86)
  doc.rect(margin, y, pageW - margin * 2, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('STS Policy Analysis Tool (STS-PAT) Report', pageW / 2, y + 8, { align: 'center' })
  y += 18

  // Team / org info
  doc.setTextColor(14, 31, 86)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  if (teamName) { doc.text(`Team: ${teamName}`, margin, y); y += 5 }
  if (assessment.organization_name) { doc.text(`Organization: ${assessment.organization_name}`, margin, y); y += 5 }
  const tp = TIMEPOINT_LABELS[assessment.timepoint] || assessment.timepoint || ''
  if (tp) { doc.text(`Timepoint: ${tp}`, margin, y); y += 5 }
  if (assessment.completed_at) { doc.text(`Date: ${new Date(assessment.completed_at).toLocaleDateString()}`, margin, y); y += 5 }
  y += 3

  // Score summary
  doc.setFillColor(0, 167, 157)
  doc.rect(margin, y, pageW - margin * 2, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  const pct = Math.round((assessment.total_score / 150) * 100)
  doc.text(`Total Score: ${assessment.total_score} / 150 (${pct}%)`, pageW / 2, y + 7, { align: 'center' })
  y += 16

  // Section scores table
  doc.autoTable({
    startY: y,
    head: [['Section', 'Score', 'Max', '%']],
    body: [
      ['Part 1: Existing STS Policies', assessment.part1_score, 65, Math.round((assessment.part1_score / 65) * 100) + '%'],
      ['Part 2: STS Policy Making Process', assessment.part2_score, 20, Math.round((assessment.part2_score / 20) * 100) + '%'],
      ['Part 3: Policy Implementation & Communication', assessment.part3_score, 25, Math.round((assessment.part3_score / 25) * 100) + '%'],
      ['Part 4: Policy Outcomes', assessment.part4_score, 40, Math.round((assessment.part4_score / 40) * 100) + '%'],
      ['TOTAL', assessment.total_score, 150, pct + '%']
    ],
    theme: 'striped',
    headStyles: { fillColor: [14, 31, 86] },
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 }
  })
  y = doc.lastAutoTable.finalY + 8

  // Detailed results per section
  for (const section of [1, 2, 3, 4]) {
    if (y > 240) { doc.addPage(); y = margin }

    const sectionQuestions = STS_PAT_QUESTIONS.filter(q => q.section === section)
    const intro = STS_PAT_SECTION_INTROS[section]

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(14, 31, 86)
    doc.text(intro.title, margin, y)
    y += 5

    const rows = sectionQuestions.map(q => {
      const r = responses[q.number] || {}
      return [
        `Q${q.number}`,
        q.text.substring(0, 80) + (q.text.length > 80 ? '...' : ''),
        r.rating || '—',
        r.is_action_item ? 'Yes' : '',
        (r.notes || '').substring(0, 40)
      ]
    })

    doc.autoTable({
      startY: y,
      head: [['#', 'Question', 'Rating', 'Action', 'Notes']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [0, 167, 157] },
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 85 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 40 }
      }
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // Action items summary
  const actionItems = STS_PAT_QUESTIONS.filter(q => responses[q.number]?.is_action_item)
  if (actionItems.length > 0) {
    if (y > 240) { doc.addPage(); y = margin }
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(14, 31, 86)
    doc.text('Action Items Summary', margin, y)
    y += 5

    doc.autoTable({
      startY: y,
      head: [['#', 'Question', 'Rating', 'Notes']],
      body: actionItems.map(q => {
        const r = responses[q.number] || {}
        return [`Q${q.number}`, q.text.substring(0, 90), r.rating || '—', (r.notes || '').substring(0, 50)]
      }),
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 }
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // Citation
  if (y > 260) { doc.addPage(); y = margin }
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  doc.text(STS_PAT_INFO.citation, margin, y, { maxWidth: pageW - margin * 2 })

  doc.save(`STS-PAT_Report_${teamName || 'Team'}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

/**
 * Export STS-PAT assessment as Excel
 */
export function exportStsPatExcel(assessment, responses, teamName) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Summary
  const summaryRows = [
    ['STS Policy Analysis Tool (STS-PAT) Report'],
    ['Team:', teamName || ''],
    ['Organization:', assessment.organization_name || ''],
    ['Timepoint:', TIMEPOINT_LABELS[assessment.timepoint] || assessment.timepoint || ''],
    ['Date:', assessment.completed_at ? new Date(assessment.completed_at).toLocaleDateString() : ''],
    [],
    ['Section', 'Score', 'Max', '%'],
    ['Part 1: Existing STS Policies', assessment.part1_score, 65, Math.round((assessment.part1_score / 65) * 100)],
    ['Part 2: STS Policy Making Process', assessment.part2_score, 20, Math.round((assessment.part2_score / 20) * 100)],
    ['Part 3: Policy Implementation & Communication', assessment.part3_score, 25, Math.round((assessment.part3_score / 25) * 100)],
    ['Part 4: Policy Outcomes', assessment.part4_score, 40, Math.round((assessment.part4_score / 40) * 100)],
    ['TOTAL', assessment.total_score, 150, Math.round((assessment.total_score / 150) * 100)]
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows)
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

  // Sheets 2-5: One per section
  for (const section of [1, 2, 3, 4]) {
    const intro = STS_PAT_SECTION_INTROS[section]
    const questions = STS_PAT_QUESTIONS.filter(q => q.section === section)
    const rows = [
      [intro.title],
      [],
      ['Q#', 'Question', 'Rating', 'Action Item', 'Notes']
    ]
    questions.forEach(q => {
      const r = responses[q.number] || {}
      rows.push([q.number, q.text, r.rating || '', r.is_action_item ? 'Yes' : '', r.notes || ''])
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 5 }, { wch: 80 }, { wch: 8 }, { wch: 12 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, ws, `Part ${section}`)
  }

  // Sheet 6: Action Items
  const actionItems = STS_PAT_QUESTIONS.filter(q => responses[q.number]?.is_action_item)
  const aiRows = [
    ['Action Items'],
    [],
    ['Q#', 'Question', 'Rating', 'Notes']
  ]
  actionItems.forEach(q => {
    const r = responses[q.number] || {}
    aiRows.push([q.number, q.text, r.rating || '', r.notes || ''])
  })
  const wsAI = XLSX.utils.aoa_to_sheet(aiRows)
  wsAI['!cols'] = [{ wch: 5 }, { wch: 80 }, { wch: 8 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsAI, 'Action Items')

  XLSX.writeFile(wb, `STS-PAT_Report_${teamName || 'Team'}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

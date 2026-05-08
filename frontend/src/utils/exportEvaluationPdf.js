import jsPDF from 'jspdf'
import 'jspdf-autotable'

const NAVY = '#0E1F56'
const NAVY_RGB = [14, 31, 86]

// 6 Likert items in display order matching the sample report
// (Evaluation Report - Training Evaluation Report.pdf at the project root).
const LIKERT_FIELDS = [
  { key: 'trainer_effective',            label: 'Trainer was effective' },
  { key: 'content_objective_alignment',  label: 'High level of consistency between content and objectives' },
  { key: 'applicable_to_work',           label: 'I will be able to incorporate the knowledge and skills I have gained from this training in my work' },
  { key: 'practical_knowledge',          label: 'I am satisfied with the level of practical knowledge and skills presented' },
  { key: 'methods_appropriate_audience', label: 'Teaching methods appropriate for intended audience' },
  { key: 'methods_appropriate_subject',  label: 'Teaching methods appropriate for subject matter' },
]

function aggregate(values) {
  const nums = values.filter(v => v !== null && v !== undefined)
  if (nums.length === 0) return null
  return {
    n: nums.length,
    min: Math.min(...nums),
    max: Math.max(...nums),
    mean: nums.reduce((a, b) => a + b, 0) / nums.length,
  }
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  // event_date is YYYY-MM-DD; render as M/D/YYYY to match sample
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`
}

/**
 * Render an evaluation report PDF in the format of
 * `Evaluation Report - Training Evaluation Report.pdf` (sample at project root).
 *
 * sessions: Array<{
 *   event_date: string (YYYY-MM-DD),
 *   title: string,
 *   evaluations: Array<session_evaluations row>
 * }>
 */
export function exportEvaluationReportPdf(sessions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = 18

  // Title block
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(NAVY)
  doc.text('Training Evaluation Report', pageWidth / 2, y, { align: 'center' })
  y += 7
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(80)
  doc.text('University of Kentucky Center on Trauma and Children', pageWidth / 2, y, { align: 'center' })
  y += 3
  doc.setDrawColor(...NAVY_RGB).setLineWidth(0.6).line(margin, y, pageWidth - margin, y)
  y += 8

  sessions.forEach((session, idx) => {
    if (y > 250) { doc.addPage(); y = 18 }

    // Section heading: "{date} - {title}"
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(NAVY)
    doc.text(`${fmtDate(session.event_date)} - ${session.title}`, margin, y)
    y += 7

    const evals = session.evaluations || []
    const totalResponses = evals.length

    // ---- Q51 - Please rate (Likert table) ----
    doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(40)
    doc.text('Q51 - Please rate', margin, y)
    y += 4.5
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110)
    doc.text(`${totalResponses} Response${totalResponses === 1 ? '' : 's'}`, margin, y)
    y += 4

    const likertRows = LIKERT_FIELDS.map(f => {
      const agg = aggregate(evals.map(e => e[f.key]))
      return [
        f.label,
        agg ? agg.min.toFixed(2) : '—',
        agg ? agg.max.toFixed(2) : '—',
        agg ? agg.mean.toFixed(2) : '—',
      ]
    })

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Field', 'Min', 'Max', 'Mean']],
      body: likertRows,
      headStyles: { fillColor: NAVY_RGB, fontSize: 9, fontStyle: 'bold', textColor: 255 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 18 },
        2: { halign: 'right', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 22 },
      },
      theme: 'grid',
    })
    y = doc.lastAutoTable.finalY + 8

    // Helper: render a free-text question block (verbatim list of non-empty responses)
    const renderFreeText = (heading, key) => {
      const responses = evals.map(e => e[key]).filter(v => v && String(v).trim().length > 0)
      if (responses.length === 0) return

      if (y > 260) { doc.addPage(); y = 18 }
      doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(40)
      doc.text(heading, margin, y)
      y += 4.5
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110)
      doc.text(`${responses.length} Response${responses.length === 1 ? '' : 's'}`, margin, y)
      y += 5

      doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(40)
      const colWidth = pageWidth - 2 * margin - 4
      responses.forEach(text => {
        const lines = doc.splitTextToSize(String(text), colWidth)
        const blockHeight = lines.length * 4.2 + 1
        if (y + blockHeight > 280) { doc.addPage(); y = 18 }
        doc.text(lines, margin + 4, y)
        y += blockHeight
      })
      y += 4
    }

    renderFreeText('Q51 - What part of the training was the most helpful?', 'most_helpful')
    renderFreeText('Q52 - What are changes you would make to improve this training?', 'improvements')
    renderFreeText('Q53 - Additional Comments', 'additional_comments')

    if (idx < sessions.length - 1) {
      y += 4
      doc.setDrawColor(220).setLineWidth(0.2).line(margin, y, pageWidth - margin, y)
      y += 6
    }
  })

  const fileName = sessions.length === 1
    ? `Evaluation_${fmtDate(sessions[0].event_date).replace(/\//g, '-')}_${(sessions[0].title || 'session').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    : `Evaluation_Report_${sessions.length}_sessions.pdf`
  doc.save(fileName)
}

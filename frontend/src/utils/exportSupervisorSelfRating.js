import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { SELF_RATING_INFO, COMPETENCIES } from '../config/supervisorSelfRating'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'
const COMP_COLORS = [NAVY, TEAL, '#D97706', '#059669']
const MAX_SCORES = { 1: 15, 2: 9, 3: 21, 4: 15 }

/**
 * Export Supervisor Self-Rating as PDF
 */
export function exportSelfRatingPdf(rating, responses) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // Title
  doc.setFillColor(14, 31, 86)
  doc.rect(margin, y, pageW - margin * 2, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('STS Supervisor Competencies Self-Rating — Personal Report', pageW / 2, y + 8, { align: 'center' })
  y += 18

  // Date & privacy
  doc.setTextColor(14, 31, 86)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (rating.completed_at) {
    doc.text(`Completed: ${new Date(rating.completed_at).toLocaleDateString()}`, margin, y)
    y += 5
  }
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('This report is for your personal use only. Your results are private.', margin, y)
  y += 8

  // Overall Score
  const pct = Math.round((rating.total_score / 60) * 100)
  doc.setFillColor(0, 167, 157)
  doc.rect(margin, y, pageW - margin * 2, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`Overall Score: ${rating.total_score} / 60 (${pct}%)`, pageW / 2, y + 7, { align: 'center' })
  y += 16

  // Competency Score Bars
  doc.setFontSize(9)
  COMPETENCIES.forEach((comp, idx) => {
    const score = rating[`competency_${comp.number}_score`] || 0
    const max = MAX_SCORES[comp.number]
    const compPct = Math.round((score / max) * 100)
    const barWidth = pageW - margin * 2 - 60

    doc.setTextColor(14, 31, 86)
    doc.setFont('helvetica', 'bold')
    doc.text(`C${comp.number}: ${comp.shortTitle}`, margin, y)

    // Bar background
    doc.setFillColor(229, 231, 235)
    doc.rect(margin + 60, y - 3, barWidth, 5, 'F')

    // Bar fill
    const [r, g, b] = hexToRgb(COMP_COLORS[idx])
    doc.setFillColor(r, g, b)
    doc.rect(margin + 60, y - 3, barWidth * (compPct / 100), 5, 'F')

    doc.setFont('helvetica', 'normal')
    doc.text(`${score}/${max} (${compPct}%)`, margin + 60 + barWidth + 2, y)
    y += 8
  })
  y += 4

  // Detailed results per competency
  COMPETENCIES.forEach((comp, idx) => {
    if (y > 240) { doc.addPage(); y = margin }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(14, 31, 86)
    doc.text(`Competency ${comp.number}: ${comp.shortTitle}`, margin, y)
    y += 5

    const rows = comp.items.filter(i => i.type === 'rated').map(item => {
      const resp = responses[item.key]
      const r = resp?.rating
      const label = r === 3 ? 'Confident' : r === 2 ? 'Needs training' : r === 1 ? 'Growth area' : '—'
      return [
        item.text.substring(0, 80) + (item.text.length > 80 ? '...' : ''),
        label,
        (resp?.reflection_notes || '').substring(0, 40)
      ]
    })

    doc.autoTable({
      startY: y,
      head: [['Item', 'Rating', 'Notes']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: hexToRgb(COMP_COLORS[idx]) },
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 40 }
      }
    })
    y = doc.lastAutoTable.finalY + 6
  })

  // Growth opportunities
  const growthItems = COMPETENCIES.flatMap(c =>
    c.items.filter(i => i.type === 'rated' && responses[i.key]?.rating === 1)
      .map(i => ({ comp: c.shortTitle, text: i.text }))
  )

  if (growthItems.length > 0) {
    if (y > 240) { doc.addPage(); y = margin }
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(14, 31, 86)
    doc.text('Growth Opportunities', margin, y)
    y += 5

    doc.autoTable({
      startY: y,
      head: [['Competency', 'Item']],
      body: growthItems.map(g => [g.comp, g.text.substring(0, 90)]),
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38] },
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 }
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // Footer
  if (y > 260) { doc.addPage(); y = margin }
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  doc.text(`Source: ${SELF_RATING_INFO.source}. Adapted by ${SELF_RATING_INFO.adaptedBy}.`, margin, y)
  y += 4
  doc.text('This report is confidential and for personal use only.', margin, y)

  doc.save(`STS_Self-Rating_${new Date().toISOString().slice(0, 10)}.pdf`)
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0]
}

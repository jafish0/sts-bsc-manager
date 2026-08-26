import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
// Explicit .js extension so this module also loads directly in node (the QA
// harness runs it there); Vite resolves it identically.
import { flagEvaluations } from './evaluationFlags.js'

// CTAC house-format Session Evaluation Report.
//
// Ground truth: Training Manager/CTAC_Report_Style_Guide.md (authoritative)
// and Training Manager/ctac_reports.py (_styles / _ratings_table / _nps_strip
// / _comments_table / build_eval_pdf) — the ReportLab code that produced the
// target PDF ("Evaluation Report - Trauma-Informed Practices for Educators
// (3 hour version).pdf"). Sizes below are its exact values in pt.
//
// Fonts: the house PDF embeds Zilla Slab + Fira Sans. DELIBERATELY not
// embedded here — that would base64 four-plus TTFs (several hundred KB) into
// a public-facing bundle. Helvetica stands in; the type SCALE, weights and
// colors follow the spec. ctac_reports.py itself falls back to Helvetica when
// the TTFs are absent, so this matches its own degraded mode.

// ---- brand tokens (ctac_reports.py lines 26-39) ----
const NAVY = [14, 31, 86]        // #0E1F56
const TEAL = [0, 167, 157]       // #00A79D
const ZEBRA = [244, 241, 234]    // #F4F1EA
const HAIRLINE = [227, 221, 209] // #E3DDD1
const INK = [42, 45, 52]         // #2A2D34
const GREY = [107, 114, 128]     // #6B7280
const NAVY_SOFT = [234, 237, 245] // #EAEDF5
const TEAL_SOFT = [225, 244, 242] // #E1F4F2
const PALE_BLUE = [198, 207, 232] // #C6CFE8
const WHITE = [255, 255, 255]

const ORG_LINE = 'Center on Trauma and Children · University of Kentucky'
const FOOTER_LINE = 'CTAC · 3470 Blazer Parkway, Suite 100, Lexington, KY 40509 · (859) 218-6901'

// ---- geometry (US Letter, pt; MARGIN = 0.8in) ----
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 57.6
const CONTENT_W = PAGE_W - 2 * MARGIN
const BAND_H = 97.2                    // 1.35in navy cover band
const COVER_TOP = BAND_H + 7 + 25.2    // content start on page 1 (band + teal rule + 0.35in)
const BODY_TOP = MARGIN + 21.6         // content start on pages 2+ (clears running header)
const BOTTOM_LIMIT = PAGE_H - 70.6     // ReportLab bottomMargin = MARGIN + 0.18in

// The six rating rows — SHORT display labels (style guide §4), mapping to the
// same DB columns. The full survey wording lives on the form, not the report.
const LIKERT_FIELDS = [
  { key: 'trainer_effective', label: 'Trainer was effective' },
  { key: 'content_objective_alignment', label: 'High consistency between content and objectives' },
  { key: 'applicable_to_work', label: 'Will incorporate knowledge & skills into daily work' },
  { key: 'practical_knowledge', label: 'Satisfied with practical knowledge & skills presented' },
  { key: 'methods_appropriate_audience', label: 'Teaching methods appropriate for intended audience' },
  { key: 'methods_appropriate_subject', label: 'Teaching methods appropriate for subject matter' },
]

const COMMENT_QUESTIONS = [
  { key: 'most_helpful', question: 'What part of the training was the most helpful?' },
  { key: 'improvements', question: 'What are changes you would make to improve this training?' },
  { key: 'additional_comments', question: 'Additional Comments' },
]

const ANOM_FOOTNOTE = '* A minimum of 0.00 reflects a single anomalous/blank entry on a 1–5 scale; group means remain high.'

function fmt2(x) { return x.toFixed(2) }

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`
}

// Min/Max/Mean/n over non-blank responses; flags anomalous 0 entries
// (mirrors ctac_reports.rating_stats — a 0 on a 1–5 scale is a skipped entry:
// keep it in n and the mean, footnote the Min).
function ratingStats(values) {
  const vals = values.filter(v => v !== null && v !== undefined && !Number.isNaN(v))
  if (vals.length === 0) return null
  return {
    n: vals.length,
    min: Math.min(...vals),
    max: Math.max(...vals),
    mean: vals.reduce((a, b) => a + b, 0) / vals.length,
    anomalousZero: vals.some(v => v === 0),
  }
}

// NPS from raw 0–10 scores; Promoter 9–10, Passive 7–8, Detractor 0–6.
// Passives excluded from the score, shown in the breakdown. n counts non-null
// scores only (mirrors ctac_reports.nps_stats).
function npsStats(scores) {
  const vals = scores.filter(v => v !== null && v !== undefined && !Number.isNaN(v))
  if (vals.length === 0) return null
  const promoters = vals.filter(v => v >= 9).length
  const passives = vals.filter(v => v >= 7 && v <= 8).length
  const detractors = vals.filter(v => v <= 6).length
  const n = vals.length
  const avg = Math.round((vals.reduce((a, b) => a + b, 0) / n) * 10) / 10
  return {
    n,
    avg,
    min: Math.min(...vals),
    max: Math.max(...vals),
    promoters,
    passives,
    detractors,
    nps: Math.round((100 * (promoters - detractors)) / n),
  }
}

/**
 * Render the CTAC house-format evaluation report.
 *
 * sessions: Array<{
 *   event_date: string (YYYY-MM-DD),
 *   title: string,
 *   evaluations: Array<session_evaluations row>
 * }>
 */
export function exportEvaluationReportPdf(sessions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const multi = sessions.length > 1
  const trainingName = multi ? 'Training Evaluations' : (sessions[0]?.title || 'Training')
  let y = COVER_TOP

  const setStyle = (style, size, color) => {
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(...color)
  }

  // Start a new content page (furniture is drawn afterwards in one pass).
  const newPage = () => { doc.addPage(); y = BODY_TOP }
  const ensure = (needed) => { if (y + needed > BOTTOM_LIMIT) newPage() }

  const hairlineUnderCells = (data) => {
    doc.setDrawColor(...HAIRLINE)
    doc.setLineWidth(0.5)
    doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height)
  }

  // Shared autoTable defaults: body-frame margins so page splits respect the
  // running header + footer.
  const tableMargin = { left: MARGIN, right: MARGIN, top: BODY_TOP, bottom: PAGE_H - BOTTOM_LIMIT }

  // ---- title block (page 1, under the cover band) ----
  setStyle('bold', 17, NAVY)
  doc.text('Session Evaluation Report', MARGIN, y)
  y += 21
  setStyle('bold', 12.5, NAVY)
  doc.text(doc.splitTextToSize(trainingName, CONTENT_W), MARGIN, y)
  y += 17 * doc.splitTextToSize(trainingName, CONTENT_W).length - 4
  // Teal rule, 1.2pt
  doc.setDrawColor(...TEAL).setLineWidth(1.2)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 14

  // ---- Contents table (multi-session only) ----
  if (multi) {
    setStyle('bold', 13.5, NAVY)
    doc.text('Contents', MARGIN, y)
    y += 8
    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      theme: 'plain',
      head: [['Session', 'Date', 'Responses']],
      body: sessions.map(sess => [
        sess.title || '',
        fmtDate(sess.event_date),
        String((sess.evaluations || []).length),
      ]),
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 9.5, cellPadding: 4 },
      bodyStyles: { fontSize: 9.5, textColor: INK, cellPadding: 4 },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles: {
        0: { cellWidth: CONTENT_W - 172.8 },
        1: { cellWidth: 100.8, halign: 'center' },
        2: { cellWidth: 72, halign: 'center' },
      },
      didDrawCell: hairlineUnderCells,
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // ---- per session ----
  sessions.forEach((session, idx) => {
    // "Numbered in submission order": the callers' queries carry no ORDER BY,
    // so sort here by submitted_at (rows without one keep their relative
    // position at the end). This IS the requested order, not a reorder.
    const evals = (session.evaluations || []).slice().sort((a, b) => {
      if (!a.submitted_at && !b.submitted_at) return 0
      if (!a.submitted_at) return 1
      if (!b.submitted_at) return -1
      return a.submitted_at.localeCompare(b.submitted_at)
    })

    // Each session starts on its own page; a single-session report continues
    // on the cover page after the title block (matches build_eval_pdf).
    if (multi || idx > 0) newPage()

    setStyle('bold', 17, NAVY)
    doc.text(multi ? `Session ${idx + 1}` : 'Session Results', MARGIN, y)
    y += 21
    // Real event title as the h2 — never the date again (the sample PDF's
    // doubled date was an artifact of the Python having no title to pass).
    setStyle('bold', 13.5, NAVY)
    const titleLines = doc.splitTextToSize(session.title || '', CONTENT_W)
    doc.text(titleLines, MARGIN, y)
    y += 17 * titleLines.length - 2
    setStyle('normal', 9.5, GREY)
    doc.text(`${fmtDate(session.event_date)}  ·  ${evals.length} response${evals.length === 1 ? '' : 's'}`, MARGIN, y)
    y += 18

    // -- Quantitative Ratings --
    const statsRows = LIKERT_FIELDS
      .map(f => ({ label: f.label, st: ratingStats(evals.map(e => e[f.key])) }))
      .filter(r => r.st)

    if (statsRows.length > 0) {
      ensure(120)
      setStyle('bold', 13.5, NAVY)
      doc.text('Quantitative Ratings', MARGIN, y)
      y += 8
      let anyAnom = false
      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        theme: 'plain',
        head: [['Evaluation item', 'Min', 'Max', 'Mean', 'n']],
        body: statsRows.map(({ label, st }) => {
          let minTxt = fmt2(st.min)
          if (st.anomalousZero && st.min === 0) { minTxt += '*'; anyAnom = true }
          return [label, minTxt, fmt2(st.max), fmt2(st.mean), String(st.n)]
        }),
        headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 9.5, cellPadding: 4 },
        bodyStyles: { fontSize: 9.5, textColor: INK, cellPadding: 4, valign: 'middle' },
        alternateRowStyles: { fillColor: ZEBRA },
        columnStyles: {
          0: { cellWidth: CONTENT_W - 172.8 },
          1: { cellWidth: 43.2, halign: 'center' },
          2: { cellWidth: 43.2, halign: 'center' },
          3: { cellWidth: 43.2, halign: 'center', fontStyle: 'bold', textColor: NAVY },
          4: { cellWidth: 43.2, halign: 'center' },
        },
        didDrawCell: hairlineUnderCells,
      })
      y = doc.lastAutoTable.finalY + 10
      setStyle('normal', 8, GREY)
      doc.text('Scale: 1–5. n = non-blank responses per item.', MARGIN, y)
      y += 11
      if (anyAnom) {
        doc.text(doc.splitTextToSize(ANOM_FOOTNOTE, CONTENT_W), MARGIN, y)
        y += 11
      }
      // Consistency-check footnote — same rules as the admin view
      // (utils/evaluationFlags.js): purely numeric, nothing excluded.
      const flagged = flagEvaluations(evals, { minSeverity: 'high' })
      if (flagged.length > 0) {
        const note = `† ${flagged.length} response${flagged.length === 1 ? '' : 's'} in this session ${flagged.length === 1 ? 'is' : 'are'} flagged by a consistency check (ratings contradict the recommend score); all responses remain included in every figure above.`
        const noteLines = doc.splitTextToSize(note, CONTENT_W)
        doc.text(noteLines, MARGIN, y)
        y += 11 * noteLines.length
      }
      y += 6
    }

    // -- Likelihood to Recommend (only when collected) --
    const nps = npsStats(evals.map(e => e.recommend_score))
    if (nps) {
      ensure(110)
      setStyle('bold', 13.5, NAVY)
      doc.text('Likelihood to Recommend', MARGIN, y)
      y += 10
      y = drawNpsStrip(doc, y, nps)
      y += 8
      setStyle('normal', 8, GREY)
      const npsFoot = `"How likely are you to recommend this course to a friend or colleague?" (0–10). n = ${nps.n}; raw range ${nps.min}–${nps.max}. NPS = % Promoters - % Detractors.`
      const footLines = doc.splitTextToSize(npsFoot, CONTENT_W)
      doc.text(footLines, MARGIN, y)
      y += 11 * footLines.length + 6
    }

    // -- Open-Response Comments (verbatim, numbered, by question) --
    let anyComments = false
    COMMENT_QUESTIONS.forEach(({ key, question }) => {
      // Verbatim, no exceptions: no trimming for DISPLAY — only the non-empty
      // filter below, which matches the house builder's `v.strip()` presence
      // check while the rendered text stays exactly as submitted.
      const responses = evals
        .map(e => e[key])
        .filter(v => v != null && String(v).trim().length > 0)
        .map(v => String(v))
      if (responses.length === 0) return

      if (!anyComments) {
        ensure(70)
        setStyle('bold', 13.5, NAVY)
        doc.text('Open-Response Comments', MARGIN, y)
        y += 16
        setStyle('normal', 9.5, GREY)
        doc.text('Responses are transcribed verbatim and numbered in submission order.', MARGIN, y)
        y += 18
        anyComments = true
      }

      ensure(60)
      setStyle('bold', 10, NAVY)
      const qLines = doc.splitTextToSize(question, CONTENT_W)
      doc.text(qLines, MARGIN, y)
      y += 14.5 * qLines.length - 2
      setStyle('normal', 9.5, GREY)
      doc.text(`${responses.length} response${responses.length === 1 ? '' : 's'}`, MARGIN, y)
      y += 8

      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        theme: 'plain',
        body: responses.map((text, i) => [String(i + 1), text]),
        bodyStyles: { fontSize: 9.5, textColor: INK, cellPadding: 4, valign: 'top' },
        alternateRowStyles: { fillColor: ZEBRA },
        columnStyles: {
          0: { cellWidth: 32.4, halign: 'center' },
          1: { cellWidth: CONTENT_W - 32.4 },
        },
        didDrawCell: hairlineUnderCells,
      })
      y = doc.lastAutoTable.finalY + 14
    })
  })

  drawPageFurniture(doc, trainingName)

  const safeName = (s) => String(s || 'Training').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const fileName = multi
    ? `Evaluation_Report_${sessions.length}_sessions.pdf`
    : `${safeName(sessions[0]?.title)}_Evaluation_Report.pdf`
  doc.save(fileName)
}

// 5-cell stat strip: Avg · NPS (the one teal-soft cell) · Promoters ·
// Passives · Detractors. Big number over small grey caption; 2pt white gaps
// between cells (mirrors _nps_strip). Returns the y below the strip.
function drawNpsStrip(doc, y, nps) {
  const cells = [
    { num: String(nps.avg), cap: 'Avg score (of 10)', teal: false },
    { num: (nps.nps >= 0 ? '+' : '') + nps.nps, cap: 'Net Promoter Score', teal: true },
    { num: String(nps.promoters), cap: 'Promoters (9–10)', teal: false },
    { num: String(nps.passives), cap: 'Passives (7–8)', teal: false },
    { num: String(nps.detractors), cap: 'Detractors (0–6)', teal: false },
  ]
  const cellW = CONTENT_W / 5
  const stripH = 62
  cells.forEach((cell, i) => {
    const x = MARGIN + i * cellW
    doc.setFillColor(...(cell.teal ? TEAL_SOFT : NAVY_SOFT))
    // 2pt white gap after every cell but the last
    doc.rect(x, y, i < 4 ? cellW - 2 : cellW, stripH, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...(cell.teal ? TEAL : NAVY))
    doc.text(cell.num, x + cellW / 2, y + 30, { align: 'center' })
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY)
    const capLines = doc.splitTextToSize(cell.cap, cellW - 8)
    doc.text(capLines, x + cellW / 2, y + 45, { align: 'center' })
  })
  return y + stripH
}

// Page furniture is drawn AFTER all content exists (jsPDF has no page
// templates): loop the real pages so "Page N" is right and nothing lands on a
// page that never materialized. autoTable's didDrawPage would only fire on
// table pages — the loop covers every page.
function drawPageFurniture(doc, trainingName) {
  const total = doc.getNumberOfPages()
  const prepared = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  for (let i = 1; i <= total; i++) {
    doc.setPage(i)

    if (i === 1) {
      // Cover header: full-width navy band with a 7pt teal rule along its
      // bottom edge; CTAC wordmark + teal square; org line; right-aligned
      // doc type + Prepared date.
      doc.setFillColor(...NAVY)
      doc.rect(0, 0, PAGE_W, BAND_H, 'F')
      doc.setFillColor(...TEAL)
      doc.rect(0, BAND_H, PAGE_W, 7, 'F')

      doc.setFont('helvetica', 'bold').setFontSize(30).setTextColor(...WHITE)
      doc.text('CTAC', MARGIN, 44.6)
      const w = doc.getTextWidth('CTAC')
      doc.setFillColor(...TEAL)
      doc.rect(MARGIN + w + 7, 44.6 - 9, 9, 9, 'F')
      doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...PALE_BLUE)
      doc.text(ORG_LINE, MARGIN, 63.4)

      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...WHITE)
      doc.text('EVALUATION REPORT', PAGE_W - MARGIN, 43.2, { align: 'right', charSpace: 1.2 })
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...PALE_BLUE)
      doc.text(`Prepared ${prepared}`, PAGE_W - MARGIN, 61.9, { align: 'right' })
    } else {
      // Running header: small navy CTAC · <training> — Evaluation Report,
      // hairline rule beneath.
      const hy = MARGIN - 4
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...NAVY)
      doc.text('CTAC', MARGIN, hy)
      const w = doc.getTextWidth('CTAC')
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GREY)
      doc.text(`· ${trainingName} — Evaluation Report`, MARGIN + w + 6, hy)
      doc.setDrawColor(...HAIRLINE).setLineWidth(0.7)
      doc.line(MARGIN, hy + 5, PAGE_W - MARGIN, hy + 5)
    }

    // Footer, every page: hairline rule, address left, page number right.
    const fy = PAGE_H - 61.9
    doc.setDrawColor(...HAIRLINE).setLineWidth(0.7)
    doc.line(MARGIN, fy - 10, PAGE_W - MARGIN, fy - 10)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GREY)
    doc.text(FOOTER_LINE, MARGIN, fy)
    doc.text(`Page ${i}`, PAGE_W - MARGIN, fy, { align: 'right' })
  }
}

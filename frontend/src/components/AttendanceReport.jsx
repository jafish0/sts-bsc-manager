import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

export default function AttendanceReport({ eventId, eventTitle, eventDate, collaborativeName, teamFilter, onClose }) {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAttendance()
  }, [eventId])

  const loadAttendance = async () => {
    try {
      let query = supabase
        .from('session_attendance')
        .select('*, teams(team_name)')
        .eq('bsc_event_id', eventId)
        .order('signed_in_at')

      if (teamFilter) {
        query = query.eq('team_id', teamFilter)
      }

      const { data } = await query
      setAttendance(data || [])
    } catch (err) {
      console.error('Error loading attendance:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalSignedIn = attendance.length
  const totalSignedOut = attendance.filter(a => a.signed_out_at).length
  const totalUnmatched = attendance.filter(a => !a.is_matched).length

  const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
  const formatDuration = (a) => {
    if (!a.signed_in_at || !a.signed_out_at) return '—'
    const mins = Math.round((new Date(a.signed_out_at) - new Date(a.signed_in_at)) / 60000)
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
    const pageW = doc.internal.pageSize.getWidth()
    const m = 12
    let y = m

    doc.setFillColor(14, 31, 86)
    doc.rect(m, y, pageW - m * 2, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Session Attendance Report', pageW / 2, y + 7, { align: 'center' })
    y += 14

    doc.setTextColor(14, 31, 86)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Session: ${eventTitle || ''}`, m, y); y += 4
    doc.text(`Date: ${eventDate || ''}`, m, y); y += 4
    if (collaborativeName) { doc.text(`Collaborative: ${collaborativeName}`, m, y); y += 4 }
    doc.text(`Total: ${totalSignedIn} signed in, ${totalSignedOut} signed out, ${totalUnmatched} unmatched`, m, y)
    y += 6

    doc.autoTable({
      startY: y,
      head: [['Name', 'Email', 'Role', 'Team', 'Sign In', 'Sign Out', 'Duration', 'Matched']],
      body: attendance.map(a => [
        a.attendee_name,
        a.attendee_email,
        a.attendee_role || '—',
        a.teams?.team_name || 'Unmatched',
        formatTime(a.signed_in_at),
        formatTime(a.signed_out_at),
        formatDuration(a),
        a.is_matched ? 'Yes' : 'No'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [0, 167, 157] },
      styles: { fontSize: 7 },
      margin: { left: m, right: m }
    })

    doc.save(`Attendance_${eventTitle || 'Session'}_${eventDate || ''}.pdf`)
  }

  const exportExcel = () => {
    const rows = attendance.map(a => ({
      Name: a.attendee_name,
      Email: a.attendee_email,
      Role: a.attendee_role || '',
      Team: a.teams?.team_name || 'Unmatched',
      'Sign In': a.signed_in_at ? new Date(a.signed_in_at).toLocaleString() : '',
      'Sign Out': a.signed_out_at ? new Date(a.signed_out_at).toLocaleString() : '',
      Duration: formatDuration(a),
      Matched: a.is_matched ? 'Yes' : 'No'
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, `Attendance_${eventTitle || 'Session'}_${eventDate || ''}.xlsx`)
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading attendance...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, color: NAVY, fontSize: '1.1rem' }}>
          Attendance: {eventTitle}
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={exportPdf} style={{ padding: '0.35rem 0.75rem', background: NAVY, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>PDF</button>
          <button onClick={exportExcel} style={{ padding: '0.35rem 0.75rem', background: TEAL, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>Excel</button>
          {onClose && <button onClick={onClose} style={{ padding: '0.35rem 0.75rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem' }}>Close</button>}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#F0FDF4', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
          <strong style={{ color: '#166534' }}>{totalSignedIn}</strong> <span style={{ color: '#6b7280' }}>signed in</span>
        </div>
        <div style={{ background: '#EFF6FF', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
          <strong style={{ color: '#1E40AF' }}>{totalSignedOut}</strong> <span style={{ color: '#6b7280' }}>signed out</span>
        </div>
        {totalUnmatched > 0 && (
          <div style={{ background: '#FEF3C7', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
            <strong style={{ color: '#92400E' }}>{totalUnmatched}</strong> <span style={{ color: '#6b7280' }}>unmatched</span>
          </div>
        )}
      </div>

      {/* Table */}
      {attendance.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>No attendance records found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: NAVY, color: 'white' }}>
                {['Name', 'Email', 'Role', 'Team', 'Sign In', 'Sign Out', 'Duration'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendance.map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? '#f9fafb' : 'white', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.5rem 0.6rem', fontWeight: '500' }}>{a.attendee_name}</td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>{a.attendee_email}</td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>{a.attendee_role || '—'}</td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>
                    {a.teams?.team_name || (
                      <span style={{ color: '#D97706', fontWeight: '600', fontSize: '0.75rem' }}>Unmatched</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>{formatTime(a.signed_in_at)}</td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>{formatTime(a.signed_out_at)}</td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>{formatDuration(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

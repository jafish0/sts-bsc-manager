import { useEffect, useState } from 'react'
import { makeQrDataUrl, downloadDataUrl, safeFilenamePart } from '../utils/downloadQrCode'

// Renders a session URL as a scannable QR + provides a "Download PNG" affordance.
// Props:
//   url:       string  — the URL to encode (e.g. https://bsc.ctac.app/session/abc12345)
//   filename:  string  — the suggested download filename (without extension)
//   title:     string  — modal heading (e.g. "Sign-In QR Code")
//   subtitle:  string? — optional secondary line shown above the QR (e.g. event title + date)
//   onClose:   () => void
export default function QrCodeModal({ url, filename, title, subtitle, onClose }) {
  const [dataUrl, setDataUrl] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    makeQrDataUrl(url)
      .then((d) => { if (!cancelled) setDataUrl(d) })
      .catch((e) => { if (!cancelled) setError(e.message || String(e)) })
    return () => { cancelled = true }
  }, [url])

  const handleDownload = () => {
    if (!dataUrl) return
    downloadDataUrl(dataUrl, `${safeFilenamePart(filename)}.png`)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card, white)', borderRadius: '0.75rem',
          padding: '1.5rem', maxWidth: '420px', width: '100%',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, color: '#0E1F56', fontSize: '1.05rem' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6b7280' }}
            aria-label="Close"
          >×</button>
        </div>

        {subtitle && (
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>{subtitle}</div>
        )}

        <div style={{
          background: '#f9fafb', borderRadius: '0.5rem', padding: '1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '320px',
        }}>
          {error ? (
            <div style={{ color: '#991b1b', fontSize: '0.85rem' }}>QR generation failed: {error}</div>
          ) : !dataUrl ? (
            <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>Generating…</div>
          ) : (
            <img src={dataUrl} alt="QR code" style={{ width: '100%', maxWidth: '320px', height: 'auto' }} />
          )}
        </div>

        <div style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
          fontSize: '0.72rem', color: '#374151', marginTop: '0.5rem',
          wordBreak: 'break-all', textAlign: 'center',
        }}>
          {url}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', color: '#374151',
              border: '1px solid #d1d5db', padding: '0.45rem 0.9rem',
              borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem',
            }}
          >Close</button>
          <button
            onClick={handleDownload}
            disabled={!dataUrl}
            style={{
              background: '#00A79D', color: 'white', border: 'none',
              padding: '0.45rem 1rem', borderRadius: '6px',
              cursor: dataUrl ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: 600,
              opacity: dataUrl ? 1 : 0.6,
            }}
          >Download PNG</button>
        </div>
      </div>
    </div>
  )
}

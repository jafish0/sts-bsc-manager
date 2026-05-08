import QRCode from 'qrcode'

// Render a URL as a PNG data URL suitable for inline display and download.
// 512px is large enough to project on a screen and still scan from across a room.
export async function makeQrDataUrl(url) {
  return QRCode.toDataURL(url, {
    width: 512,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}

// Trigger a browser file download for any data URL.
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// Sanitize a string into a safe filename fragment.
export function safeFilenamePart(s) {
  return String(s || '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'session'
}

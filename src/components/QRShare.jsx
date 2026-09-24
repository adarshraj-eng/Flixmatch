import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function QRShare({ sessionUrl, partnerJoined }) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(sessionUrl, {
      width: 260,
      margin: 2,
      color: { dark: '#FFFFFF', light: '#12121C' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl)
  }, [sessionUrl])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(sessionUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: show the URL
    }
  }

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my FlickMatch session',
          text: 'Pick a movie with me tonight',
          url: sessionUrl,
        })
        return
      } catch {
        // user cancelled or not supported — fall through
      }
    }
    copyLink()
  }

  const shareQRImage = async () => {
    if (!qrDataUrl) return
    try {
      const blob = await (await fetch(qrDataUrl)).blob()
      const file = new File([blob], 'flickmatch-invite.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Join my FlickMatch session' })
        return
      }
    } catch {}
    // Fallback: download the QR image
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = 'flickmatch-invite.png'
    a.click()
  }

  if (partnerJoined) {
    return (
      <div className="qr-joined">
        <div className="joined-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
        </div>
        <p className="joined-text">Your partner has joined!</p>
        <p className="text-muted">Fill in your preferences independently.</p>
      </div>
    )
  }

  return (
    <div className="qr-share">
      <p className="qr-label">Share with your partner</p>

      {qrDataUrl && (
        <div className="qr-code-wrap">
          <img src={qrDataUrl} alt="Session QR code" className="qr-code-img" />
        </div>
      )}

      <p className="qr-url">{sessionUrl}</p>

      <div className="qr-actions">
        <button className="btn btn-secondary" onClick={copyLink}>
          {copied ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
              Copy Link
            </>
          )}
        </button>

        <button className="btn btn-secondary" onClick={shareLink}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>
          Share Link
        </button>

        <button className="btn btn-ghost" onClick={shareQRImage}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3M17 17h3M14 20h3" /></svg>
          Share QR
        </button>
      </div>

      <div className="qr-waiting">
        <div className="waiting-dots">
          <span /><span /><span />
        </div>
        <p>Waiting for your partner to join...</p>
      </div>
    </div>
  )
}

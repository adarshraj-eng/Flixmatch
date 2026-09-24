import { useEffect, useRef } from 'react'
import OTTPlatformBadge from './OTTPlatformBadge'

// Simple canvas confetti
function Confetti() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#FF6B6B', '#7C6FFF', '#FFD93D', '#6BCB77', '#4D96FF']
    const pieces = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 10 + 4,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * 3 + 1.5,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
      drift: (Math.random() - 0.5) * 1.5,
    }))

    let frame
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pieces.forEach(p => {
        p.y += p.speed
        p.x += p.drift
        p.rotation += p.rotSpeed
        if (p.y > canvas.height) {
          p.y = -20
          p.x = Math.random() * canvas.width
        }
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.globalAlpha = 0.85
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      })
      frame = requestAnimationFrame(animate)
    }

    animate()
    const timeout = setTimeout(() => cancelAnimationFrame(frame), 5000)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timeout)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}

export default function MatchReveal({ title, platforms, onRate, onPlayAgain }) {
  return (
    <div className="match-reveal">
      <Confetti />
      <div className="match-content">
        <div className="match-label">
          <span>It&rsquo;s a Match</span>
        </div>

        <div className="match-poster-wrap">
          {title.posterUrl ? (
            <img src={title.posterUrl} alt={title.title} className="match-poster" />
          ) : (
            <div className="match-poster-placeholder">No poster</div>
          )}
        </div>

        <div className="match-details">
          <h1 className="match-title">{title.title}</h1>
          {title.tagline && <p className="match-tagline">&ldquo;{title.tagline}&rdquo;</p>}

          <div className="match-meta">
            <span>&#9733; {title.rating}</span>
            {title.year !== 'N/A' && <span>{title.year}</span>}
            {title.runtime && <span>{title.runtime}</span>}
            {title.mediaType === 'tv' && title.seasons && (
              <span>{title.seasons} season{title.seasons !== 1 ? 's' : ''}</span>
            )}
          </div>

          {title.genres?.length > 0 && (
            <div className="match-genres">
              {title.genres.map(g => (
                <span key={g} className="genre-chip">{g}</span>
              ))}
            </div>
          )}

          <p className="match-synopsis">{title.synopsis}</p>
        </div>

        {platforms?.length > 0 ? (
          <div className="match-platforms">
            <p className="platforms-label">Watch it on</p>
            <div className="platforms-list">
              {platforms.map(p => (
                <OTTPlatformBadge key={p.key} platform={p} />
              ))}
            </div>
          </div>
        ) : (
          <div className="match-platforms">
            <p className="platforms-label text-muted">Checking streaming availability...</p>
          </div>
        )}

        <div className="match-actions">
          <div className="rate-section">
            <p>Rate it after watching</p>
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} className="star-btn" onClick={() => onRate(n)} aria-label={`Rate ${n} stars`}>
                  &#9733;
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-ghost" onClick={onPlayAgain}>
            Start New Session
          </button>
        </div>
      </div>
    </div>
  )
}

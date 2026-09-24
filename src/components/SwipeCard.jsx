import { useRef, useState, useCallback } from 'react'

const SWIPE_THRESHOLD = 100
const ROTATION_FACTOR = 0.06

export default function SwipeCard({ title, onSwipe, stackIndex }) {
  const isTop = stackIndex === 0

  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isFlying, setIsFlying] = useState(false)

  const dragStart = useRef(null)
  const lastPos = useRef({ x: 0, time: 0 })
  const velocity = useRef(0)

  const triggerSwipe = useCallback(
    (direction) => {
      if (isFlying) return
      setIsFlying(true)
      const targetX = direction === 'right' ? window.innerWidth * 1.6 : -window.innerWidth * 1.6
      setOffset({ x: targetX, y: -40 })
      setTimeout(() => onSwipe(direction, title.id), 320)
    },
    [isFlying, onSwipe, title.id]
  )

  const handlePointerDown = useCallback(
    (e) => {
      if (!isTop || isFlying) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragStart.current = { x: e.clientX, y: e.clientY }
      lastPos.current = { x: e.clientX, time: Date.now() }
      velocity.current = 0
      setIsDragging(true)
    },
    [isTop, isFlying]
  )

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDragging || !dragStart.current) return
      const x = e.clientX - dragStart.current.x
      const y = e.clientY - dragStart.current.y
      const now = Date.now()
      const dt = now - lastPos.current.time
      if (dt > 0) velocity.current = (e.clientX - lastPos.current.x) / dt
      lastPos.current = { x: e.clientX, time: now }
      setOffset({ x, y })
    },
    [isDragging]
  )

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    const x = offset.x
    const v = velocity.current
    if (Math.abs(x) > SWIPE_THRESHOLD || Math.abs(v) > 0.5) {
      triggerSwipe(x > 0 || v > 0.5 ? 'right' : 'left')
    } else {
      setOffset({ x: 0, y: 0 })
    }
  }, [isDragging, offset.x, triggerSwipe])

  const rotation = offset.x * ROTATION_FACTOR
  const likeOpacity = Math.min(Math.max(offset.x / 80, 0), 1)
  const passOpacity = Math.min(Math.max(-offset.x / 80, 0), 1)

  // Stack visual: cards behind peek slightly
  const stackScale = isTop ? 1 : 1 - stackIndex * 0.04
  const stackY = isTop ? 0 : stackIndex * 8

  const style = {
    transform: isDragging || isFlying
      ? `translateX(${offset.x}px) translateY(${offset.y}px) rotate(${rotation}deg)`
      : `scale(${stackScale}) translateY(${stackY}px)`,
    transition: isDragging
      ? 'none'
      : isFlying
      ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    zIndex: 10 - stackIndex,
    cursor: isTop ? (isDragging ? 'grabbing' : 'grab') : 'default',
    position: 'absolute',
    inset: 0,
  }

  return (
    <div
      className="swipe-card"
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Directional overlays */}
      <div className="card-overlay like" style={{ opacity: likeOpacity }}>
        <span>LIKE</span>
      </div>
      <div className="card-overlay pass" style={{ opacity: passOpacity }}>
        <span>PASS</span>
      </div>

      {/* Poster */}
      <div className="card-poster-wrap">
        {title.posterUrl ? (
          <img src={title.posterUrl} alt={title.title} className="card-poster" draggable={false} />
        ) : (
          <div className="card-poster-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="2" width="20" height="20" rx="3" />
              <path d="M8 10l4 4 4-4" />
            </svg>
          </div>
        )}
        <div className="card-poster-gradient" />
      </div>

      {/* Info */}
      <div className="card-info">
        <div className="card-meta-row">
          <span className="card-rating">&#9733; {title.rating}</span>
          <span className="card-year">{title.year}</span>
          {title.mediaType === 'tv' && <span className="card-type-badge">Series</span>}
        </div>
        <h2 className="card-title">{title.title}</h2>
        <p className="card-synopsis">{title.synopsis}</p>
      </div>

      {/* Swipe hint arrows (top card only, disappear once dragging) */}
      {isTop && !isDragging && offset.x === 0 && (
        <div className="card-hint">
          <span className="hint-pass">&#8592; pass</span>
          <span className="hint-like">like &#8594;</span>
        </div>
      )}
    </div>
  )
}

import { useState, useCallback } from 'react'
import SwipeCard from './SwipeCard'

export default function SwipeDeck({ titles, onSwipe, currentIndex, partnerStatus }) {
  const [animating, setAnimating] = useState(false)

  const handleSwipe = useCallback(
    async (direction, titleId) => {
      if (animating) return
      setAnimating(true)
      await onSwipe(direction, titleId)
      setAnimating(false)
    },
    [animating, onSwipe]
  )

  const remaining = titles.length - currentIndex
  const visible = titles.slice(currentIndex, currentIndex + 3)
  const total = titles.length

  if (remaining === 0) {
    return (
      <div className="deck-empty">
        <p>You&rsquo;ve seen all titles in this round.</p>
        <p className="text-muted">Waiting for your partner to finish...</p>
      </div>
    )
  }

  return (
    <div className="deck-wrap">
      {/* Partner status */}
      {partnerStatus && (
        <div className="partner-status">
          <div className="partner-dot" />
          <span>{partnerStatus}</span>
        </div>
      )}

      {/* Progress */}
      <div className="deck-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(currentIndex / total) * 100}%` }}
          />
        </div>
        <span className="progress-label">
          {currentIndex} / {total}
        </span>
      </div>

      {/* Card stack */}
      <div className="deck-cards">
        {visible.map((title, i) => (
          <SwipeCard
            key={title.id}
            title={title}
            stackIndex={i}
            onSwipe={i === 0 ? handleSwipe : () => {}}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="deck-actions">
        <button
          className="action-btn action-pass"
          onClick={() => visible[0] && handleSwipe('left', visible[0].id)}
          disabled={animating}
          aria-label="Pass"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <button
          className="action-btn action-like"
          onClick={() => visible[0] && handleSwipe('right', visible[0].id)}
          disabled={animating}
          aria-label="Like"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

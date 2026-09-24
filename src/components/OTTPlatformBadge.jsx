export default function OTTPlatformBadge({ platform }) {
  const { name, color, link } = platform

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="ott-badge"
        style={{ '--platform-color': color }}
      >
        {name}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    )
  }

  return (
    <span className="ott-badge" style={{ '--platform-color': color }}>
      {name}
    </span>
  )
}

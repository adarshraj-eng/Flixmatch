// Calls to the Express backend (proxied by Vite in dev, same origin in prod)

export async function generateBrief(prefA, prefB) {
  const res = await fetch('/api/generate-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefA, prefB }),
  })
  if (!res.ok) throw new Error('Failed to generate brief')
  return res.json()
}

export async function generateRecommendations(prefA, prefB, likesA, likesB) {
  const res = await fetch('/api/generate-recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefA, prefB, likesA, likesB }),
  })
  if (!res.ok) throw new Error('Failed to generate recommendations')
  return res.json()
}

export async function checkOTT(title, mediaType = 'movie') {
  try {
    const res = await fetch(
      `/api/ott?title=${encodeURIComponent(title)}&type=${mediaType}`
    )
    if (!res.ok) return { platforms: [] }
    return res.json()
  } catch {
    return { platforms: [] }
  }
}

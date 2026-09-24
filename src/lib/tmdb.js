const BASE = 'https://api.themoviedb.org/3'
export const IMG_BASE = 'https://image.tmdb.org/t/p/w500'
export const IMG_BASE_ORIGINAL = 'https://image.tmdb.org/t/p/original'

const TOKEN = import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
}

async function get(endpoint, params = {}) {
  const url = new URL(`${BASE}${endpoint}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  const res = await fetch(url.toString(), { headers })
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${endpoint}`)
  return res.json()
}

// ── Language codes ─────────────────────────────────────────────────────
export const LANG_CODE = {
  Hindi: 'hi',
  English: 'en',
  Tamil: 'ta',
  Telugu: 'te',
  Kannada: 'kn',
}

// ── Normalize a TMDB result into a flat title object ──────────────────
function normalizeTitle(r, mediaType) {
  const releaseDate = r.release_date || r.first_air_date || ''
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null
  return {
    id: `${mediaType}-${r.id}`,
    tmdbId: r.id,
    mediaType,
    title: r.title || r.name || 'Unknown',
    year: year || 'N/A',
    rating: r.vote_average ? r.vote_average.toFixed(1) : 'N/A',
    synopsis: r.overview
      ? r.overview.length > 160
        ? r.overview.slice(0, 157) + '...'
        : r.overview
      : 'No description available.',
    posterUrl: r.poster_path ? `${IMG_BASE}${r.poster_path}` : null,
    genreIds: r.genre_ids || [],
    popularity: r.popularity || 0,
  }
}

// ── Discover titles with a Claude-generated brief ─────────────────────
export async function discoverTitles({ brief, language, mediaType = 'movie', page = 1 }) {
  const params = {
    page,
    sort_by: 'popularity.desc',
    'vote_average.gte': brief.min_rating || 6,
    'vote_count.gte': 150,
    include_adult: false,
  }

  if (brief.primary_genres?.length) {
    params.with_genres = brief.primary_genres.join('|')
  }

  if (language) {
    params.with_original_language = language
  }

  if (brief.year_from) {
    const dateKey = mediaType === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte'
    params[dateKey] = `${brief.year_from}-01-01`
  }
  if (brief.year_to) {
    const dateKey = mediaType === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'
    params[dateKey] = `${brief.year_to}-12-31`
  }

  const data = await get(`/discover/${mediaType}`, params)
  return (data.results || []).map(r => normalizeTitle(r, mediaType))
}

// ── Fetch 30 titles based on brief + merged preferences ───────────────
export async function fetchTitlePool({ brief, mergedPrefs, seenIds = [] }) {
  const languages =
    mergedPrefs.languages.length > 0 ? mergedPrefs.languages.map(l => LANG_CODE[l]).filter(Boolean) : [null]

  const includeTV = mergedPrefs.contentType === 'both'
  const seenSet = new Set(seenIds)

  let allTitles = []

  // Fetch movies for each language
  for (const lang of languages.slice(0, 3)) {
    const page1 = await discoverTitles({ brief, language: lang, mediaType: 'movie', page: 1 })
    const page2 = await discoverTitles({ brief, language: lang, mediaType: 'movie', page: 2 })
    allTitles.push(...page1, ...page2)
  }

  // Fetch TV shows if needed
  if (includeTV) {
    for (const lang of languages.slice(0, 2)) {
      const tvPage = await discoverTitles({ brief, language: lang, mediaType: 'tv', page: 1 })
      allTitles.push(...tvPage)
    }
  }

  // Deduplicate, exclude already-seen, take top 30 by popularity
  const seen = new Set(seenSet)
  const unique = allTitles
    .filter(t => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 30)

  return unique
}

// ── Get full details for a specific title (used on match screen) ───────
export async function getTitleDetails(tmdbId, mediaType) {
  const data = await get(`/${mediaType}/${tmdbId}`)
  const releaseDate = data.release_date || data.first_air_date || ''
  const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A'

  let runtime = null
  if (mediaType === 'movie' && data.runtime) {
    const h = Math.floor(data.runtime / 60)
    const m = data.runtime % 60
    runtime = h > 0 ? `${h}h ${m}m` : `${m}m`
  } else if (mediaType === 'tv' && data.episode_run_time?.[0]) {
    runtime = `${data.episode_run_time[0]} min/ep`
  }

  return {
    id: `${mediaType}-${data.id}`,
    tmdbId: data.id,
    mediaType,
    title: data.title || data.name,
    year,
    rating: data.vote_average?.toFixed(1) || 'N/A',
    runtime,
    synopsis: data.overview || 'No description available.',
    posterUrl: data.poster_path ? `${IMG_BASE_ORIGINAL}${data.poster_path}` : null,
    genres: data.genres?.map(g => g.name) || [],
    tagline: data.tagline || null,
    seasons: data.number_of_seasons || null,
    voteCount: data.vote_count || 0,
  }
}

// ── Shuffle an array (Fisher-Yates) ───────────────────────────────────
export function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

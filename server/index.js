import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

// ── Helper: extract JSON from Gemini response ──────────────────────────
function parseGeminiJson(text) {
  // Strip markdown code fences if present
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found in response')
  return JSON.parse(match[0])
}

// ── Helper: format preferences for prompt ─────────────────────────────
function formatPrefs(label, p) {
  return `${label}:
- Mood: ${p.moods?.join(', ') || 'Any'}
- Mood note: "${p.mood_text || 'none'}"
- Languages: ${p.languages?.join(', ') || 'Any'}
- Content: ${p.content_type === 'both' ? 'Movies and TV shows' : 'Movies only'}
- Min IMDb rating: ${p.min_rating}+
- Era: ${p.eras?.join(', ') || 'Any'}`
}

const GENRE_REF = `TMDB genre IDs: Action(28), Adventure(12), Animation(16), Comedy(35), Crime(80), Drama(18), Family(10751), Fantasy(14), Horror(27), Music(10402), Mystery(9648), Romance(10749), Science Fiction(878), Thriller(53), War(10752).`

// ── POST /api/generate-brief ───────────────────────────────────────────
app.post('/api/generate-brief', async (req, res) => {
  try {
    const { prefA, prefB } = req.body
    if (!prefA || !prefB) return res.status(400).json({ error: 'Missing preferences' })

    const prompt = `You are helping two people find a movie or TV show to watch together tonight.

${formatPrefs('Partner A', prefA)}

${formatPrefs('Partner B', prefB)}

${GENRE_REF}

Analyze both sets of preferences and return a JSON search brief that finds titles BOTH would enjoy. Prioritize overlap. Return ONLY valid JSON with no explanation and no markdown fences:
{
  "primary_genres": [array of up to 5 TMDB genre IDs most likely to satisfy both],
  "avoid_genres": [genre IDs clearly unwanted by either partner],
  "keywords": ["3-5 mood or theme words"],
  "combined_mood": "one sentence describing what would work for both",
  "prefer_languages": ["ISO 639-1 language codes in priority order, e.g. hi, en, ta, te, kn"],
  "min_rating": minimum_rating_as_number,
  "year_from": earliest_year_as_number_or_null,
  "year_to": latest_year_as_number_or_null
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const brief = parseGeminiJson(text)
    res.json({ brief })
  } catch (err) {
    console.error('[generate-brief]', err.message)
    res.json({
      brief: {
        primary_genres: [28, 35, 18, 53, 10749],
        avoid_genres: [],
        keywords: ['popular', 'engaging'],
        combined_mood: 'Something enjoyable for both partners',
        prefer_languages: ['en', 'hi'],
        min_rating: 6,
        year_from: null,
        year_to: null,
      },
    })
  }
})

// ── POST /api/generate-recommendations ────────────────────────────────
app.post('/api/generate-recommendations', async (req, res) => {
  try {
    const { prefA, prefB, likesA, likesB } = req.body

    const likedANames = likesA?.map(t => t.title).join(', ') || 'none'
    const likedBNames = likesB?.map(t => t.title).join(', ') || 'none'

    const prompt = `Two people swiped through 30 movies/shows and found no match. Here's what they each liked:

Partner A liked: ${likedANames}
Partner B liked: ${likedBNames}

Original preferences:
${formatPrefs('Partner A', prefA)}
${formatPrefs('Partner B', prefB)}

${GENRE_REF}

Study the overlap patterns in what they both liked. Generate a NEW search brief more targeted to what they'll BOTH enjoy. Return ONLY valid JSON with no markdown fences:
{
  "primary_genres": [array of up to 5 TMDB genre IDs],
  "avoid_genres": [genre IDs to avoid],
  "keywords": ["3-5 mood or theme words"],
  "combined_mood": "one sentence describing the refined direction",
  "prefer_languages": ["ISO 639-1 codes in priority order"],
  "min_rating": minimum_rating_as_number,
  "year_from": earliest_year_as_number_or_null,
  "year_to": latest_year_as_number_or_null
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const brief = parseGeminiJson(text)
    res.json({ brief })
  } catch (err) {
    console.error('[generate-recommendations]', err.message)
    res.json({
      brief: {
        primary_genres: [28, 35, 18, 53],
        avoid_genres: [],
        keywords: ['crowd-pleasing'],
        combined_mood: 'Something both partners are likely to enjoy',
        prefer_languages: ['en', 'hi'],
        min_rating: 6,
        year_from: null,
        year_to: null,
      },
    })
  }
})

// ── GET /api/ott ───────────────────────────────────────────────────────
const PLATFORM_DISPLAY = {
  netflix: { name: 'Netflix', color: '#E50914' },
  prime: { name: 'Prime Video', color: '#00A8E1' },
  amazon: { name: 'Prime Video', color: '#00A8E1' },
  hotstar: { name: 'Disney+ Hotstar', color: '#1F80E0' },
  disney: { name: 'Disney+ Hotstar', color: '#1F80E0' },
  sonyliv: { name: 'SonyLIV', color: '#0054A6' },
  zee5: { name: 'ZEE5', color: '#713ABE' },
  jiocinema: { name: 'JioCinema', color: '#0052B2' },
  'jio cinema': { name: 'JioCinema', color: '#0052B2' },
  voot: { name: 'Voot', color: '#FF6B00' },
  mubi: { name: 'MUBI', color: '#2D2D2D' },
  eros: { name: 'Eros Now', color: '#E31937' },
  apple: { name: 'Apple TV+', color: '#555555' },
}

app.get('/api/ott', async (req, res) => {
  const { title, type } = req.query
  if (!title) return res.json({ platforms: [] })

  if (!process.env.RAPIDAPI_KEY || process.env.RAPIDAPI_KEY === 'your-rapidapi-key-here') {
    // RapidAPI key not yet configured — return empty gracefully
    return res.json({ platforms: [] })
  }

  try {
    const response = await fetch(
      `https://ott-details.p.rapidapi.com/availsbytitle?title=${encodeURIComponent(title)}&type=${type || 'movie'}`,
      {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'ott-details.p.rapidapi.com',
        },
      }
    )

    const data = await response.json()
    const platforms = []
    const seen = new Set()

    const addPlatform = (platformKey, link) => {
      const key = platformKey.toLowerCase().replace(/\s+/g, '')
      const display = Object.entries(PLATFORM_DISPLAY).find(([k]) =>
        key.includes(k.replace(/\s+/g, ''))
      )
      if (display && !seen.has(display[0])) {
        seen.add(display[0])
        platforms.push({ key: display[0], name: display[1].name, color: display[1].color, link: link || null })
      }
    }

    if (Array.isArray(data)) {
      data.forEach(item => addPlatform(item.streamingType || item.platform || item.service || '', item.link || item.url))
    } else if (data?.streamingInfo) {
      const india = data.streamingInfo?.in || data.streamingInfo?.IN || []
      if (Array.isArray(india)) india.forEach(s => addPlatform(s.platform || s.service || '', s.link || s.url))
    }

    res.json({ platforms })
  } catch (err) {
    console.error('[ott]', err.message)
    res.json({ platforms: [] })
  }
})

// ── Serve React build in production (non-serverless deploys only) ─────
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '../dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  })
}

// On Vercel, api/index.js imports this app as a serverless function
// instead of calling listen().
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`FlickMatch server running on http://localhost:${PORT}`)
  })
}

export default app

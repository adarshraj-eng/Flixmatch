import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateBrief } from '../lib/api'
import { fetchTitlePool, shuffleArray } from '../lib/tmdb'
import LoadingScreen from '../components/LoadingScreen'

const MOODS = ['Light & fun', 'Intense & gripping', 'Scary', 'Romantic', 'Other']
const LANGUAGES = ['Hindi', 'English', 'Tamil', 'Telugu', 'Kannada']
const RATINGS = [6, 7, 8, 9]
const ERAS = ['Classic (pre-2000)', '2000–2020', 'Recent (2021–2026)']

function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      className={`chip ${selected ? 'chip-active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export default function PreferencesPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [partner, setPartner] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('Submitting...')
  const [error, setError] = useState('')

  // Form state
  const [moods, setMoods] = useState([])
  const [moodText, setMoodText] = useState('')
  const [languages, setLanguages] = useState([])
  const [anyLanguage, setAnyLanguage] = useState(false)
  const [contentType, setContentType] = useState('movies')
  const [minRating, setMinRating] = useState(7)
  const [eras, setEras] = useState([])
  const [anyEra, setAnyEra] = useState(true)

  useEffect(() => {
    const role = localStorage.getItem(`flickmatch_role_${sessionId}`)
    if (!role) navigate(`/session/${sessionId}`)
    else setPartner(role)
  }, [sessionId, navigate])

  // Subscribe to session updates for when partner B submits and generation starts
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`prefs-session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        payload => {
          const { status } = payload.new
          if (status === 'generating') setLoadingMsg('Curating your perfect matches...')
          if (status === 'swiping_round_1') navigate(`/session/${sessionId}/swipe`)
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [sessionId, navigate])

  const toggleMood = (mood) => {
    setMoods(prev => prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood])
  }

  const toggleLanguage = (lang) => {
    setAnyLanguage(false)
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang])
  }

  const toggleAnyLanguage = () => {
    setAnyLanguage(true)
    setLanguages([])
  }

  const toggleEra = (era) => {
    setAnyEra(false)
    setEras(prev => prev.includes(era) ? prev.filter(e => e !== era) : [...prev, era])
  }

  const toggleAnyEra = () => {
    setAnyEra(true)
    setEras([])
  }

  const handleSubmit = async () => {
    if (moods.length === 0) return setError('Pick at least one mood.')
    if (!anyLanguage && languages.length === 0) return setError('Pick at least one language, or select Any.')
    setError('')
    setGenerating(true)
    setLoadingMsg('Saving your preferences...')

    try {
      const prefs = {
        moods,
        mood_text: moodText,
        languages: anyLanguage ? ['Any'] : languages,
        content_type: contentType,
        min_rating: minRating,
        eras: anyEra ? ['Any'] : eras,
      }

      // Insert preferences
      const { error: insertErr } = await supabase
        .from('preferences')
        .insert({ session_id: sessionId, partner, ...prefs })
      if (insertErr) throw insertErr

      setSubmitted(true)
      setLoadingMsg('Waiting for your partner...')

      // Check if both partners have submitted
      const { data: allPrefs } = await supabase
        .from('preferences')
        .select('partner')
        .eq('session_id', sessionId)

      if (allPrefs?.length === 2) {
        // Atomically claim title generation responsibility
        const { data: lockData } = await supabase
          .from('sessions')
          .update({ status: 'generating' })
          .eq('id', sessionId)
          .eq('status', 'both_joined')
          .select('id')

        if (lockData?.length > 0) {
          // This client won the race — generate titles
          await runTitleGeneration(sessionId)
        }
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
      setGenerating(false)
    }
  }

  if (generating) {
    return <LoadingScreen message={loadingMsg} />
  }

  return (
    <div className="page page-prefs">
      <header className="page-header">
        <div className="logo">Flick<span>Match</span></div>
        <div className="session-badge">
          <span className="partner-label">Partner {partner}</span>
        </div>
      </header>

      <main className="prefs-main">
        <h2 className="prefs-heading">What are you in the mood for?</h2>
        <p className="text-muted prefs-sub">Your partner fills this out independently — no peeking.</p>

        {/* Mood multi-select */}
        <section className="pref-section">
          <label className="pref-label">Mood</label>
          <div className="chip-group">
            {MOODS.map(m => (
              <Chip key={m} label={m} selected={moods.includes(m)} onClick={() => toggleMood(m)} />
            ))}
          </div>
        </section>

        {/* Free-form mood description */}
        <section className="pref-section">
          <label className="pref-label" htmlFor="mood-text">
            Describe what you&rsquo;re in the mood for <span className="optional">(optional)</span>
          </label>
          <textarea
            id="mood-text"
            className="pref-textarea"
            placeholder="e.g. Something funny but not too silly, or a thriller that keeps me on edge..."
            value={moodText}
            onChange={e => setMoodText(e.target.value)}
            rows={3}
            maxLength={300}
          />
        </section>

        {/* Language */}
        <section className="pref-section">
          <label className="pref-label">Language</label>
          <div className="chip-group">
            {LANGUAGES.map(l => (
              <Chip key={l} label={l} selected={!anyLanguage && languages.includes(l)} onClick={() => toggleLanguage(l)} />
            ))}
            <Chip label="Any" selected={anyLanguage} onClick={toggleAnyLanguage} />
          </div>
        </section>

        {/* Content type */}
        <section className="pref-section">
          <label className="pref-label">Content type</label>
          <div className="radio-group">
            <label className={`radio-option ${contentType === 'movies' ? 'selected' : ''}`}>
              <input type="radio" name="content" value="movies" checked={contentType === 'movies'} onChange={() => setContentType('movies')} />
              Movies only
            </label>
            <label className={`radio-option ${contentType === 'both' ? 'selected' : ''}`}>
              <input type="radio" name="content" value="both" checked={contentType === 'both'} onChange={() => setContentType('both')} />
              Include series
            </label>
          </div>
        </section>

        {/* Minimum rating */}
        <section className="pref-section">
          <label className="pref-label">Minimum IMDb rating</label>
          <div className="radio-group">
            {RATINGS.map(r => (
              <label key={r} className={`radio-option ${minRating === r ? 'selected' : ''}`}>
                <input type="radio" name="rating" value={r} checked={minRating === r} onChange={() => setMinRating(r)} />
                {r}+
                {r === 9 && <span className="rating-caveat"> (very few titles)</span>}
              </label>
            ))}
          </div>
        </section>

        {/* Era */}
        <section className="pref-section">
          <label className="pref-label">Era</label>
          <div className="chip-group">
            <Chip label="Any" selected={anyEra} onClick={toggleAnyEra} />
            {ERAS.map(e => (
              <Chip key={e} label={e} selected={!anyEra && eras.includes(e)} onClick={() => toggleEra(e)} />
            ))}
          </div>
        </section>

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn-primary btn-xl submit-btn" onClick={handleSubmit}>
          Let&rsquo;s Match
        </button>
      </main>
    </div>
  )
}

// ── Title generation (runs on the client that wins the lock) ───────────
async function runTitleGeneration(sessionId) {
  try {
    // Fetch both preference sets
    const { data: prefs } = await supabase
      .from('preferences')
      .select('*')
      .eq('session_id', sessionId)

    const prefA = prefs.find(p => p.partner === 'A')
    const prefB = prefs.find(p => p.partner === 'B')
    if (!prefA || !prefB) throw new Error('Missing preferences')

    // Get Claude's brief
    const { brief } = await generateBrief(prefA, prefB)

    // Merge prefs for TMDB query
    const langA = prefA.languages?.includes('Any') ? [] : prefA.languages
    const langB = prefB.languages?.includes('Any') ? [] : prefB.languages
    const mergedLanguages = [...new Set([...langA, ...langB])]

    const mergedPrefs = {
      languages: mergedLanguages,
      contentType: prefA.content_type === 'both' || prefB.content_type === 'both' ? 'both' : 'movies',
    }

    // Fetch 30 titles
    const titles = await fetchTitlePool({ brief, mergedPrefs })

    // Create two different shuffle orders
    const ids = titles.map(t => t.id)
    const orderA = shuffleArray(ids)
    const orderB = shuffleArray(ids)

    // Store in session and mark as ready
    await supabase
      .from('sessions')
      .update({
        titles,
        titles_order_a: orderA,
        titles_order_b: orderB,
        status: 'swiping_round_1',
      })
      .eq('id', sessionId)
  } catch (err) {
    console.error('Title generation failed:', err)
    // Update session with error status so clients can show a message
    await supabase
      .from('sessions')
      .update({ status: 'swiping_round_1' })
      .eq('id', sessionId)
  }
}

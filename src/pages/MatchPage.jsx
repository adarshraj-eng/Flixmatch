import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTitleDetails } from '../lib/tmdb'
import { checkOTT } from '../lib/api'
import MatchReveal from '../components/MatchReveal'
import LoadingScreen from '../components/LoadingScreen'

export default function MatchPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [matchTitle, setMatchTitle] = useState(null)
  const [topPicks, setTopPicks] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [loading, setLoading] = useState(true)
  const [rated, setRated] = useState(false)

  useEffect(() => {
    const role = localStorage.getItem(`flickmatch_role_${sessionId}`)
    if (!role) navigate(`/session/${sessionId}`)
  }, [sessionId, navigate])

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (!sessionData) return
      setSession(sessionData)

      if (sessionData.status === 'matched' && sessionData.match_title) {
        // Fetch full details from TMDB
        const basic = sessionData.match_title
        try {
          const details = await getTitleDetails(basic.tmdbId, basic.mediaType)
          setMatchTitle(details)
          // Fetch OTT availability
          const { platforms: p } = await checkOTT(details.title, details.mediaType)
          setPlatforms(p)
        } catch {
          setMatchTitle(basic)
        }
      } else if (sessionData.status === 'finished') {
        setTopPicks(sessionData.top_picks || [])
      }

      setLoading(false)
    }
    load()
  }, [sessionId])

  // Subscribe to session updates (in case this page loads before the match is written)
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`match-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        async payload => {
          const s = payload.new
          setSession(s)
          if (s.status === 'matched' && s.match_title && !matchTitle) {
            try {
              const details = await getTitleDetails(s.match_title.tmdbId, s.match_title.mediaType)
              setMatchTitle(details)
              const { platforms: p } = await checkOTT(details.title, details.mediaType)
              setPlatforms(p)
            } catch {
              setMatchTitle(s.match_title)
            }
            setLoading(false)
          }
          if (s.status === 'finished') {
            setTopPicks(s.top_picks || [])
            setLoading(false)
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [sessionId, matchTitle])

  const handleRate = async (rating) => {
    if (rated || !matchTitle) return
    setRated(true)
    await supabase.from('watch_ratings').insert({
      session_id: sessionId,
      title_id: matchTitle.id,
      title_name: matchTitle.title,
      rating,
    })
  }

  const handlePlayAgain = () => navigate('/')

  if (loading) return <LoadingScreen message="Finding your match..." />

  // ── Matched! ────────────────────────────────────────────────────────
  if (session?.status === 'matched' && matchTitle) {
    return (
      <MatchReveal
        title={matchTitle}
        platforms={platforms}
        onRate={handleRate}
        onPlayAgain={handlePlayAgain}
      />
    )
  }

  // ── No match after 2 rounds — show top 5 ────────────────────────────
  if (session?.status === 'finished') {
    return (
      <div className="page page-no-match">
        <header className="page-header">
          <div className="logo">Flick<span>Match</span></div>
        </header>

        <main className="no-match-main">
          <h2 className="no-match-heading">No perfect match — but close!</h2>
          <p className="text-muted">
            Here are the top 5 titles both of you responded to. Pick one together.
          </p>

          <div className="top-picks-list">
            {topPicks.map((title, i) => (
              <div key={title.id} className="top-pick-card">
                <div className="pick-rank">#{i + 1}</div>
                {title.posterUrl && (
                  <img src={title.posterUrl} alt={title.title} className="pick-poster" />
                )}
                <div className="pick-info">
                  <h3 className="pick-title">{title.title}</h3>
                  <div className="pick-meta">
                    <span>&#9733; {title.rating}</span>
                    <span>{title.year}</span>
                  </div>
                  <p className="pick-synopsis">{title.synopsis}</p>
                </div>
              </div>
            ))}
          </div>

          {topPicks.length === 0 && (
            <p className="text-muted">No swipe data found. Try starting a new session.</p>
          )}

          <button className="btn btn-primary" onClick={handlePlayAgain} style={{ marginTop: '2rem' }}>
            Start New Session
          </button>
        </main>
      </div>
    )
  }

  // ── Waiting for session to update ────────────────────────────────────
  return <LoadingScreen message="Waiting for the result..." />
}

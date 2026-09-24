import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const createSession = async () => {
    setCreating(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('sessions')
        .insert({})
        .select('id')
        .single()

      if (err) throw err

      // Mark this device as Partner A for this session
      localStorage.setItem(`flickmatch_role_${data.id}`, 'A')
      navigate(`/session/${data.id}`)
    } catch (err) {
      setError('Could not create a session. Check your connection and try again.')
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="page page-home">
      <header className="home-header">
        <div className="logo">Flick<span>Match</span></div>
      </header>

      <main className="home-main">
        <div className="home-hero">
          <h1>Stop scrolling.<br />Start watching.</h1>
          <p className="home-sub">
            A two-player movie matchmaker. Set your mood, swipe through picks,
            and find something you both actually want to watch — with exactly where to watch it in India.
          </p>
        </div>

        <div className="home-cta">
          {error && <p className="error-text">{error}</p>}
          <button
            className="btn btn-primary btn-xl"
            onClick={createSession}
            disabled={creating}
          >
            {creating ? 'Creating session...' : 'Start a New Session'}
          </button>
          <p className="home-hint">
            You&rsquo;ll get a link and QR code to share with your partner.
          </p>
        </div>

        <div className="home-steps">
          <div className="step">
            <div className="step-num">1</div>
            <div className="step-text">
              <strong>You set your mood</strong>
              <span>Pick languages, genres, eras, and rating preferences.</span>
            </div>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <div className="step-text">
              <strong>Share the invite</strong>
              <span>Your partner joins via QR code or link and sets their preferences independently.</span>
            </div>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <div className="step-text">
              <strong>Swipe together</strong>
              <span>Both of you swipe through 30 curated picks. When you both like the same one — it&rsquo;s a match.</span>
            </div>
          </div>
          <div className="step">
            <div className="step-num">4</div>
            <div className="step-text">
              <strong>Watch it</strong>
              <span>See exactly which Indian OTT platform it&rsquo;s on right now, with a direct link.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import QRShare from '../components/QRShare'
import LoadingScreen from '../components/LoadingScreen'

export default function SessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [partner, setPartner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const sessionUrl = `${window.location.origin}/session/${sessionId}`

  // Determine role and load session on mount
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      // Check if we already have a role for this session
      let role = localStorage.getItem(`flickmatch_role_${sessionId}`)

      if (!role) {
        // New visitor — check if session exists and is still in 'waiting' state
        const { data, error: fetchErr } = await supabase
          .from('sessions')
          .select('id, status')
          .eq('id', sessionId)
          .single()

        if (fetchErr || !data) {
          if (!cancelled) setError('Session not found. The link may be expired or invalid.')
          setLoading(false)
          return
        }

        if (data.status !== 'waiting') {
          // Session already has both partners — cannot join
          if (!cancelled) setError('This session is already full or has ended.')
          setLoading(false)
          return
        }

        // Assign as Partner B and update session status
        role = 'B'
        localStorage.setItem(`flickmatch_role_${sessionId}`, 'B')

        await supabase
          .from('sessions')
          .update({ status: 'both_joined' })
          .eq('id', sessionId)
          .eq('status', 'waiting') // only if still waiting (prevents race)
      }

      if (!cancelled) setPartner(role)

      // Load full session
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (!cancelled) {
        setSession(sessionData)
        setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [sessionId])

  // Redirect when both partners have joined → go to preferences
  useEffect(() => {
    if (!session || !partner) return

    if (session.status === 'both_joined') {
      navigate(`/session/${sessionId}/preferences`)
    } else if (session.status === 'generating' || session.status === 'swiping_round_1' || session.status === 'swiping_round_2') {
      navigate(`/session/${sessionId}/swipe`)
    } else if (session.status === 'matched' || session.status === 'finished') {
      navigate(`/session/${sessionId}/match`)
    }
  }, [session?.status, partner, sessionId, navigate])

  // Subscribe to Realtime session updates
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`session-page-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        payload => setSession(payload.new)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [sessionId])

  if (loading) return <LoadingScreen message="Loading session..." />

  if (error) {
    return (
      <div className="page page-centered">
        <p className="error-text">{error}</p>
        <a href="/" className="btn btn-secondary">Back to Home</a>
      </div>
    )
  }

  const partnerJoined = session?.status !== 'waiting'

  return (
    <div className="page">
      <header className="page-header">
        <div className="logo">Flick<span>Match</span></div>
        <div className="session-badge">
          <span className="partner-label">Partner {partner}</span>
        </div>
      </header>

      <main className="session-main">
        <h2 className="session-heading">
          {partnerJoined ? 'Partner joined!' : 'Invite your partner'}
        </h2>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>
          {partnerJoined
            ? 'Heading to the preference form...'
            : 'Share the QR code or link below. Each of you fills in preferences separately.'}
        </p>

        <QRShare sessionUrl={sessionUrl} partnerJoined={partnerJoined} />
      </main>
    </div>
  )
}

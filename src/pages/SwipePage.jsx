import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateRecommendations } from '../lib/api'
import { fetchTitlePool, shuffleArray } from '../lib/tmdb'
import SwipeDeck from '../components/SwipeDeck'
import LoadingScreen from '../components/LoadingScreen'

export default function SwipePage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [partner, setPartner] = useState(null)
  const [session, setSession] = useState(null)
  const [titles, setTitles] = useState([])
  const [myOrder, setMyOrder] = useState([]) // title IDs in my swipe order
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mySwipes, setMySwipes] = useState({}) // { titleId: 'right' | 'left' }
  const [partnerSwipes, setPartnerSwipes] = useState({}) // from realtime
  const [partnerIndex, setPartnerIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState('Loading your picks...')

  // Resolve partner label
  const otherPartner = partner === 'A' ? 'B' : 'A'

  useEffect(() => {
    const role = localStorage.getItem(`flickmatch_role_${sessionId}`)
    if (!role) navigate(`/session/${sessionId}`)
    else setPartner(role)
  }, [sessionId, navigate])

  // Load session + existing swipes on mount
  useEffect(() => {
    if (!partner) return

    const load = async () => {
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (!sessionData) return
      setSession(sessionData)

      if (sessionData.status === 'matched' || sessionData.status === 'finished') {
        navigate(`/session/${sessionId}/match`)
        return
      }

      const titleList = sessionData.titles || []
      setTitles(titleList)

      const order =
        partner === 'A' ? sessionData.titles_order_a : sessionData.titles_order_b
      setMyOrder(order || titleList.map(t => t.id))

      // Load existing swipes (to resume after refresh)
      const round = sessionData.current_round || 1
      const { data: allSwipes } = await supabase
        .from('swipes')
        .select('partner, title_id, direction')
        .eq('session_id', sessionId)
        .eq('round_num', round)

      const mine = {}
      const theirs = {}
      let myCount = 0
      let theirCount = 0

      allSwipes?.forEach(s => {
        if (s.partner === partner) {
          mine[s.title_id] = s.direction
          myCount++
        } else {
          theirs[s.title_id] = s.direction
          theirCount++
        }
      })

      setMySwipes(mine)
      setPartnerSwipes(theirs)
      setCurrentIndex(myCount)
      setPartnerIndex(theirCount)
      setLoading(false)
    }

    load()
  }, [partner, sessionId, navigate])

  // Subscribe to partner's swipes and session status via Realtime
  useEffect(() => {
    if (!sessionId || !partner) return

    const channel = supabase
      .channel(`swipe-${sessionId}-${partner}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'swipes',
          filter: `session_id=eq.${sessionId}`,
        },
        payload => {
          const s = payload.new
          if (s.partner !== partner) {
            setPartnerSwipes(prev => ({ ...prev, [s.title_id]: s.direction }))
            setPartnerIndex(prev => prev + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${sessionId}`,
        },
        payload => {
          const { status } = payload.new
          if (status === 'matched' || status === 'finished') {
            navigate(`/session/${sessionId}/match`)
          } else if (status === 'generating_round_2') {
            setLoadingMsg('Finding better matches for round 2...')
            setLoading(true)
          } else if (status === 'swiping_round_2') {
            // Reload session with new titles
            window.location.reload()
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [sessionId, partner, navigate])

  const handleSwipe = useCallback(
    async (direction, titleId) => {
      const round = session?.current_round || 1

      // Optimistic update
      setMySwipes(prev => ({ ...prev, [titleId]: direction }))
      setCurrentIndex(prev => prev + 1)

      // Persist to DB
      await supabase.from('swipes').insert({
        session_id: sessionId,
        partner,
        title_id: titleId,
        direction,
        round_num: round,
      })

      // Check for match if it was a right swipe
      if (direction === 'right' && partnerSwipes[titleId] === 'right') {
        const matchedTitle = titles.find(t => t.id === titleId)
        await supabase
          .from('sessions')
          .update({ status: 'matched', match_title: matchedTitle })
          .eq('id', sessionId)
          .neq('status', 'matched')
        navigate(`/session/${sessionId}/match`)
        return
      }

      // Check if I've finished all cards
      const newIndex = currentIndex + 1
      if (newIndex >= myOrder.length) {
        await checkRoundEnd(sessionId, partner, round, titles, session)
      }
    },
    [sessionId, partner, session, titles, myOrder, currentIndex, partnerSwipes, navigate]
  )

  // Build the ordered title list from myOrder
  const orderedTitles = myOrder
    .map(id => titles.find(t => t.id === id))
    .filter(Boolean)

  const partnerLikedCount = Object.values(partnerSwipes).filter(d => d === 'right').length
  const partnerStatus =
    partnerIndex > 0
      ? `Partner ${otherPartner}: ${partnerLikedCount} liked / ${partnerIndex} seen`
      : null

  if (loading) return <LoadingScreen message={loadingMsg} />

  return (
    <div className="page page-swipe">
      <header className="swipe-header">
        <div className="logo">Flick<span>Match</span></div>
        <div className="session-badge">
          <span>
            Round {session?.current_round || 1}
          </span>
        </div>
      </header>

      <main className="swipe-main">
        <SwipeDeck
          titles={orderedTitles}
          onSwipe={handleSwipe}
          currentIndex={currentIndex}
          partnerStatus={partnerStatus}
        />
      </main>
    </div>
  )
}

// ── Check if the round is over and handle round 2 or top-5 fallback ────
async function checkRoundEnd(sessionId, partner, round, titles, session) {
  // Check if the other partner has also finished
  const { data: swipeCounts } = await supabase
    .from('swipes')
    .select('partner')
    .eq('session_id', sessionId)
    .eq('round_num', round)

  const counts = {}
  swipeCounts?.forEach(s => { counts[s.partner] = (counts[s.partner] || 0) + 1 })
  const totalTitles = titles.length

  const bothFinished =
    (counts['A'] || 0) >= totalTitles && (counts['B'] || 0) >= totalTitles

  if (!bothFinished) return // wait for other partner

  // Both done — try to claim generation for round 2
  if (round === 1) {
    const { data: lockData } = await supabase
      .from('sessions')
      .update({ status: 'generating_round_2' })
      .eq('id', sessionId)
      .eq('status', 'swiping_round_1')
      .select('id')

    if (lockData?.length > 0) {
      await runRound2Generation(sessionId, session)
    }
  } else {
    // Round 2 ended with no match — compute top 5
    const { data: lockData } = await supabase
      .from('sessions')
      .update({ status: 'finished' })
      .eq('id', sessionId)
      .eq('status', 'swiping_round_2')
      .select('id')

    if (lockData?.length > 0) {
      await computeTopPicks(sessionId)
    }
  }
}

async function runRound2Generation(sessionId, session) {
  try {
    const { data: prefs } = await supabase
      .from('preferences')
      .select('*')
      .eq('session_id', sessionId)

    const prefA = prefs.find(p => p.partner === 'A')
    const prefB = prefs.find(p => p.partner === 'B')

    const { data: swipes } = await supabase
      .from('swipes')
      .select('*')
      .eq('session_id', sessionId)
      .eq('round_num', 1)
      .eq('direction', 'right')

    const titles = session?.titles || []
    const likesA = swipes.filter(s => s.partner === 'A').map(s => titles.find(t => t.id === s.title_id)).filter(Boolean)
    const likesB = swipes.filter(s => s.partner === 'B').map(s => titles.find(t => t.id === s.title_id)).filter(Boolean)
    const seenIds = titles.map(t => t.id)

    const { brief } = await generateRecommendations(prefA, prefB, likesA, likesB)

    const langA = prefA.languages?.includes('Any') ? [] : prefA.languages
    const langB = prefB.languages?.includes('Any') ? [] : prefB.languages
    const mergedPrefs = {
      languages: [...new Set([...langA, ...langB])],
      contentType: prefA.content_type === 'both' || prefB.content_type === 'both' ? 'both' : 'movies',
    }

    const newTitles = await fetchTitlePool({ brief, mergedPrefs, seenIds })
    const ids = newTitles.map(t => t.id)

    await supabase
      .from('sessions')
      .update({
        titles: newTitles,
        titles_order_a: shuffleArray(ids),
        titles_order_b: shuffleArray(ids),
        current_round: 2,
        status: 'swiping_round_2',
      })
      .eq('id', sessionId)
  } catch (err) {
    console.error('Round 2 generation failed:', err)
    await supabase
      .from('sessions')
      .update({ status: 'finished' })
      .eq('id', sessionId)
    await computeTopPicks(sessionId)
  }
}

async function computeTopPicks(sessionId) {
  const { data: allSwipes } = await supabase
    .from('swipes')
    .select('title_id, partner, direction')
    .eq('session_id', sessionId)
    .eq('direction', 'right')

  const scores = {}
  allSwipes?.forEach(s => {
    scores[s.title_id] = (scores[s.title_id] || 0) + 1
  })

  const { data: sessionData } = await supabase
    .from('sessions')
    .select('titles')
    .eq('id', sessionId)
    .single()

  const titles = sessionData?.titles || []
  const top5 = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => titles.find(t => t.id === id))
    .filter(Boolean)

  await supabase
    .from('sessions')
    .update({ top_picks: top5 })
    .eq('id', sessionId)
}

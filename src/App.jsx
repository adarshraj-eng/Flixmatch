import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SessionPage from './pages/SessionPage'
import PreferencesPage from './pages/PreferencesPage'
import SwipePage from './pages/SwipePage'
import MatchPage from './pages/MatchPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/session/:sessionId" element={<SessionPage />} />
      <Route path="/session/:sessionId/preferences" element={<PreferencesPage />} />
      <Route path="/session/:sessionId/swipe" element={<SwipePage />} />
      <Route path="/session/:sessionId/match" element={<MatchPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

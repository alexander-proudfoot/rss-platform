import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './lib/store'
import Layout from './components/Layout'
import CoachingScreen from './screens/coaching/CoachingScreen'
import MatrixScreen from './screens/matrix/MatrixScreen'
import DashboardScreen from './screens/dashboard/DashboardScreen'
import HistoryScreen from './screens/history/HistoryScreen'
import LoadingSpinner from './components/LoadingSpinner'

export default function App() {
  const { user, userLoading, loadUser } = useStore()

  useEffect(() => { loadUser() }, [loadUser])

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h1 className="text-2xl font-semibold text-proudfoot-navy">Proudfoot RSS Coach</h1>
        <a
          href="/.auth/login/aad"
          className="px-6 py-2 bg-proudfoot-navy text-white rounded-lg font-medium hover:bg-proudfoot-slate transition"
        >
          Sign in with Microsoft
        </a>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/coaching" replace />} />
        <Route path="/coaching" element={<CoachingScreen />} />
        <Route path="/matrix" element={<MatrixScreen />} />
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
      </Route>
    </Routes>
  )
}

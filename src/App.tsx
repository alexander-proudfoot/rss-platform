import { Routes, Route, Navigate } from 'react-router-dom'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/coaching" replace />} />
      <Route path="/coaching" element={<div>Coaching (placeholder)</div>} />
      <Route path="/matrix" element={<div>Matrix (placeholder)</div>} />
      <Route path="/dashboard" element={<div>Dashboard (placeholder)</div>} />
      <Route path="/history" element={<div>History (placeholder)</div>} />
    </Routes>
  )
}

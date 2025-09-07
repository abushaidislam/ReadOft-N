import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function ProtectedRoute({ roles }) {
  const { auth } = useAuth()
  const isAuthed = Boolean(auth?.token)
  if (!isAuthed) return <Navigate to="/login" replace />
  if (roles && roles.length > 0) {
    const ok = roles.includes(auth?.user?.role)
    if (!ok) return <Navigate to="/" replace />
  }
  return <Outlet />
}


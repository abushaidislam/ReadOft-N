import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function ResetPassword() {
  const { request, ui } = useAuth()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const t = sp.get('token') || ''
    setToken(t)
  }, [sp])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!token) return setError('Invalid or missing token')
    if (password.length < 8) return setError('Password must be at least 8 characters')
    if (password !== confirm) return setError('Passwords do not match')
    try {
      await request('/auth/reset-confirm', { method: 'POST', body: JSON.stringify({ token, password }) })
      ui.notify('Password updated. Please login.', 'success')
      setDone(true)
      setTimeout(() => nav('/login'), 1200)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="container page">
      <div className="auth-wrap">
        <div className="auth-card">
          <h2 className="auth-title">Reset password</h2>
          <form className="form" onSubmit={submit}>
            <input type="password" placeholder="New password (min 8)" value={password} onChange={(e)=>setPassword(e.target.value)} required />
            <input type="password" placeholder="Confirm password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} required />
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={done}>Reset Password</button>
          </form>
        </div>
      </div>
    </div>
  )
}


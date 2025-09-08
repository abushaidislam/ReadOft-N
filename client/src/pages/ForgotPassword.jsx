import { useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'
import Button from '../components/Button.jsx'

export default function ForgotPassword() {
  const { request, ui } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await request('/auth/reset-request', { method: 'POST', body: JSON.stringify({ email }) })
      setSent(true)
      ui.notify('If the email exists, a reset link was sent.', 'success')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="container page">
      <div className="auth-wrap">
        <div className="auth-card">
          <h2 className="auth-title">Forgot password</h2>
          <p className="muted" style={{marginTop:-6}}>Enter your account email. We will send a reset link if it exists.</p>
          <form className="form" onSubmit={submit}>
            <input type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
            {error && <p className="error">{error}</p>}
            <Button type="submit" variant="primary" disabled={sent}>{sent ? 'Sent' : 'Send reset link'}</Button>
          </form>
        </div>
      </div>
    </div>
  )
}


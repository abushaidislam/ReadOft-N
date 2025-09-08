import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const nav = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      nav('/')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="container page">
      <div className="auth-wrap">
        <div className="auth-card">
          <h2 className="auth-title">Welcome back</h2>
          <p className="muted" style={{marginTop:-6}}>Log in to continue reading and writing.</p>
          <form onSubmit={onSubmit} className="form">
            <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" type="submit">Login</button>
          </form>
          <p className="muted">No account? <Link to="/register">Sign up</Link></p>
          <p className="muted">Forgot your password? <Link to="/forgot-password">Reset it</Link></p>
        </div>
        <div className="auth-side">
          <h3>Why join?</h3>
          <ul>
            <li>Follow authors you love</li>
            <li>Save favorites and comment</li>
            <li>Apply to become an author</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

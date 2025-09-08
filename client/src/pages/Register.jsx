import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import Button from '../components/Button.jsx'

export default function Register() {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const nav = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await register(name, email, password)
      nav('/')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="container page">
      <div className="auth-wrap">
        <div className="auth-card">
          <h2 className="auth-title">Create your account</h2>
          <p className="muted" style={{marginTop:-6}}>Join readers and writers on our platform.</p>
          <form onSubmit={onSubmit} className="form">
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="error">{error}</p>}
            <Button type="submit" variant="primary">Create account</Button>
          </form>
          <p className="muted">Have an account? <Link to="/login">Log in</Link></p>
        </div>
        <div className="auth-side">
          <h3>Start writing</h3>
          <p className="muted">Apply to become an author from your profile after signup.</p>
          <ul>
            <li>Build your audience</li>
            <li>Publish with reviews</li>
            <li>Track likes and reads</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

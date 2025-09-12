import { useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'

export default function Contact() {
  const { request, ui } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) {
      ui?.notify?.('Please fill out all fields', 'error')
      return
    }
    setBusy(true)
    try {
      await request('/contact', { method: 'POST', body: JSON.stringify({ name, email, message }), noGlobalLoading: true })
      ui?.notify?.('Message sent. We will reach out soon.', 'success')
      setName(''); setEmail(''); setMessage('')
    } catch (e) {
      ui?.notify?.(e?.message || 'Failed to send message', 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="container page">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Contact Us</h2>
        <div className="muted" style={{ marginTop: 6 }}>Have a question or feedback? We’d love to hear from you.</div>
      </div>
      <div className="grid two" style={{ gap: 16, alignItems: 'stretch' }}>
        <section className="section-card" aria-labelledby="contact-form-title">
          <h3 id="contact-form-title" style={{ marginTop: 0 }}>Send a message</h3>
          <form className="form" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="contact-name">Name</label>
            <input id="contact-name" placeholder="Your name" value={name} onChange={(e)=>setName(e.target.value)} required disabled={busy} />
            <label className="sr-only" htmlFor="contact-email">Email</label>
            <input id="contact-email" type="email" placeholder="Your email" value={email} onChange={(e)=>setEmail(e.target.value)} required disabled={busy} />
            <label className="sr-only" htmlFor="contact-msg">Message</label>
            <textarea id="contact-msg" placeholder="Message" value={message} onChange={(e)=>setMessage(e.target.value)} rows={6} required disabled={busy} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn" type="button" onClick={()=>{ setName(''); setEmail(''); setMessage('') }} disabled={busy}>Clear</button>
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
            </div>
          </form>
        </section>
        <section className="section-card" aria-labelledby="contact-info-title">
          <h3 id="contact-info-title" style={{ marginTop: 0 }}>How else to reach us</h3>
          <div className="muted" style={{ lineHeight: 1.7 }}>
            <p>We typically reply within 1–2 business days.</p>
            <p>For account or billing issues, include your registered email.</p>
          </div>
          <div className="list" style={{ display:'grid', gap: 10, marginTop: 8 }}>
            <div className="chip" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
              <span aria-hidden>📧</span><a href="mailto:support@example.com">support@example.com</a>
            </div>
            <div className="chip" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
              <span aria-hidden>📚</span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
            </div>
            <div className="chip" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
              <span aria-hidden>🔔</span><a href="/authors">Authors</a> · <a href="/categories">Categories</a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

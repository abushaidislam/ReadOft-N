export default function Privacy() {
  return (
    <div className="container page">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Privacy Policy</h2>
        <div className="muted" style={{ marginTop: 6 }}>We value your privacy. This summary explains what we collect and how we use it.</div>
      </div>

      <div className="grid two" style={{ gap: 16 }}>
        <section className="section-card" aria-labelledby="p-collect">
          <h3 id="p-collect" style={{ marginTop: 0 }}>Information We Collect</h3>
          <ul className="muted" style={{ lineHeight: 1.8 }}>
            <li>Account info you provide (name, email).</li>
            <li>Content you post (articles, comments).</li>
            <li>Usage data (page views) for analytics and reliability.</li>
            <li>Device and browser meta (for security and debugging).</li>
          </ul>
        </section>

        <section className="section-card" aria-labelledby="p-use">
          <h3 id="p-use" style={{ marginTop: 0 }}>How We Use Information</h3>
          <ul className="muted" style={{ lineHeight: 1.8 }}>
            <li>To provide and personalize the service experience.</li>
            <li>To improve performance, stability, and features.</li>
            <li>To detect abuse and keep the community safe.</li>
            <li>To communicate important updates (you can opt out).</li>
          </ul>
        </section>

        <section className="section-card" aria-labelledby="p-sharing">
          <h3 id="p-sharing" style={{ marginTop: 0 }}>Sharing & Third Parties</h3>
          <p className="muted">We don’t sell your data. We may use trusted infrastructure providers to host and deliver the service.</p>
        </section>

        <section className="section-card" aria-labelledby="p-control">
          <h3 id="p-control" style={{ marginTop: 0 }}>Your Choices & Control</h3>
          <ul className="muted" style={{ lineHeight: 1.8 }}>
            <li>Access, update, or delete account information.</li>
            <li>Request data export by contacting support.</li>
            <li>Opt out of non-essential emails at any time.</li>
          </ul>
        </section>
      </div>

      <div className="muted" style={{ marginTop: 12 }}>Last updated: {new Date().toLocaleDateString()}</div>
    </div>
  )
}

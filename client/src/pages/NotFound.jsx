export default function NotFound(){
  return (
    <div className="container page" style={{ textAlign:'center' }}>
      <div className="section-card" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontSize: '3rem', lineHeight: 1 }}>🧭</div>
        <h2 style={{ margin: '8px 0 4px' }}>Page not found</h2>
        <p className="muted" style={{ margin: 0 }}>We couldn’t find what you’re looking for. Try one of these:</p>
        <div className="chips" style={{ justifyContent:'center', marginTop: 12 }}>
          <a className="chip" href="/">Go Home</a>
          <a className="chip" href="/categories">Explore Categories</a>
          <a className="chip" href="/authors">Discover Authors</a>
          <a className="chip" href="/feed">Your Feed</a>
        </div>
        <div style={{ marginTop: 16 }}>
          <a className="btn btn-primary" href="/">Back to Home</a>
        </div>
      </div>
    </div>
  )
}


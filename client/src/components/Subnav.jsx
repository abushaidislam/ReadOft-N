import { useLocation, useNavigate } from 'react-router-dom'

export default function Subnav() {
  const loc = useLocation()
  const nav = useNavigate()
  const show = loc.pathname !== '/'
  const goBack = () => {
    try {
      if (window.history.length > 2) nav(-1)
      else nav('/')
    } catch { nav('/') }
  }
  if (!show) return null
  return (
    <div className="subnav">
      <div className="container subnav-inner">
        <button className="btn back-btn" onClick={goBack} aria-label="Go back">← Back</button>
      </div>
    </div>
  )
}


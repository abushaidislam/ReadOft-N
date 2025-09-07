import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function Categories() {
  const { request } = useAuth()
  const [items, setItems] = useState([])

  useEffect(() => { request('/categories').then(setItems).catch(() => {}) }, [])

  return (
    <div className="container page">
      <h2>Categories</h2>
      <div className="grid">
        {items.map((c) => (
          <Link className="card" key={c.id} to={`/category/${c.slug}`}>
            <h3 className="card-title">{c.name}</h3>
            <p className="muted">/{c.slug}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}


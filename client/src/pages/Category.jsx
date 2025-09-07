import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import ArticleCard from '../components/ArticleCard.jsx'

export default function Category() {
  const { slug } = useParams()
  const { request } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    request(`/articles?category=${slug}`).then((data) => {
      setItems(data.items || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [slug])

  return (
    <div className="container page">
      <h2>Category: {slug}</h2>
      {loading ? <p>Loading...</p> : (
        <div className="grid">
          {items.map((a) => <ArticleCard article={a} key={a.id} />)}
        </div>
      )}
    </div>
  )
}


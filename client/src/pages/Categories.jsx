import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function Categories() {
  const { request } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('name') // 'name', 'posts', 'recent'

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const cats = await request('/categories')
        // Fetch counts per category using the articles endpoint's count
        const withCounts = await Promise.all(
          (cats || []).map(async (c) => {
            try {
              const r = await request(`/articles?category=${encodeURIComponent(c.slug)}&limit=1`, { noGlobalLoading: true })
              return { ...c, postCount: r?.pageInfo?.total ?? 0 }
            } catch {
              return { ...c, postCount: 0 }
            }
          })
        )
        setItems(withCounts)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Category icons mapping
  const getCategoryIcon = (slug) => {
    const icons = {
      'technology': '💻',
      'design': '🎨',
      'business': '💼',
      'lifestyle': '🌟',
      'travel': '✈️',
      'food': '🍽️',
      'health': '🏥',
      'education': '📚',
      'sports': '⚽',
      'music': '🎵',
      'gaming': '🎮',
      'science': '🔬',
      'news': '📰',
      'finance': '💰',
      'photography': '📸'
    }
    return icons[slug] || '📂'
  }

  // Category colors
  const getCategoryColor = (index) => {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
      'linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%)'
    ]
    return colors[index % colors.length]
  }

  // Filter and sort categories
  const filteredItems = items
    .filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.slug.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'posts':
          return (b.postCount || 0) - (a.postCount || 0)
        case 'recent':
          return new Date(b.created_at || 0) - new Date(a.created_at || 0)
        default:
          return a.name.localeCompare(b.name)
      }
    })

  const totalPosts = items.reduce((sum, item) => sum + (item.postCount || 0), 0)

  return (
    <div className="container page">
      {/* Hero Section */}
      <div className="categories-hero">
        <div className="categories-hero-content">
          <h1 className="categories-hero-title">Explore Categories</h1>
          <p className="categories-hero-subtitle">
            Discover amazing content across {items.length} categories with {totalPosts} total articles
          </p>
        </div>
        <div className="categories-hero-decoration">
          <div className="floating-icon">📚</div>
          <div className="floating-icon">🎨</div>
          <div className="floating-icon">💻</div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="categories-controls">
        <div className="categories-search">
          <div className="search-icon">🔍</div>
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="categories-search-input"
          />
        </div>
        <div className="categories-sort">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="categories-sort-select"
          >
            <option value="name">Sort by Name</option>
            <option value="posts">Sort by Posts</option>
            <option value="recent">Sort by Recent</option>
          </select>
        </div>
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="categories-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="category-card skeleton">
              <div className="category-card-icon skeleton-thumb" style={{ width: '60px', height: '60px', borderRadius: '50%' }} />
              <div className="skeleton-line w-80" style={{ marginTop: '16px' }} />
              <div className="skeleton-line w-60" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="categories-stats">
            <span className="categories-count">
              {filteredItems.length} {filteredItems.length === 1 ? 'category' : 'categories'}
              {searchTerm && ` matching "${searchTerm}"`}
            </span>
          </div>
          
          <div className="categories-grid">
            {filteredItems.map((category, index) => (
              <Link 
                key={category.id} 
                to={`/category/${category.slug}`} 
                className="category-card"
                style={{ '--delay': `${index * 0.1}s` }}
              >
                <div 
                  className="category-card-background"
                  style={{ background: getCategoryColor(index) }}
                />
                <div className="category-card-content">
                  <div className="category-card-icon">
                    {getCategoryIcon(category.slug)}
                  </div>
                  <h3 className="category-card-title">{category.name}</h3>
                  <div className="category-card-meta">
                    <span className="category-card-slug">/{category.slug}</span>
                    <span className="category-card-count">
                      {typeof category.postCount === 'number' ? category.postCount : 0} 
                      {category.postCount === 1 ? ' post' : ' posts'}
                    </span>
                  </div>
                  <div className="category-card-progress">
                    <div 
                      className="category-card-progress-bar"
                      style={{ 
                        width: `${Math.min(100, ((category.postCount || 0) / Math.max(...items.map(i => i.postCount || 0), 1)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
                <div className="category-card-hover-effect" />
              </Link>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="categories-empty">
              <div className="categories-empty-icon">🔍</div>
              <h3>No categories found</h3>
              <p>Try adjusting your search terms or browse all categories.</p>
              <button 
                className="btn btn-primary"
                onClick={() => setSearchTerm('')}
              >
                Clear Search
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

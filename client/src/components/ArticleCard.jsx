import { Link } from 'react-router-dom'

export default function ArticleCard({ article, index = 0 }) {
  const created = article.created_at ? new Date(article.created_at).toLocaleDateString() : ''
  const excerpt = (article.content || '').replace(/[#*_>`]/g, '').slice(0, 160)
  return (
    <article className="card card-animated" style={{ animationDelay: `${(index % 12) * 30}ms` }}>
      {article.thumbnail_url ? (
        <img
          src={article.thumbnail_url}
          alt="thumbnail"
          className="thumb"
        />
      ) : null}
      <h3 className="card-title"><Link to={article.slug ? `/a/${article.slug}` : `/article/${article.id}`}>{article.title}</Link></h3>
      <p className="muted">{created} • ♥ {article.like_count ?? 0}</p>
      <p className="line-clamp">{excerpt}{excerpt.length >= 160 ? '…' : ''}</p>
      <div className="chips" style={{ marginTop: 8, alignItems:'center' }}>
        <Link className="chip author-chip" to={`/author/${article.author?.id || article.author_id}`}>
          {article.author?.avatar_url ? (
            <img className="avatar" src={article.author.avatar_url} alt={article.author?.name || 'Author'} />
          ) : (
            <span className="avatar avatar-fallback">{(article.author?.name || 'A').slice(0,1).toUpperCase()}</span>
          )}
          <span className="author-name">{article.author?.name || 'Author'}</span>
        </Link>
        {(article.categories || []).map((c) => (
          <Link className="chip" key={c} to={`/category/${c}`}>{c}</Link>
        ))}
      </div>
    </article>
  )
}

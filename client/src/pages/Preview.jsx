import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkSlug from 'remark-slug'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'

export default function Preview() {
  const { token } = useParams()
  const [article, setArticle] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
    fetch(`${base}/articles/preview/${token}`)
      .then(async (r) => { const j = await r.json().catch(()=>({})); if (!r.ok) throw new Error(j.message||'Failed to load'); return j })
      .then(setArticle)
      .catch((e) => setError(e.message))
  }, [token])

  const mdSchema = {
    ...defaultSchema,
    attributes: {
      ...(defaultSchema.attributes || {}),
      code: [...(defaultSchema.attributes?.code || []), ['className']],
      pre: [...(defaultSchema.attributes?.pre || []), ['className']],
      h1: [...(defaultSchema.attributes?.h1 || []), ['id']],
      h2: [...(defaultSchema.attributes?.h2 || []), ['id']],
      h3: [...(defaultSchema.attributes?.h3 || []), ['id']],
      h4: [...(defaultSchema.attributes?.h4 || []), ['id']],
      h5: [...(defaultSchema.attributes?.h5 || []), ['id']],
      h6: [...(defaultSchema.attributes?.h6 || []), ['id']],
    },
  }

  if (error) return <div className="container page"><p className="error">{error}</p></div>
  if (!article) return <div className="container page"><p>Loading...</p></div>

  return (
    <div className="container page">
      {article.thumbnail_url && (
        <img src={article.thumbnail_url} alt="thumbnail" className="hero-thumb" loading="lazy" decoding="async" />
      )}
      <h1>{article.title}</h1>
      <p className="muted">Draft preview — not publicly visible</p>
      <div className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkSlug]} rehypePlugins={[[rehypeSanitize, mdSchema], rehypeHighlight]}>
          {article.content || ''}
        </ReactMarkdown>
      </div>
    </div>
  )
}


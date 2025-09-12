import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkSlug from 'remark-slug'
import remarkMath from 'remark-math'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'

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
    tagNames: [
      ...((defaultSchema.tagNames || [])),
      'math','semantics','mrow','mi','mo','mn','msup','mfrac','msqrt','mroot','mtable','mtr','mtd','mspace','mstyle','annotation',
      'svg','g','path','circle','rect','line','polyline','polygon','ellipse','defs','linearGradient','radialGradient','stop','title','desc','symbol','use','clipPath','mask','pattern','view'
    ],
    attributes: {
      ...(defaultSchema.attributes || {}),
      a: [...(defaultSchema.attributes?.a || []), ['href'], ['target'], ['rel'], ['title']],
      code: [...(defaultSchema.attributes?.code || []), ['className']],
      pre: [...(defaultSchema.attributes?.pre || []), ['className']],
      h1: [...(defaultSchema.attributes?.h1 || []), ['id']],
      h2: [...(defaultSchema.attributes?.h2 || []), ['id']],
      h3: [...(defaultSchema.attributes?.h3 || []), ['id']],
      h4: [...(defaultSchema.attributes?.h4 || []), ['id']],
      h5: [...(defaultSchema.attributes?.h5 || []), ['id']],
      h6: [...(defaultSchema.attributes?.h6 || []), ['id']],
      span: [...(defaultSchema.attributes?.span || []), ['className'], ['style']],
      math: [...(defaultSchema.attributes?.math || []), ['display']],
      annotation: [...(defaultSchema.attributes?.annotation || []), ['encoding']],
      mtable: [...(defaultSchema.attributes?.mtable || []), ['rowspacing','columnspacing','displaystyle']],
      mtd: [...(defaultSchema.attributes?.mtd || []), ['columnalign']],
      // Safe inline SVG attributes
      svg: [...(defaultSchema.attributes?.svg || []), ['viewBox'], ['width'], ['height'], ['fill'], ['stroke'], ['stroke-width'], ['xmlns'], ['preserveAspectRatio'], ['aria-hidden'], ['focusable'], ['role'], ['version'], ['x'], ['y'], ['className'], ['style']],
      g:   [...(defaultSchema.attributes?.g || []), ['transform'], ['fill'], ['stroke'], ['opacity'], ['clip-path']],
      path:[...(defaultSchema.attributes?.path || []), ['d'], ['fill'], ['stroke'], ['stroke-width'], ['transform'], ['opacity'], ['fill-opacity'], ['stroke-linecap'], ['stroke-linejoin'], ['stroke-opacity'], ['clip-path']],
      circle:[...(defaultSchema.attributes?.circle || []), ['cx'], ['cy'], ['r'], ['fill'], ['stroke'], ['stroke-width'], ['opacity']],
      rect:[...(defaultSchema.attributes?.rect || []), ['x'], ['y'], ['width'], ['height'], ['rx'], ['ry'], ['fill'], ['stroke'], ['stroke-width'], ['opacity']],
      line:[...(defaultSchema.attributes?.line || []), ['x1'], ['y1'], ['x2'], ['y2'], ['stroke'], ['stroke-width'], ['opacity']],
      polyline:[...(defaultSchema.attributes?.polyline || []), ['points'], ['fill'], ['stroke'], ['stroke-width'], ['opacity']],
      polygon:[...(defaultSchema.attributes?.polygon || []), ['points'], ['fill'], ['stroke'], ['stroke-width'], ['opacity']],
      ellipse:[...(defaultSchema.attributes?.ellipse || []), ['cx'], ['cy'], ['rx'], ['ry'], ['fill'], ['stroke'], ['stroke-width'], ['opacity']],
      linearGradient:[...(defaultSchema.attributes?.linearGradient || []), ['id'], ['x1'], ['y1'], ['x2'], ['y2'], ['gradientUnits']],
      radialGradient:[...(defaultSchema.attributes?.radialGradient || []), ['id'], ['cx'], ['cy'], ['r'], ['fx'], ['fy'], ['gradientUnits']],
      stop:[...(defaultSchema.attributes?.stop || []), ['offset'], ['stop-color'], ['stop-opacity']],
      use:[...(defaultSchema.attributes?.use || []), ['href']],
      clipPath:[...(defaultSchema.attributes?.clipPath || []), ['id']],
      img: [...(defaultSchema.attributes?.img || []), ['src'], ['alt'], ['title'], ['width'], ['height'], ['loading'], ['decoding']]
    },
  }

  const LinkRenderer = ({ href = '', children, ...props }) => {
    let urlObj = null
    try { urlObj = new URL(href, window.location.origin) } catch { /* ignore invalid URL */ }
    const isHttp = !!urlObj && /^(http|https):$/i.test(urlObj.protocol)
    const external = isHttp && (urlObj.origin !== window.location.origin)

    const onlyChild = Array.isArray(children) && children.length === 1 ? children[0] : null
    const childText = typeof onlyChild === 'string' ? onlyChild.trim() : ''
    const norm = (s) => String(s || '').replace(/^https?:\/\//i, '').replace(/\/$/, '')
    const isBare = !!childText && (norm(childText) === norm(href))

    const rel = external ? 'noopener noreferrer nofollow ugc' : undefined
    const target = external ? '_blank' : undefined
    const cls = `md-link ${external ? 'ext' : ''}`.trim()

    let content = children
    if (isBare && urlObj && isHttp) {
      const domain = urlObj.host
      let path = urlObj.pathname + (urlObj.search || '')
      if (path === '/' || !path) path = ''
      if (path.length > 28) {
        const parts = urlObj.pathname.split('/').filter(Boolean)
        const last = parts.slice(-2).join('/')
        path = `/${parts.length > 2 ? '…/' : ''}${last}` + (urlObj.search ? '…' : '')
      }
      content = (
        <>
          <span className="md-link-domain">{domain}</span>
          {path && <span className="md-link-path">{path}</span>}
        </>
      )
    }

    return (
      <a href={href} rel={rel} target={target} className={cls} {...props}>
        {content}
        {external && <span aria-hidden="true" className="ext-icon" style={{ marginLeft: 4 }}>↗</span>}
      </a>
    )
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
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkSlug, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeKatex, [rehypeSanitize, mdSchema], rehypeHighlight]}
          components={{ a: LinkRenderer }}
        >
          {article.content || ''}
        </ReactMarkdown>
      </div>
    </div>
  )
}


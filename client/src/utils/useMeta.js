import { useEffect } from 'react'

function setTag(attr, key, value) {
  if (!value) return
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

export default function useMeta({ title, description, image, canonical } = {}) {
  useEffect(() => {
    if (title) document.title = title
    if (description) setTag('name', 'description', description)
    if (title) setTag('property', 'og:title', title)
    if (description) setTag('property', 'og:description', description)
    if (image) setTag('property', 'og:image', image)
    // Twitter
    setTag('name','twitter:card','summary_large_image')
    if (title) setTag('name','twitter:title', title)
    if (description) setTag('name','twitter:description', description)
    if (image) setTag('name','twitter:image', image)
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]')
      if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link) }
      const base = (typeof location !== 'undefined' ? location.origin : '')
      link.setAttribute('href', canonical.startsWith('http') ? canonical : `${base}${canonical}`)
    }
  }, [title, description, image, canonical])
}

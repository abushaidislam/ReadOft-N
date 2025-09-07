export function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
}

// Ensure slug unique by appending short suffix if needed
export async function ensureUniqueSlug(supabase, baseSlug) {
  let slug = baseSlug || 'post'
  if (!slug) slug = 'post'
  let attempt = 0
  while (attempt < 5) {
    const { data, error } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!error && !data) return slug
    attempt++
    const suffix = Math.random().toString(36).slice(2, 6)
    slug = `${baseSlug}-${suffix}`
  }
  return `${baseSlug}-${Date.now().toString(36)}`
}

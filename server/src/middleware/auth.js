import jwt from 'jsonwebtoken'

export function authOptional(req, _res, next) {
  const token = getToken(req)
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    } catch {
      // ignore invalid tokens when optional
    }
  }
  next()
}

export function authRequired(req, res, next) {
  const token = getToken(req)
  if (!token) return res.status(401).json({ message: 'Missing token' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    next()
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' })
  }
}

function getToken(req) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length)
  return null
}


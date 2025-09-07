const clients = new Map() // user_id -> Set(res)

export function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set())
  clients.get(userId).add(res)
}

export function removeClient(userId, res) {
  const set = clients.get(userId)
  if (!set) return
  set.delete(res)
  if (set.size === 0) clients.delete(userId)
}

export function pushOne(userId, payload) {
  const set = clients.get(userId)
  if (!set) return
  const data = `data: ${JSON.stringify(payload)}\n\n`
  for (const res of set) {
    try { res.write(data) } catch {}
  }
}

export function pushMany(userIds, payloadFactory) {
  for (const uid of userIds) {
    const p = typeof payloadFactory === 'function' ? payloadFactory(uid) : payloadFactory
    pushOne(uid, p)
  }
}


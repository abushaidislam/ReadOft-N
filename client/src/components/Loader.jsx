import React from 'react'

export default function Loader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="spinner" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

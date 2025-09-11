export default function ArticleSkeleton() {
  return (
    <div className="container page">
      <div className="article-skeleton">
        {/* Hero thumbnail skeleton */}
        <div className="skeleton">
          <div className="skeleton-thumb" style={{ width: '100%', height: '300px', marginBottom: '24px' }} />
        </div>
        
        {/* Title and metadata skeleton */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <div className="skeleton">
              <div className="skeleton-line w-80" style={{ height: '32px', marginBottom: '8px' }} />
              <div className="skeleton-line w-60" style={{ height: '16px', marginBottom: '4px' }} />
              <div className="skeleton-line w-80" style={{ height: '16px' }} />
            </div>
          </div>
          <div className="skeleton">
            <div className="skeleton-line" style={{ width: '120px', height: '36px' }} />
          </div>
        </div>
        
        {/* Action buttons skeleton */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <div className="skeleton">
            <div className="skeleton-row">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-chip" />
              ))}
            </div>
          </div>
        </div>
        
        {/* Article content skeleton */}
        <div className="markdown-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: '24px' }}>
          <div className="markdown-skeleton">
            <div className="skeleton">
              {/* First paragraph */}
              <div className="skeleton-line w-80" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line w-60" style={{ marginBottom: '16px' }} />
              
              {/* Second paragraph */}
              <div className="skeleton-line" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line w-80" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line w-60" style={{ marginBottom: '16px' }} />
              
              {/* Third paragraph */}
              <div className="skeleton-line w-80" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line w-80" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line w-60" style={{ marginBottom: '16px' }} />
              
              {/* Fourth paragraph */}
              <div className="skeleton-line" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line w-80" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line w-60" style={{ marginBottom: '16px' }} />
              
              {/* Fifth paragraph */}
              <div className="skeleton-line w-80" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line w-80" style={{ marginBottom: '8px' }} />
              <div className="skeleton-line w-60" style={{ marginBottom: '16px' }} />
            </div>
          </div>
          
          {/* TOC skeleton */}
          <aside style={{ position: 'sticky', top: '88px', alignSelf: 'start' }}>
            <div className="section-card">
              <div className="skeleton">
                <div className="skeleton-line w-60" style={{ height: '20px', marginBottom: '16px' }} />
                <div className="skeleton-line w-80" style={{ height: '14px', marginBottom: '8px' }} />
                <div className="skeleton-line w-60" style={{ height: '14px', marginBottom: '8px', marginLeft: '12px' }} />
                <div className="skeleton-line w-80" style={{ height: '14px', marginBottom: '8px' }} />
                <div className="skeleton-line w-60" style={{ height: '14px', marginBottom: '8px', marginLeft: '12px' }} />
                <div className="skeleton-line w-80" style={{ height: '14px', marginBottom: '8px' }} />
              </div>
            </div>
          </aside>
        </div>
        
        {/* Comments skeleton */}
        <div style={{ marginTop: '32px' }}>
          <div className="skeleton">
            <div className="skeleton-line" style={{ width: '150px', height: '24px', marginBottom: '16px' }} />
            <div className="skeleton-thumb" style={{ width: '100%', height: '100px' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

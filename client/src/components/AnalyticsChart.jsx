import { useEffect, useRef } from 'react'

// Simple line chart component
export function LineChart({ data, width = 400, height = 200, color = '#6366f1' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data || data.length === 0) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    const padding = 40
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    const maxValue = Math.max(...data.map(d => d.value))
    const minValue = Math.min(...data.map(d => d.value))
    const range = maxValue - minValue || 1

    // Draw grid lines
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
    }

    // Draw line
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()

    data.forEach((point, index) => {
      const x = padding + (chartWidth / (data.length - 1)) * index
      const y = padding + chartHeight - ((point.value - minValue) / range) * chartHeight
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.stroke()

    // Draw points
    ctx.fillStyle = color
    data.forEach((point, index) => {
      const x = padding + (chartWidth / (data.length - 1)) * index
      const y = padding + chartHeight - ((point.value - minValue) / range) * chartHeight
      
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.fill()
    })

    // Draw labels
    ctx.fillStyle = '#9ca3af'
    ctx.font = '12px Inter'
    ctx.textAlign = 'center'
    
    // Y-axis labels
    for (let i = 0; i <= 4; i++) {
      const value = minValue + (range / 4) * (4 - i)
      const y = padding + (chartHeight / 4) * i + 4
      ctx.textAlign = 'right'
      ctx.fillText(Math.round(value), padding - 10, y)
    }

    // X-axis labels (show every 5th point)
    ctx.textAlign = 'center'
    data.forEach((point, index) => {
      if (index % 5 === 0 || index === data.length - 1) {
        const x = padding + (chartWidth / (data.length - 1)) * index
        const label = point.label || index
        ctx.fillText(label, x, height - 10)
      }
    })

  }, [data, width, height, color])

  return <canvas ref={canvasRef} style={{ display: 'block' }} />
}

// Multi-series line chart
export function MultiLineChart({ series = [], width = 500, height = 220 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !series || series.length === 0) return
    const first = series[0]
    const pointsCount = (first.data || []).length
    if (!pointsCount) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    ctx.scale(dpr, dpr)

    // Clear
    ctx.clearRect(0, 0, width, height)

    const padding = 40
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    // Compute min/max across all series
    let maxValue = Number.NEGATIVE_INFINITY
    let minValue = Number.POSITIVE_INFINITY
    for (const s of series) {
      for (const d of (s.data || [])) {
        maxValue = Math.max(maxValue, d.value)
        minValue = Math.min(minValue, d.value)
      }
    }
    if (!isFinite(maxValue)) maxValue = 1
    if (!isFinite(minValue)) minValue = 0
    const range = (maxValue - minValue) || 1

    // Grid
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
    }

    // Draw each series line
    for (const s of series) {
      const color = s.color || '#6366f1'
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      s.data.forEach((point, index) => {
        const x = padding + (chartWidth / (pointsCount - 1)) * index
        const y = padding + chartHeight - ((point.value - minValue) / range) * chartHeight
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      // Points
      ctx.fillStyle = color
      s.data.forEach((point, index) => {
        const x = padding + (chartWidth / (pointsCount - 1)) * index
        const y = padding + chartHeight - ((point.value - minValue) / range) * chartHeight
        ctx.beginPath()
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI)
        ctx.fill()
      })
    }

    // Axes labels
    ctx.fillStyle = '#9ca3af'
    ctx.font = '12px Inter'
    ctx.textAlign = 'center'
    // Y labels
    for (let i = 0; i <= 4; i++) {
      const value = minValue + (range / 4) * (4 - i)
      const y = padding + (chartHeight / 4) * i + 4
      ctx.textAlign = 'right'
      ctx.fillText(Math.round(value), padding - 10, y)
    }
    // X labels (every 5th)
    ctx.textAlign = 'center'
    for (let index = 0; index < pointsCount; index++) {
      if (index % 5 === 0 || index === pointsCount - 1) {
        const x = padding + (chartWidth / (pointsCount - 1)) * index
        const label = (first.data[index]?.label) ?? index
        ctx.fillText(String(label), x, height - 10)
      }
    }
  }, [series, width, height])

  return <canvas ref={canvasRef} style={{ display: 'block' }} />
}

// Simple bar chart component
export function BarChart({ data, width = 300, height = 200, color = '#10b981' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data || data.length === 0) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    const padding = 40
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    const maxValue = Math.max(...data.map(d => d.value))
    const barWidth = chartWidth / data.length * 0.8
    const barSpacing = chartWidth / data.length * 0.2

    // Draw bars
    ctx.fillStyle = color
    data.forEach((item, index) => {
      const barHeight = (item.value / maxValue) * chartHeight
      const x = padding + index * (barWidth + barSpacing) + barSpacing / 2
      const y = padding + chartHeight - barHeight

      ctx.fillRect(x, y, barWidth, barHeight)
    })

    // Draw labels
    ctx.fillStyle = '#9ca3af'
    ctx.font = '12px Inter'
    ctx.textAlign = 'center'
    
    data.forEach((item, index) => {
      const x = padding + index * (barWidth + barSpacing) + barSpacing / 2 + barWidth / 2
      ctx.fillText(item.label, x, height - 10)
      
      // Value on top of bar
      const barHeight = (item.value / maxValue) * chartHeight
      const y = padding + chartHeight - barHeight - 5
      ctx.fillText(item.value, x, y)
    })

  }, [data, width, height, color])

  return <canvas ref={canvasRef} style={{ display: 'block' }} />
}

// Donut chart component
export function DonutChart({ data, width = 200, height = 200, colors = ['#6366f1', '#10b981', '#f59e0b'] }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data || data.length === 0) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 20
    const innerRadius = radius * 0.6

    const total = data.reduce((sum, item) => sum + item.value, 0)
    let currentAngle = -Math.PI / 2

    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI
      const color = colors[index % colors.length]

      // Draw outer arc
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
      ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true)
      ctx.closePath()
      ctx.fill()

      currentAngle += sliceAngle
    })

    // Draw center circle
    ctx.fillStyle = '#111318'
    ctx.beginPath()
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI)
    ctx.fill()

  }, [data, width, height, colors])

  return <canvas ref={canvasRef} style={{ display: 'block' }} />
}

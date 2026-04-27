import { useEffect, useRef } from 'react'

const AREA_COLORS = {
  town:    { bg: '#1a2a1a', border: '#4ade80', label: '#4ade80' },
  ruins:   { bg: '#2a1a0a', border: '#a16207', label: '#fbbf24' },
  temple:  { bg: '#1a1a2a', border: '#818cf8', label: '#a5b4fc' },
  arena:   { bg: '#2a1010', border: '#dc2626', label: '#f87171' },
  abyss:   { bg: '#0a0a1a', border: '#6b21a8', label: '#c084fc' },
  forge:   { bg: '#2a1500', border: '#ea580c', label: '#fb923c' },
  library: { bg: '#1a1a10', border: '#ca8a04', label: '#fde047' },
}

const DEFAULT_COLOR = { bg: '#1a1a1a', border: '#444', label: '#888' }

function layoutRegions(regions) {
  if (!regions?.length) return []
  const placed = []
  const cols = Math.ceil(Math.sqrt(regions.length))
  regions.forEach((r, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    placed.push({
      ...r,
      px: 60 + col * 130,
      py: 60 + row * 110,
      pw: 110,
      ph: 70,
    })
  })
  return placed
}

export default function MapPanel({
  mapData, gameState, allNpcs, activeRegion, onRegionClick, onNpcClick,
}) {
  const canvasRef = useRef()
  // Support both mapData.regions and mapData.map.regions (in case of nesting)
  const regions = mapData?.regions || mapData?.map?.regions || []
  const placed = layoutRegions(regions)

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Background grid
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (let y = 0; y < H; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // Connections
    placed.forEach(r => {
      (r.connections || []).forEach(connId => {
        const target = placed.find(p => p.region_id === connId)
        if (!target) return
        ctx.strokeStyle = '#2a2a2a'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(r.px + r.pw / 2, r.py + r.ph / 2)
        ctx.lineTo(target.px + target.pw / 2, target.py + target.ph / 2)
        ctx.stroke()
        ctx.setLineDash([])
      })
    })

    // Regions
    placed.forEach(r => {
      const unlocked = gameState?.unlocked_regions?.includes(r.region_id)
      const isActive = activeRegion?.region_id === r.region_id
      const col = AREA_COLORS[r.area_type] || DEFAULT_COLOR

      // Pixel border style
      ctx.fillStyle = unlocked ? col.bg : '#111'
      ctx.fillRect(r.px, r.py, r.pw, r.ph)

      ctx.strokeStyle = isActive ? '#ffd700' : (unlocked ? col.border : '#333')
      ctx.lineWidth = isActive ? 3 : 2
      ctx.strokeRect(r.px, r.py, r.pw, r.ph)

      if (!unlocked) {
        // Locked overlay
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(r.px, r.py, r.pw, r.ph)
        ctx.fillStyle = '#444'
        ctx.font = '14px Courier New'
        ctx.textAlign = 'center'
        ctx.fillText('🔒', r.px + r.pw / 2, r.py + r.ph / 2 + 5)
        return
      }

      // Region name
      ctx.fillStyle = col.label
      ctx.font = `bold 11px 'Courier New'`
      ctx.textAlign = 'center'
      ctx.fillText(r.name || r.region_id, r.px + r.pw / 2, r.py + 18)

      // Area type tag
      ctx.fillStyle = '#555'
      ctx.font = '9px Courier New'
      ctx.fillText(`[${r.area_type || ''}]`, r.px + r.pw / 2, r.py + r.ph - 8)

      // NPC dots
      const npcsHere = (r.npcs_here || []).filter(id =>
        gameState?.unlocked_npcs?.includes(id)
      )
      npcsHere.slice(0, 4).forEach((npcId, idx) => {
        const npc = allNpcs.find(n => n.npc_id === npcId)
        const recruited = gameState?.recruited_npcs?.includes(npcId)
        const dotX = r.px + 14 + idx * 18
        const dotY = r.py + r.ph / 2 + 4
        ctx.fillStyle = npc?.type === 'C' ? '#ffd700' : (recruited ? '#4ade80' : '#818cf8')
        ctx.beginPath()
        ctx.arc(dotX, dotY, 5, 0, Math.PI * 2)
        ctx.fill()
      })
    })
  }

  useEffect(() => { draw() }, [placed, gameState, activeRegion])

  function handleClick(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const my = (e.clientY - rect.top) * (canvas.height / rect.height)

    for (const r of placed) {
      if (mx >= r.px && mx <= r.px + r.pw && my >= r.py && my <= r.py + r.ph) {
        const region = regions.find(rg => rg.region_id === r.region_id)
        if (region) onRegionClick(region)
        return
      }
    }
  }

  const canvasW = Math.max(600, placed.reduce((m, r) => Math.max(m, r.px + r.pw + 60), 600))
  const canvasH = Math.max(400, placed.reduce((m, r) => Math.max(m, r.py + r.ph + 60), 400))

  return (
    <div style={{ paddingTop: 48, height: '100%', overflow: 'auto' }}>
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{ cursor: 'pointer', display: 'block' }}
        onClick={handleClick}
        onMouseMove={(e) => {
          const canvas = canvasRef.current
          const rect = canvas.getBoundingClientRect()
          const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
          const my = (e.clientY - rect.top) * (canvas.height / rect.height)
          const hit = placed.some(r =>
            mx >= r.px && mx <= r.px + r.pw && my >= r.py && my <= r.py + r.ph
          )
          canvas.style.cursor = hit ? 'pointer' : 'default'
        }}
      />
      <div style={{
        padding: '8px 16px', fontSize: 11, color: '#444', display: 'flex', gap: 16, flexWrap: 'wrap',
      }}>
        {Object.entries(AREA_COLORS).map(([type, col]) => (
          <span key={type} style={{ color: col.label }}>■ {type}</span>
        ))}
        <span style={{ color: '#818cf8' }}>● NPC</span>
        <span style={{ color: '#4ade80' }}>● 已招募</span>
      </div>
    </div>
  )
}

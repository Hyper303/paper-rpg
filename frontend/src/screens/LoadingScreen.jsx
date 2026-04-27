import { useEffect, useState } from 'react'

const STEPS = [
  { key: 'director', label: '解析论文，构建世界圣经' },
  { key: 'story_map', label: '生成叙事与地图' },
  { key: 'npcs', label: '召唤 NPC 角色' },
  { key: 'assembly', label: '整合世界，检查一致性' },
]

const STATUS_COLOR = {
  pending: '#444',
  running: '#ffd700',
  done: '#4ade80',
  error: '#f87171',
}

export default function LoadingScreen({ pdfFile, questionnaire, onReady }) {
  const [stepStatus, setStepStatus] = useState({})
  const [log, setLog] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const formData = new FormData()
    formData.append('pdf_file', pdfFile)
    formData.append('questionnaire', JSON.stringify(questionnaire))

    const ctrl = new AbortController()

    fetch('/api/generate-world', {
      method: 'POST',
      body: formData,
      signal: ctrl.signal,
    }).then(async (res) => {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop()

        for (const part of parts) {
          const lines = part.trim().split('\n')
          let event = 'message', data = ''
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            if (line.startsWith('data:')) data = line.slice(5).trim()
          }
          if (!data) continue
          try {
            const parsed = JSON.parse(data)
            if (event === 'progress') {
              setStepStatus(prev => ({ ...prev, [parsed.step]: parsed.status }))
              setLog(prev => [...prev, `[${parsed.step}] ${parsed.status}`])
            } else if (event === 'world_bible') {
              setLog(prev => [...prev, `世界圣经已生成：${parsed.world?.world_name || ''}`])
            } else if (event === 'complete') {
              onReady(parsed)
            } else if (event === 'error') {
              setError(`${parsed.step}: ${parsed.message}`)
              setStepStatus(prev => ({ ...prev, [parsed.step]: 'error' }))
            }
          } catch {}
        }
      }
    }).catch((e) => {
      if (e.name !== 'AbortError') setError(String(e))
    })

    return () => ctrl.abort()
  }, [])

  return (
    <div style={{ maxWidth: 580, margin: '0 auto', padding: '80px 24px' }}>
      <h2 style={{ textAlign: 'center', color: '#ffd700', letterSpacing: 4, marginBottom: 48 }}>
        正在构建你的世界...
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {STEPS.map((step) => {
          const status = stepStatus[step.key] || 'pending'
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: STATUS_COLOR[status] || '#444',
                boxShadow: status === 'running' ? '0 0 8px #ffd700' : 'none',
                flexShrink: 0,
                animation: status === 'running' ? 'pulse 1s infinite' : 'none',
              }} />
              <div style={{
                flex: 1,
                color: status === 'pending' ? '#555' : status === 'error' ? '#f87171' : '#e8e0d0',
              }}>
                {step.label}
              </div>
              <div style={{ fontSize: 12, color: STATUS_COLOR[status] || '#444' }}>
                {status === 'running' ? '生成中...' : status === 'done' ? '完成' : status === 'error' ? '错误' : ''}
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div style={{
          marginTop: 32, padding: 16, background: 'rgba(248,113,113,0.1)',
          border: '1px solid #f87171', borderRadius: 6, color: '#f87171', fontSize: 13,
        }}>
          错误：{error}
        </div>
      )}

      <div style={{
        marginTop: 40, padding: 16, background: '#141414',
        borderRadius: 6, fontSize: 12, color: '#555',
        maxHeight: 160, overflowY: 'auto',
        fontFamily: 'monospace',
      }}>
        {log.map((l, i) => <div key={i}>&gt; {l}</div>)}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

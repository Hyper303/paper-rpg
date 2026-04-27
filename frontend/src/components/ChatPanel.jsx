import { useState, useRef, useEffect } from 'react'

const NPC_TYPE_LABEL = { A: '文献NPC', B: '概念NPC', C: '作者NPC' }

export default function ChatPanel({ npc, history, onHistoryUpdate, questionnaire, worldBible, onClose }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setLoading(true)

    const withUser = [...history, { role: 'user', content: userMsg }]
    onHistoryUpdate(withUser)

    try {
      const res = await fetch('/api/npc-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npc_data: npc,
          message: userMsg,
          history,
          player_profile: questionnaire,
          world_bible: worldBible,
        }),
      })
      const data = await res.json()
      onHistoryUpdate([...withUser, { role: 'assistant', content: data.reply }])
    } catch (e) {
      onHistoryUpdate([...withUser, { role: 'assistant', content: `[错误] ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #222',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 4,
          background: npc.type === 'C' ? '#ffd700' : npc.type === 'A' ? '#fbbf24' : '#818cf8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold', color: '#0d0d0d', fontSize: 14,
        }}>
          {npc.type}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#e8e0d0', fontWeight: 'bold', fontSize: 14 }}>{npc.name}</div>
          <div style={{ color: '#555', fontSize: 11 }}>
            {NPC_TYPE_LABEL[npc.type]} · {npc.real_reference}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #333', borderRadius: 4,
          color: '#555', padding: '4px 10px', fontSize: 12, cursor: 'pointer',
        }}>
          关闭
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {history.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '10px 14px', whiteSpace: 'pre-wrap',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? '#1a1a2a' : '#141414',
              border: `1px solid ${msg.role === 'user' ? '#3333aa' : '#222'}`,
              fontSize: 13, lineHeight: 1.7,
              color: msg.role === 'user' ? '#a0a8e0' : '#e8e0d0',
            }}>
              {msg.role === 'assistant' && (
                <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>{npc.name}</div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px', background: '#141414', border: '1px solid #222',
              borderRadius: '12px 12px 12px 2px', fontSize: 13, color: '#555',
            }}>
              <span style={{ animation: 'blink 1s infinite' }}>■■■</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Knowledge point shortcuts */}
      {npc.generated?.knowledge_points?.length > 0 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid #1a1a1a', background: '#0d0d0d', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: '#444', marginBottom: 6, letterSpacing: 1 }}>相关知识点</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {npc.generated.knowledge_points.slice(0, 4).map((kp, i) => (
              <button key={i} onClick={() => setInput(`请解释一下：${kp.name || kp}`)}
                style={{ padding: '3px 8px', background: '#141414', border: '1px solid #333', borderRadius: 3, color: '#666', fontSize: 11, cursor: 'pointer' }}>
                {kp.name || kp}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #222', display: 'flex', gap: 8, flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="向 NPC 提问... (Enter 发送)"
          rows={2}
          style={{
            flex: 1, background: '#141414', border: '1px solid #333', borderRadius: 6,
            color: '#e8e0d0', fontSize: 13, padding: '8px 12px', resize: 'none', outline: 'none', lineHeight: 1.5,
          }}
        />
        <button onClick={sendMessage} disabled={!input.trim() || loading} style={{
          padding: '0 16px',
          background: input.trim() && !loading ? '#ffd700' : '#222',
          color: input.trim() && !loading ? '#0d0d0d' : '#444',
          border: 'none', borderRadius: 6, fontWeight: 'bold', fontSize: 13,
          cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
        }}>
          发送
        </button>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
    </div>
  )
}

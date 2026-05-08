import { useState, useRef, useEffect } from 'react'

const NPC_TYPE_LABEL = { A: 'Reference NPC', B: 'Concept NPC', C: 'Author NPC' }

export default function ChatPanel({
  npc, history, onHistoryUpdate, questionnaire, worldBible,
  onClose, onRecruited, onTaskGiven, onItemGiven,
  activeTasks, inventory, crystals, allNpcs, extraContext = {},
}) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  // Task state for this NPC
  const thisNpcTask = activeTasks?.find(t => t.npc_id === npc.npc_id)
  const taskAlreadyGiven = !!thisNpcTask

  // Submittable items: delivery tasks use crystals (from NPCs), exploration tasks use inventory (from ruins)
  const hasActiveTask = !!thisNpcTask && thisNpcTask.status !== 'done' && !npc._recruited
    && (thisNpcTask.type === 'delivery' || thisNpcTask.type === 'exploration')
  const submittableItems = hasActiveTask
    ? (thisNpcTask.type === 'delivery' ? (crystals || []) : (inventory || []))
    : []

  // Task button: hide after it's been clicked once (user sent that exact message)
  const taskButtonClicked = history.some(m => m.role === 'user' && m.content === 'Do you have a quest for me?')
  const showTaskButton = !taskButtonClicked && !taskAlreadyGiven && !npc._recruited

  // Help button: only for knowledge-type NPCs, after 2+ exchanges, if not recruited
  const questType = npc.quest_type || 'knowledge'
  const userMsgCount = history.filter(m => m.role === 'user').length
  const showHelpButton = !npc._recruited && userMsgCount >= 2 && questType === 'knowledge'

  // Cross-NPC context: is this NPC the TARGET of a delivery task from another NPC?
  const incomingTask = activeTasks?.find(t =>
    t.type === 'delivery' && t.target_npc_id === npc.npc_id && t.status === 'active'
  )
  const senderNpc = incomingTask ? allNpcs?.find(n => n.npc_id === incomingTask.npc_id) : null
  const senderTopic = senderNpc?.quest_target_topic || ''

  // Cross-NPC context: if this NPC is a delivery/exploration GIVER, show what to report
  const giverTask = thisNpcTask?.type === 'delivery' ? thisNpcTask : null
  const targetNpcName = giverTask?.target_npc_id
    ? (allNpcs?.find(n => n.npc_id === giverTask.target_npc_id)?.name || '')
    : ''

  async function sendMessage(overrideInput, forceComplete = false) {
    const userMsg = (overrideInput ?? input).trim()
    if (!userMsg || loading) return
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
          extra_context: extraContext,
          force_complete: forceComplete,
        }),
      })
      const data = await res.json()
      onHistoryUpdate([...withUser, { role: 'assistant', content: data.reply }])

      if (data.task_given) {
        onTaskGiven?.(npc.npc_id, npc.name, data.task_given)
      }
      if (data.item_given) {
        onItemGiven?.({ ...data.item_given, from_npc_id: npc.npc_id, from_npc_name: npc.name })
      }
      if (data.task_complete) {
        onRecruited?.(npc.npc_id)
      }
    } catch (e) {
      onHistoryUpdate([...withUser, { role: 'assistant', content: `[Error] ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
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
          <div style={{ color: '#e8e0d0', fontWeight: 'bold', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            {npc.name}
            {npc._recruited && <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 'normal' }}>✅ Recruited</span>}
          </div>
          <div style={{ color: '#555', fontSize: 11 }}>
            {NPC_TYPE_LABEL[npc.type]} · {npc.real_reference}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #333', borderRadius: 4,
          color: '#555', padding: '4px 10px', fontSize: 12, cursor: 'pointer',
        }}>
          Close
        </button>
      </div>

      {/* Cross-NPC hint: someone sent player here */}
      {senderNpc && (
        <div style={{
          padding: '7px 16px', flexShrink: 0,
          background: '#0d1a0d', borderBottom: '1px solid #2a4a2a',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 12, flexShrink: 0 }}>💡</span>
          <div style={{ fontSize: 11, color: '#86efac', lineHeight: 1.5 }}>
            <span style={{ color: '#4ade80' }}>{senderNpc.name}</span> asked you to learn about:
            <span style={{ color: '#e8e0d0' }}>{senderTopic}</span>
          </div>
        </div>
      )}

      {/* Cross-NPC hint: player is reporting back to delivery giver */}
      {giverTask && giverTask.status === 'active' && targetNpcName && (
        <div style={{
          padding: '7px 16px', flexShrink: 0,
          background: '#1a0d0d', borderBottom: '1px solid #4a2a2a',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 12, flexShrink: 0 }}>📋</span>
          <div style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.5 }}>
            Report back to them: share what you learned from <span style={{ color: '#fcd34d' }}>{targetNpcName}</span>
          </div>
        </div>
      )}

      {/* Active task banner */}
      {thisNpcTask && (
        <div style={{
          padding: '8px 16px', flexShrink: 0,
          background: thisNpcTask.status === 'done' ? '#0d1a0d' : '#0d0d1a',
          borderBottom: `1px solid ${thisNpcTask.status === 'done' ? '#2a4a2a' : '#2a2a4a'}`,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: thisNpcTask.status === 'done' ? '#4ade80' : '#818cf8', flexShrink: 0, marginTop: 1 }}>
            {thisNpcTask.status === 'done' ? '✅' : thisNpcTask.type === 'delivery' ? '📦' : '📖'}
          </span>
          <div>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>
              {thisNpcTask.status === 'done' ? 'Quest complete' : 'Quest in progress'}
            </div>
            <div style={{ fontSize: 12, color: thisNpcTask.status === 'done' ? '#4ade80' : '#818cf8', lineHeight: 1.5 }}>
              {thisNpcTask.text}
            </div>
          </div>
        </div>
      )}

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

      {/* Action shortcuts row */}
      <div style={{ flexShrink: 0 }}>

        {/* Submit inventory items when active task exists */}
        {submittableItems.length > 0 && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid #1a1a1a', background: '#0d0d0d' }}>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 6, letterSpacing: 1 }}>Submit item</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {submittableItems.map(item => (
                <button
                  key={item.item_id}
                  onClick={() => sendMessage(`I've brought "${item.name}" — is this what you need?`)}
                  style={{
                    padding: '6px 12px', background: '#141414',
                    border: '1px solid #2a3a2a', borderRadius: 4, color: '#86efac',
                    fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  📦 {item.name}
                  {item.from_npc_name && (
                    <span style={{ color: '#444', marginLeft: 6 }}>from: {item.from_npc_name}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Get task button — hide after clicked once */}
        {showTaskButton && (
          <div style={{ padding: '6px 16px', borderTop: '1px solid #1a1a1a', background: '#0d0d0d' }}>
            <button
              onClick={() => sendMessage('Do you have a quest for me?')}
              style={{
                width: '100%', padding: '6px 12px', background: '#141414',
                border: '1px solid #333', borderRadius: 4, color: '#ffd700',
                fontSize: 12, cursor: 'pointer', textAlign: 'left',
              }}
            >
              ❓ Do you have a quest for me?
            </button>
          </div>
        )}

        {/* Proactive help button — after 2+ exchanges if not recruited */}
        {showHelpButton && (
          <div style={{ padding: '6px 16px', borderTop: '1px solid #1a1a1a', background: '#0d0d0d' }}>
            <button
              onClick={() => sendMessage("I'm still a bit confused — could you explain it once more in the simplest way?", true)}
              style={{
                width: '100%', padding: '6px 12px', background: '#141414',
                border: '1px solid #2a2a4a', borderRadius: 4, color: '#818cf8',
                fontSize: 12, cursor: 'pointer', textAlign: 'left',
              }}
            >
              💡 I'm still confused — could you explain it again?
            </button>
          </div>
        )}

        {/* Knowledge point shortcuts */}
        {npc.generated?.knowledge_points?.length > 0 && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid #1a1a1a', background: '#0d0d0d' }}>
            <div style={{ fontSize: 10, color: '#444', marginBottom: 6, letterSpacing: 1 }}>Related topics</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {npc.generated.knowledge_points.slice(0, 4).map((kp, i) => (
                <button key={i} onClick={() => setInput(`Please explain: ${kp.name || kp}`)}
                  style={{ padding: '3px 8px', background: '#141414', border: '1px solid #333', borderRadius: 3, color: '#666', fontSize: 11, cursor: 'pointer' }}>
                  {kp.name || kp}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #222', display: 'flex', gap: 8, flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the NPC... (Enter to send)"
          rows={2}
          style={{
            flex: 1, background: '#141414', border: '1px solid #333', borderRadius: 6,
            color: '#e8e0d0', fontSize: 13, padding: '8px 12px', resize: 'none', outline: 'none', lineHeight: 1.5,
          }}
        />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{
          padding: '0 16px',
          background: input.trim() && !loading ? '#ffd700' : '#222',
          color: input.trim() && !loading ? '#0d0d0d' : '#444',
          border: 'none', borderRadius: 6, fontWeight: 'bold', fontSize: 13,
          cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
        }}>
          Send
        </button>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
    </div>
  )
}

import { useState } from 'react'

const STATE_DOT = {
  recruited: { color: '#4ade80', label: 'Recruited', dot: '●' },
  talking:   { color: '#ffd700', label: 'Quest in progress', dot: '●' },
  untouched: { color: '#ff4444', label: 'Not yet met', dot: '●' },
}

const TASK_TYPE_ICON = { knowledge: '📖', delivery: '📦', exploration: '🗺' }

export default function RegionInfo({
  region, allNpcs, gameState, worldBible, storyData, allRegions,
  onRequestUnlock, quizLoading, chatHistories, onRegionChange,
  activeTasks, crystals,
}) {
  const [crystalsOpen, setCrystalsOpen] = useState(false)

  if (!region) return (
    <div style={{ padding: 32, color: '#444', textAlign: 'center', marginTop: 80 }}>
      Use WASD to explore the map
    </div>
  )

  const npcsHere = (region.npcs_here || [])
    .map(id => allNpcs.find(n => n.npc_id === id))
    .filter(Boolean)

  const recruited = gameState?.recruited_npcs || []

  const acts = worldBible?.acts || []
  const currentAct = acts.find(a => a.act_id === region.act_id) || acts[(region.act_id ?? 1) - 1]
  const actNarration = storyData?.act_narrations?.[region.act_id] || storyData?.act_monologues?.[region.act_id]

  const regionIdx = allRegions ? allRegions.findIndex(r => r.region_id === region.region_id) : -1
  const prevRegion = allRegions && regionIdx > 0 ? allRegions[regionIdx - 1] : null
  const nextRegion = allRegions && regionIdx >= 0 && regionIdx < allRegions.length - 1
    ? allRegions[regionIdx + 1] : null
  const nextAlreadyUnlocked = nextRegion && (gameState?.unlocked_regions || []).includes(nextRegion.region_id)

  const recruitedCount = npcsHere.filter(n => recruited.includes(n.npc_id)).length

  // Tasks for NPCs in this region
  const regionNpcIds = new Set(npcsHere.map(n => n.npc_id))
  const regionTasks = (activeTasks || []).filter(t => regionNpcIds.has(t.npc_id))
  const activePendingTasks = regionTasks.filter(t => t.status === 'active')
  const completedTasks = regionTasks.filter(t => t.status === 'done')

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 24px 32px' }}>

      {/* Back button */}
      {prevRegion && (
        <button onClick={() => onRegionChange?.(prevRegion)} style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          padding: '8px 14px', background: '#141414',
          border: '1px solid #333', borderRadius: 4,
          color: '#a09080', fontSize: 13, cursor: 'pointer', width: '100%',
        }}>
          ← Back: {prevRegion.name}
        </button>
      )}

      {/* Region header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
          {region.area_type}
        </div>
        <h2 style={{ color: '#ffd700', margin: '0 0 10px', fontSize: 20 }}>{region.name}</h2>
        <p style={{ color: '#a09080', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          {region.atmosphere || region.terrain_description}
        </p>
      </div>

      {actNarration && (
        <div style={{
          padding: '10px 14px', background: '#141414', borderLeft: '2px solid #444',
          marginBottom: 20, fontSize: 13, color: '#888', lineHeight: 1.7, fontStyle: 'italic',
        }}>
          {actNarration}
        </div>
      )}

      {/* Active tasks panel */}
      {regionTasks.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>Quest log</span>
            <span style={{ color: activePendingTasks.length > 0 ? '#ffd700' : '#4ade80' }}>
              {completedTasks.length}/{regionTasks.length} complete
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {regionTasks.map(task => (
              <div key={task.task_id} style={{
                padding: '10px 14px', borderRadius: 4,
                background: task.status === 'done' ? '#0d1a0d' : '#0d0d1a',
                border: `1px solid ${task.status === 'done' ? '#2a4a2a' : '#2a2a4a'}`,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                  {task.status === 'done' ? '✅' : TASK_TYPE_ICON[task.type] || '📋'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: task.status === 'done' ? '#4ade80' : '#818cf8', marginBottom: 3 }}>
                    {task.npc_name} · {task.type === 'delivery' ? 'Delivery quest' : task.type === 'exploration' ? 'Exploration quest' : 'Knowledge quest'}
                  </div>
                  <div style={{ fontSize: 12, color: task.status === 'done' ? '#6a9a6a' : '#a0a8d8', lineHeight: 1.5 }}>
                    {task.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main quest (world bible flavor text, collapsed by default) */}
      {currentAct?.main_quest && (
        <div style={{
          marginBottom: 20, padding: '10px 14px',
          background: '#0f1a0f', border: '1px solid #2a4a2a', borderRadius: 6,
          fontSize: 12, color: '#6a9a6a', lineHeight: 1.6, fontStyle: 'italic',
        }}>
          {currentAct.main_quest}
        </div>
      )}

      {/* NPC roster */}
      {npcsHere.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>Area residents</span>
            <span style={{ color: recruitedCount === npcsHere.length ? '#4ade80' : '#555' }}>
              {recruitedCount}/{npcsHere.length} recruited
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {npcsHere.map(npc => {
              const isRecruited = recruited.includes(npc.npc_id)
              const hasTalked = (chatHistories?.[npc.npc_id] || []).some(m => m.role === 'user')
              const hasTask = (activeTasks || []).some(t => t.npc_id === npc.npc_id && t.status === 'active')
              const stateKey = isRecruited ? 'recruited' : (hasTalked || hasTask) ? 'talking' : 'untouched'
              const state = STATE_DOT[stateKey]
              return (
                <div key={npc.npc_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: '#141414',
                  border: `1px solid ${isRecruited ? '#2a4a2a' : '#222'}`,
                  borderRadius: 4,
                }}>
                  <span style={{ color: state.color, fontSize: 10, flexShrink: 0 }}>{state.dot}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e8e0d0', fontSize: 13 }}>{npc.name}</div>
                    <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>{npc.role_in_story}</div>
                  </div>
                  <div style={{ color: state.color, fontSize: 11, flexShrink: 0 }}>{state.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Knowledge Crystals */}
      {crystals?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setCrystalsOpen(v => !v)}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', background: '#141414', border: '1px solid #2a2a4a', borderRadius: 4,
              color: '#818cf8', fontSize: 11, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 2,
            }}
          >
            <span>✦ Knowledge Crystals ({crystals.length})</span>
            <span>{crystalsOpen ? '▲' : '▼'}</span>
          </button>
          {crystalsOpen && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {crystals.map(crystal => (
                <div key={crystal.item_id} style={{
                  padding: '10px 12px', background: '#0d0d1a',
                  border: '1px solid #2a2a5a', borderRadius: 4,
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>✦</span>
                  <div>
                    <div style={{ color: '#a5b4fc', fontSize: 12, fontWeight: 'bold', marginBottom: 3 }}>{crystal.name}</div>
                    <div style={{ color: '#666', fontSize: 11, lineHeight: 1.5 }}>{crystal.description}</div>
                    <div style={{ color: '#4a4a6a', fontSize: 10, marginTop: 3 }}>from {crystal.from_npc_name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exit hint / next region */}
      <div style={{
        padding: '12px 14px', background: '#0d0d0d',
        border: '1px solid #222', borderRadius: 6, fontSize: 12,
      }}>
        {nextAlreadyUnlocked ? (
          <div style={{ color: '#4ade80' }}>
            ✅ Next region unlocked: {nextRegion?.name}. Walk to the exit on the map to teleport there.
          </div>
        ) : nextRegion ? (
          <>
            <div style={{ color: '#555', marginBottom: 8, lineHeight: 1.6 }}>
              Recruited {recruitedCount}/{npcsHere.length} residents.
              Walk to the green exit at the bottom of the map and press <span style={{ color: '#ffd700' }}>[E]</span> to take the region quiz and unlock the next region.
            </div>
            <div style={{ color: '#666', fontSize: 11 }}>
              Recruit more NPCs → get more hints during the quiz
            </div>
          </>
        ) : (
          <div style={{ color: '#555' }}>This is the final region.</div>
        )}
      </div>

    </div>
  )
}

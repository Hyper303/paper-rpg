const NPC_TYPE_COLOR = { A: '#fbbf24', B: '#818cf8', C: '#ffd700' }

export default function RegionInfo({
  region, allNpcs, gameState, worldBible, storyData, onNpcClick,
  onRequestUnlock, quizLoading, allRegions, chatHistories,
}) {
  if (!region) return (
    <div style={{ padding: 32, color: '#444', textAlign: 'center', marginTop: 80 }}>
      点击地图上的区域开始探索
    </div>
  )

  const npcsHere = (region.npcs_here || [])
    .map(id => allNpcs.find(n => n.npc_id === id))
    .filter(Boolean)

  const unlocked = gameState?.unlocked_npcs || []
  const recruited = gameState?.recruited_npcs || []

  const acts = worldBible?.acts || []
  const currentAct = acts.find(a => a.act_id === region.act_id) || acts[region.act_id - 1]

  const actNarration = storyData?.act_narrations?.[region.act_id]
    || storyData?.act_monologues?.[region.act_id]

  const regionIdx = allRegions ? allRegions.findIndex(r => r.region_id === region.region_id) : -1
  const nextRegion = allRegions && regionIdx >= 0 && regionIdx < allRegions.length - 1
    ? allRegions[regionIdx + 1]
    : null
  const nextAlreadyUnlocked = nextRegion && (gameState?.unlocked_regions || []).includes(nextRegion.region_id)

  // Gate: player must have sent at least one message to each unlocked NPC in this region
  const unlockedNpcsHere = npcsHere.filter(npc => unlocked.includes(npc.npc_id))
  const talkedToAll = unlockedNpcsHere.length > 0 && unlockedNpcsHere.every(npc => {
    const hist = chatHistories?.[npc.npc_id] || []
    return hist.some(m => m.role === 'user')
  })

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 24px 24px' }}>

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

      {/* Quest panel */}
      {currentAct && (
        <div style={{
          marginBottom: 20, padding: '14px 16px',
          background: '#0f1a0f', border: '1px solid #2a4a2a', borderRadius: 6,
        }}>
          <div style={{ fontSize: 11, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            主线任务
          </div>
          <div style={{ color: '#e8e0d0', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            {currentAct.main_quest}
          </div>

          {currentAct.side_quests?.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
                支线任务
              </div>
              {currentAct.side_quests.map((q, i) => (
                <div key={i} style={{ color: '#666', fontSize: 12, lineHeight: 1.6, paddingLeft: 8, borderLeft: '1px solid #333', marginBottom: 4 }}>
                  {q}
                </div>
              ))}
            </>
          )}

          {/* Unlock next region */}
          {nextRegion && (
            <div style={{ marginTop: 14 }}>
              {nextAlreadyUnlocked ? (
                <div style={{
                  padding: '8px 10px', background: '#0a0f0a', borderRadius: 4,
                  fontSize: 12, color: '#4ade80', lineHeight: 1.5,
                }}>
                  已解锁下一区域：{nextRegion.name}，点击地图前往。
                </div>
              ) : (
                <>
                  {!talkedToAll && unlockedNpcsHere.length > 0 && (
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 8, lineHeight: 1.5 }}>
                      与本区域所有 NPC 对话后可前往下一区域（还剩{' '}
                      {unlockedNpcsHere.filter(npc => !(chatHistories?.[npc.npc_id] || []).some(m => m.role === 'user')).length}
                      {' '}位未对话）
                    </div>
                  )}
                  <button
                    onClick={talkedToAll && !quizLoading ? onRequestUnlock : undefined}
                    disabled={!talkedToAll || quizLoading}
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: talkedToAll ? '#0f2a0f' : '#111',
                      border: `1px solid ${talkedToAll ? '#4ade80' : '#2a2a2a'}`,
                      borderRadius: 4,
                      color: talkedToAll ? '#4ade80' : '#333',
                      fontSize: 13, fontWeight: 'bold',
                      cursor: talkedToAll && !quizLoading ? 'pointer' : 'not-allowed',
                      letterSpacing: 1, transition: 'all 0.2s',
                    }}
                  >
                    {quizLoading ? '生成测验中...' : `前往下一区域：${nextRegion.name} →`}
                  </button>
                </>
              )}
            </div>
          )}

          {!nextRegion && (
            <div style={{
              marginTop: 12, padding: '8px 10px', background: '#0a0f0a', borderRadius: 4,
              fontSize: 12, color: '#555',
            }}>
              这是最后一个区域。
            </div>
          )}
        </div>
      )}

      {/* Explorable elements */}
      {region.explorable_elements?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            可探索元素
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {region.explorable_elements.map((el, i) => (
              <div key={el.element_id || i} style={{
                padding: '10px 14px', background: '#141414',
                border: '1px solid #222', borderRadius: 4, fontSize: 12,
              }}>
                <div style={{ color: '#a09080', marginBottom: 4 }}>[{el.type}] {el.name}</div>
                <div style={{ color: '#666' }}>{el.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NPCs */}
      {npcsHere.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            NPC
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {npcsHere.map(npc => {
              const isUnlocked = unlocked.includes(npc.npc_id)
              const isRecruited = recruited.includes(npc.npc_id)
              const hasTalked = (chatHistories?.[npc.npc_id] || []).some(m => m.role === 'user')
              return (
                <button key={npc.npc_id} onClick={() => isUnlocked && onNpcClick(npc)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', background: isUnlocked ? '#141414' : '#0d0d0d',
                  border: `1px solid ${isUnlocked ? (hasTalked ? '#2a4a2a' : '#333') : '#222'}`,
                  borderRadius: 4, cursor: isUnlocked ? 'pointer' : 'not-allowed',
                  textAlign: 'left', width: '100%', opacity: isUnlocked ? 1 : 0.4,
                  transition: 'border-color 0.2s',
                }}
                  onMouseEnter={e => isUnlocked && (e.currentTarget.style.borderColor = '#555')}
                  onMouseLeave={e => isUnlocked && (e.currentTarget.style.borderColor = hasTalked ? '#2a4a2a' : '#333')}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                    background: NPC_TYPE_COLOR[npc.type] || '#444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', color: '#0d0d0d', fontSize: 14,
                  }}>
                    {npc.type}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e8e0d0', fontSize: 13, fontWeight: 'bold' }}>
                      {npc.name}
                      {isRecruited && <span style={{ color: '#4ade80', fontSize: 11, marginLeft: 8 }}>已招募</span>}
                      {hasTalked && !isRecruited && <span style={{ color: '#4ade80', fontSize: 11, marginLeft: 8 }}>✓ 已对话</span>}
                    </div>
                    <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{npc.role_in_story}</div>
                  </div>
                  {isUnlocked && <div style={{ color: '#555', fontSize: 12 }}>对话 →</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

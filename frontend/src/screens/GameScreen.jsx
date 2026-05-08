import { useState, useEffect } from 'react'
import PhaserGame from '../game/PhaserGame'
import ChatPanel from '../components/ChatPanel'
import RegionInfo from '../components/RegionInfo'
import QuizModal from '../components/QuizModal'

export default function GameScreen({ gameData, questionnaire }) {
  const [gameState, setGameState] = useState(null)
  const [activeNpc, setActiveNpc] = useState(null)
  const [activeRegion, setActiveRegion] = useState(null)
  const [chatHistories, setChatHistories] = useState({})  // npc_id -> messages[]
  const [quiz, setQuiz] = useState(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [pendingNextRegion, setPendingNextRegion] = useState(null)
  const [inventory, setInventory] = useState([])    // exploration items from ruins (for delivery to exploration-task NPCs)
  const [crystals, setCrystals] = useState([])       // knowledge crystals from NPC recruitment (displayed in region panel)
  const [activeTasks, setActiveTasks] = useState([]) // [{task_id, npc_id, npc_name, type, text, target_npc_id?, status}]

  useEffect(() => {
    fetch('/api/init-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_data: gameData }),
    })
      .then(r => r.json())
      .then(({ game_state }) => {
        setGameState(game_state)
        const mapData = gameData.map || gameData.map_data || {}
        const startId = mapData?.special_locations?.start
        const regions = mapData?.regions || []
        const startRegion = regions.find(r => r.region_id === startId) || regions[0]
        setActiveRegion(startRegion)
      })
  }, [gameData])

  function handleNpcClick(npc) {
    setActiveNpc(npc)
    if (!chatHistories[npc.npc_id]) {
      const opening = npc?.generated?.opening_line
      setChatHistories(prev => ({
        ...prev,
        [npc.npc_id]: opening ? [{ role: 'assistant', content: opening }] : [],
      }))
    }
  }

  function handleHistoryUpdate(npcId, newMessages) {
    setChatHistories(prev => ({ ...prev, [npcId]: newMessages }))
  }

  function handleNpcRecruited(npcId) {
    setGameState(prev => ({
      ...prev,
      recruited_npcs: [...new Set([...(prev.recruited_npcs || []), npcId])],
    }))
    setActiveTasks(prev => prev.map(t =>
      t.npc_id === npcId ? { ...t, status: 'done' } : t
    ))
  }

  function handleTaskGiven(npcId, npcName, taskData) {
    setActiveTasks(prev => {
      if (prev.some(t => t.npc_id === npcId)) return prev  // dedup by npc_id
      return [...prev, { ...taskData, task_id: `task_${npcId}`, npc_id: npcId, npc_name: npcName, status: 'active' }]
    })
  }

  function handleItemGiven(item) {
    if (item.from_npc_id) {
      // NPC-given knowledge crystal
      setCrystals(prev => prev.some(c => c.item_id === item.item_id) ? prev : [...prev, item])
    } else {
      // Exploration item from ruin
      setInventory(prev => prev.some(i => i.item_id === item.item_id) ? prev : [...prev, item])
    }
  }

  function handleExplorationPickup(ruinId, item) {
    handleItemGiven(item)
  }

  function handleCloseChat() {
    setActiveNpc(null)
  }

  async function handleRequestUnlock() {
    const regions = (gameData.map || gameData.map_data)?.regions || []
    const idx = regions.findIndex(r => r.region_id === activeRegion?.region_id)
    if (idx === -1 || idx >= regions.length - 1) return
    const nextRegion = regions[idx + 1]

    if (gameState.unlocked_regions?.includes(nextRegion.region_id)) {
      setActiveRegion(nextRegion)
      setActiveNpc(null)
      return
    }

    setPendingNextRegion(nextRegion)
    setQuizLoading(true)

    const acts = gameData.world_bible?.acts || []
    const currentAct = acts.find(a => a.act_id === activeRegion?.act_id) || acts[idx] || {}
    const npcsInRegion = allNpcs.filter(n => activeRegion?.npcs_here?.includes(n.npc_id))

    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ act_data: currentAct, npcs: npcsInRegion }),
      })
      const data = await res.json()
      setQuiz(data)
    } catch (e) {
      doUnlock(nextRegion)
    } finally {
      setQuizLoading(false)
    }
  }

  function handleQuizProceed() {
    doUnlock(pendingNextRegion)
    setQuiz(null)
    setPendingNextRegion(null)
  }

  function doUnlock(nextRegion) {
    if (!nextRegion) return
    const npcsToUnlock = nextRegion.npcs_here || []
    setGameState(prev => ({
      ...prev,
      unlocked_regions: [...new Set([...prev.unlocked_regions, nextRegion.region_id])],
      unlocked_npcs: [...new Set([...prev.unlocked_npcs, ...npcsToUnlock])],
    }))
    setActiveRegion(nextRegion)
    setActiveNpc(null)
  }

  if (!gameState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#ffd700' }}>
        Initializing game...
      </div>
    )
  }

  const worldBible = gameData.world_bible
  const allNpcs = gameData.npcs || []
  const allRegions = (gameData.map || gameData.map_data)?.regions || []

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left: Phaser game */}
      <div style={{ flex: '0 0 55%', position: 'relative', borderRight: '1px solid #222' }}>
        <PhaserGame
          activeRegion={activeRegion}
          allNpcs={allNpcs}
          gameState={gameState}
          chatHistories={chatHistories}
          onNpcInteract={handleNpcClick}
          onExitReached={handleRequestUnlock}
          onChatClose={handleCloseChat}
          onExplorationPickup={handleExplorationPickup}
        />
      </div>

      {/* Right: info / chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeNpc ? (
          <ChatPanel
            npc={{ ...activeNpc, _recruited: gameState.recruited_npcs?.includes(activeNpc.npc_id) }}
            history={chatHistories[activeNpc.npc_id] || []}
            onHistoryUpdate={(msgs) => handleHistoryUpdate(activeNpc.npc_id, msgs)}
            questionnaire={questionnaire}
            worldBible={worldBible}
            onClose={handleCloseChat}
            onRecruited={handleNpcRecruited}
            onTaskGiven={handleTaskGiven}
            onItemGiven={handleItemGiven}
            activeTasks={activeTasks}
            inventory={inventory}
            crystals={crystals}
            allNpcs={allNpcs}
            extraContext={
              activeNpc.quest_type === 'delivery' && activeNpc.quest_target_npc
                ? {
                    target_npc_history: chatHistories[activeNpc.quest_target_npc] || [],
                    target_npc_name: allNpcs.find(n => n.npc_id === activeNpc.quest_target_npc)?.name || '',
                  }
                : {}
            }
          />
        ) : (
          <RegionInfo
            region={activeRegion}
            allNpcs={allNpcs}
            gameState={gameState}
            worldBible={worldBible}
            storyData={gameData.story}
            onNpcClick={handleNpcClick}
            onRequestUnlock={handleRequestUnlock}
            quizLoading={quizLoading}
            allRegions={allRegions}
            chatHistories={chatHistories}
            onRegionChange={(region) => { setActiveRegion(region); setActiveNpc(null) }}
            activeTasks={activeTasks}
            crystals={crystals}
          />
        )}
      </div>

      {quizLoading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 99,
        }}>
          <div style={{ fontSize: 28, color: '#ffd700', marginBottom: 16, letterSpacing: 4, animation: 'quizPulse 1.2s infinite' }}>
            ■ ■ ■
          </div>
          <div style={{ color: '#888', fontSize: 13, letterSpacing: 2 }}>Generating region quiz...</div>
          <style>{`@keyframes quizPulse { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
        </div>
      )}

      {quiz && (
        <QuizModal
          quizData={quiz}
          npcs={allNpcs.filter(n => activeRegion?.npcs_here?.includes(n.npc_id))}
          recruitedNpcIds={gameState.recruited_npcs || []}
          onProceed={handleQuizProceed}
          onClose={() => { setQuiz(null); setPendingNextRegion(null) }}
        />
      )}
    </div>
  )
}

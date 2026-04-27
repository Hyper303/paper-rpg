import { useState, useEffect } from 'react'
import MapPanel from '../components/MapPanel'
import ChatPanel from '../components/ChatPanel'
import RegionInfo from '../components/RegionInfo'
import QuizModal from '../components/QuizModal'

export default function GameScreen({ gameData, questionnaire }) {
  const [gameState, setGameState] = useState(null)
  const [activeNpc, setActiveNpc] = useState(null)
  const [activeRegion, setActiveRegion] = useState(null)
  const [chatHistories, setChatHistories] = useState({})  // npc_id -> messages[]
  const [quiz, setQuiz] = useState(null)      // null | {question, options, correct, explanation, selectedAnswer}
  const [quizLoading, setQuizLoading] = useState(false)
  const [pendingNextRegion, setPendingNextRegion] = useState(null)

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

  function handleRegionClick(region) {
    if (!gameState) return
    if (!gameState.unlocked_regions.includes(region.region_id)) return
    setActiveRegion(region)
    setActiveNpc(null)
  }

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

  function handleCloseChat() {
    setActiveNpc(null)
  }

  async function handleRequestUnlock() {
    const regions = (gameData.map || gameData.map_data)?.regions || []
    const idx = regions.findIndex(r => r.region_id === activeRegion?.region_id)
    if (idx === -1 || idx >= regions.length - 1) return
    const nextRegion = regions[idx + 1]
    setPendingNextRegion(nextRegion)
    setQuizLoading(true)

    // Find current act data for the quiz
    const acts = gameData.world_bible?.acts || []
    const currentAct = acts.find(a => a.act_id === activeRegion?.act_id) || acts[idx] || {}

    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ act_data: currentAct }),
      })
      const data = await res.json()
      setQuiz({ ...data, selectedAnswer: null })
    } catch (e) {
      // Fallback: skip quiz and unlock directly
      doUnlock(nextRegion)
    } finally {
      setQuizLoading(false)
    }
  }

  function handleQuizAnswer(answer) {
    setQuiz(prev => ({ ...prev, selectedAnswer: answer }))
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
        初始化游戏...
      </div>
    )
  }

  const worldBible = gameData.world_bible
  const allNpcs = gameData.npcs || []
  const allRegions = (gameData.map || gameData.map_data)?.regions || []

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left: map */}
      <div style={{ flex: '0 0 55%', position: 'relative', borderRight: '1px solid #222' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '12px 16px', background: 'rgba(0,0,0,0.8)',
          borderBottom: '1px solid #222', zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ color: '#ffd700', fontWeight: 'bold', letterSpacing: 2 }}>
            {worldBible?.world?.world_name || 'WORLD'}
          </span>
          <span style={{ color: '#555', fontSize: 12 }}>|</span>
          <span style={{ color: '#a09080', fontSize: 12 }}>
            {activeRegion?.name || ''}
          </span>
        </div>

        <MapPanel
          mapData={gameData.map}
          gameState={gameState}
          allNpcs={allNpcs}
          activeRegion={activeRegion}
          onRegionClick={handleRegionClick}
          onNpcClick={handleNpcClick}
        />
      </div>

      {/* Right: info / chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeNpc ? (
          <ChatPanel
            npc={activeNpc}
            history={chatHistories[activeNpc.npc_id] || []}
            onHistoryUpdate={(msgs) => handleHistoryUpdate(activeNpc.npc_id, msgs)}
            questionnaire={questionnaire}
            worldBible={worldBible}
            onClose={handleCloseChat}
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
          />
        )}
      </div>

      {quiz && (
        <QuizModal
          quiz={quiz}
          nextRegionName={pendingNextRegion?.name || '下一区域'}
          onAnswer={handleQuizAnswer}
          onProceed={handleQuizProceed}
        />
      )}
    </div>
  )
}

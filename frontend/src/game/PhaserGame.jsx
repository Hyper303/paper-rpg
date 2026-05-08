import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import GameScene from './GameScene'

export default function PhaserGame({
  activeRegion,
  allNpcs,
  gameState,
  chatHistories,
  onNpcInteract,
  onExitReached,
  onChatClose,
  onExplorationPickup,
}) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)

  // Keep callbacks in refs so Phaser always sees the latest version
  const onNpcInteractRef = useRef(onNpcInteract)
  const onExitReachedRef = useRef(onExitReached)
  const onChatCloseRef = useRef(onChatClose)
  const onExplorationPickupRef = useRef(onExplorationPickup)
  useEffect(() => { onNpcInteractRef.current = onNpcInteract }, [onNpcInteract])
  useEffect(() => { onExitReachedRef.current = onExitReached }, [onExitReached])
  useEffect(() => { onChatCloseRef.current = onChatClose }, [onChatClose])
  useEffect(() => { onExplorationPickupRef.current = onExplorationPickup }, [onExplorationPickup])

  // Mount Phaser once
  useEffect(() => {
    if (!containerRef.current) return

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: '#0a0a0a',
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false },
      },
      scene: [GameScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    }

    const game = new Phaser.Game(config)
    gameRef.current = game

    game.registry.set('onNpcInteract', (npc) => onNpcInteractRef.current?.(npc))
    game.registry.set('onExitReached', () => onExitReachedRef.current?.())
    game.registry.set('onChatClose', () => onChatCloseRef.current?.())
    game.registry.set('onExplorationPickup', (ruinId, item) => onExplorationPickupRef.current?.(ruinId, item))
    game.registry.set('collectedRuins', [])

    game.registry.set('activeRegion', activeRegion)
    game.registry.set('allNpcs', allNpcs)
    game.registry.set('gameState', gameState)
    game.registry.set('chatHistories', chatHistories)

    return () => { game.destroy(true) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Restart scene when the active region changes
  useEffect(() => {
    const game = gameRef.current
    if (!game) return
    game.registry.set('activeRegion', activeRegion)
    game.registry.set('allNpcs', allNpcs)
    game.registry.set('gameState', gameState)
    game.registry.set('chatHistories', chatHistories)
    const scene = game.scene.getScene('GameScene')
    if (scene?.scene.isActive()) scene.scene.restart()
  }, [activeRegion?.region_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync NPC dot colors when chat/recruit state changes (without restarting scene)
  // Use string keys so React detects element-level changes, not just reference changes
  const recruitedKey = (gameState?.recruited_npcs || []).join(',')
  const historyKey = Object.entries(chatHistories).map(([k, v]) => `${k}:${v.length}`).join(',')
  useEffect(() => {
    const game = gameRef.current
    if (!game) return
    game.registry.set('gameState', gameState)
    game.registry.set('chatHistories', chatHistories)
    const scene = game.scene.getScene('GameScene')
    if (scene?.scene.isActive() && scene.refreshNpcDots) scene.refreshNpcDots()
  }, [recruitedKey, historyKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  )
}

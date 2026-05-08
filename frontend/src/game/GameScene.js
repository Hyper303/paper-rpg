import Phaser from 'phaser'
import { generateMap, THEME, TILE, TILE_SIZE, MAP_W, MAP_H, RUIN_LOOT } from './mapGenerator'

const PLAYER_SPEED = 160
const INTERACT_RADIUS = 52

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const activeRegion = this.registry.get('activeRegion') || {}
    const allNpcs = this.registry.get('allNpcs') || []
    const gameState = this.registry.get('gameState') || {}
    const chatHistories = this.registry.get('chatHistories') || {}

    this.onNpcInteract = this.registry.get('onNpcInteract')
    this.onExitReached = this.registry.get('onExitReached')
    this.onChatClose = this.registry.get('onChatClose')
    this.onExplorationPickup = this.registry.get('onExplorationPickup')
    this.activeChatNpcId = null
    this.interactCooldown = 0

    const areaType = activeRegion.area_type || 'default'
    const npcIds = activeRegion.npcs_here || []
    const explorableElements = activeRegion.explorable_elements || []
    const theme = THEME[areaType] || THEME.default
    const mapData = generateMap(areaType, npcIds, explorableElements)
    this.mapData = mapData

    const worldW = MAP_W * TILE_SIZE
    const worldH = MAP_H * TILE_SIZE
    this.physics.world.setBounds(0, 0, worldW, worldH)

    this._makeTextures(theme)
    this._buildTiles(mapData)

    // Player
    const sx = mapData.playerSpawn.x * TILE_SIZE + TILE_SIZE / 2
    const sy = mapData.playerSpawn.y * TILE_SIZE + TILE_SIZE / 2
    this.player = this.physics.add.sprite(sx, sy, 'player')
    this.player.setCollideWorldBounds(true).setDepth(10)
    this.physics.add.collider(this.player, this.walls)

    // NPCs
    this.npcObjects = []
    for (const pos of mapData.npcPositions) {
      const npc = allNpcs.find(n => n.npc_id === pos.npcId)
      if (!npc) continue
      const hasChat = (chatHistories[pos.npcId]?.length || 0) > 0
      const recruited = gameState.recruited_npcs?.includes(pos.npcId)
      const state = recruited ? 'green' : hasChat ? 'yellow' : 'red'
      const px = pos.x * TILE_SIZE + TILE_SIZE / 2
      const py = pos.y * TILE_SIZE + TILE_SIZE / 2

      const typeKey = (npc.type || 'a').toLowerCase()
      const sprite = this.add.sprite(px, py, `npc_${typeKey}`).setDepth(9)

      const dotColor = state === 'green' ? 0x4ade80 : state === 'yellow' ? 0xffd700 : 0xff4444
      const dot = this.add.circle(px + 10, py - 16, 5, dotColor).setDepth(11)

      const nameTag = this.add.text(px, py - 28, npc.name || '', {
        fontSize: '9px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(12)

      this.npcObjects.push({ sprite, dot, nameTag, npc, px, py })
    }

    // Ruin objects
    const fallbackLoot = RUIN_LOOT[areaType] || RUIN_LOOT.default
    this.ruinObjects = []
    const collectedRuins = this.registry.get('collectedRuins') || []
    for (const pos of mapData.ruinPositions) {
      const already = collectedRuins.includes(pos.ruinId)
      const rx = pos.x * TILE_SIZE + TILE_SIZE / 2
      const ry = pos.y * TILE_SIZE + TILE_SIZE / 2
      const displayName = pos.name || '?'
      const sprite = this.add.sprite(rx, ry, 'ruin').setDepth(9).setAlpha(already ? 0.25 : 1)
      const label = this.add.text(rx, ry - 24, already ? '(explored)' : displayName, {
        fontSize: '10px', color: already ? '#444' : '#ffcc44',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(12)
      const loot = {
        name: pos.itemName || fallbackLoot.name,
        description: pos.itemDescription || fallbackLoot.description,
      }
      this.ruinObjects.push({ sprite, label, pos, ruinId: pos.ruinId, loot, collected: already, examined: false })
    }

    // Inscription overlay (camera-fixed, shown when examining a ruin)
    const overlayW = Math.min(500, this.scale.width - 40)
    const overlayH = 108
    const overlayX = this.scale.width / 2
    const overlayY = this.scale.height - overlayH / 2 - 18
    this.inscriptionOverlay = this.add.container(overlayX, overlayY)
      .setScrollFactor(0).setDepth(50).setVisible(false)
    const inscBg = this.add.rectangle(0, 0, overlayW, overlayH, 0x060606, 0.92)
    inscBg.setStrokeStyle(1, 0xffcc44, 0.6)
    this.inscTitle = this.add.text(-(overlayW / 2 - 14), -(overlayH / 2 - 10), '', {
      fontSize: '11px', color: '#ffcc44', fontStyle: 'bold',
      wordWrap: { width: overlayW - 28 },
    }).setOrigin(0, 0)
    this.inscBody = this.add.text(-(overlayW / 2 - 14), -(overlayH / 2 - 30), '', {
      fontSize: '11px', color: '#cccccc', lineSpacing: 3,
      wordWrap: { width: overlayW - 28 },
    }).setOrigin(0, 0)
    this.inscHint = this.add.text(overlayW / 2 - 14, overlayH / 2 - 10, '[ E ] Pick up item', {
      fontSize: '10px', color: '#ffd700',
    }).setOrigin(1, 1)
    this.inscriptionOverlay.add([inscBg, this.inscTitle, this.inscBody, this.inscHint])
    this.inscriptionRuin = null

    // Exit center position
    this.exitCenter = {
      x: (mapData.exitX + 1) * TILE_SIZE,
      y: (MAP_H - 1) * TILE_SIZE,
    }

    // Input — use addKey directly to avoid string-lookup issues
    const K = Phaser.Input.Keyboard.KeyCodes
    this.keys = {
      w:     this.input.keyboard.addKey(K.W),
      a:     this.input.keyboard.addKey(K.A),
      s:     this.input.keyboard.addKey(K.S),
      d:     this.input.keyboard.addKey(K.D),
      up:    this.input.keyboard.addKey(K.UP),
      down:  this.input.keyboard.addKey(K.DOWN),
      left:  this.input.keyboard.addKey(K.LEFT),
      right: this.input.keyboard.addKey(K.RIGHT),
      e:     this.input.keyboard.addKey(K.E),
      m:     this.input.keyboard.addKey(K.M),
    }

    // Interaction prompts (camera-fixed)
    this.talkPrompt = this.add.text(0, 0, '[ E ] Talk', {
      fontSize: '12px', color: '#ffd700',
      backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(30).setScrollFactor(0).setVisible(false)

    this.ruinPrompt = this.add.text(0, 0, '[ E ] Examine', {
      fontSize: '12px', color: '#ffcc44',
      backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(30).setScrollFactor(0).setVisible(false)

    this.exitPrompt = this.add.text(0, 0, '[ E ] Next Region →', {
      fontSize: '12px', color: '#4ade80',
      backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(30).setScrollFactor(0).setVisible(false)

    // Region name (camera-fixed top center)
    this.add.text(this.scale.width / 2, 14, activeRegion.name || '', {
      fontSize: '14px', color: '#ffd700', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30)

    // Camera
    this.cameras.main.setBounds(0, 0, worldW, worldH)
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)

    this.nearNpc = null
    this.nearExit = false
  }

  _makeTextures(theme) {
    const g = this.make.graphics({ add: false })
    const TS = TILE_SIZE

    // Floor
    g.clear()
    g.fillStyle(theme.floor)
    g.fillRect(0, 0, TS, TS)
    g.lineStyle(1, 0x000000, 0.15)
    g.strokeRect(0, 0, TS, TS)
    g.generateTexture('tile_floor', TS, TS)

    // Wall
    g.clear()
    g.fillStyle(theme.wall)
    g.fillRect(0, 0, TS, TS)
    g.fillStyle(0x000000, 0.3)
    g.fillRect(3, 3, TS - 6, TS - 6)
    g.generateTexture('tile_wall', TS, TS)

    // Obstacle
    g.clear()
    g.fillStyle(theme.floor)
    g.fillRect(0, 0, TS, TS)
    g.fillStyle(theme.obstacle)
    g.fillRect(4, 4, TS - 8, TS - 8)
    g.lineStyle(1, theme.accent, 0.4)
    g.strokeRect(4, 4, TS - 8, TS - 8)
    g.generateTexture('tile_obstacle', TS, TS)

    // Exit — glowing green overlay on floor
    g.clear()
    g.fillStyle(theme.floor)
    g.fillRect(0, 0, TS, TS)
    g.fillStyle(0x00ff88, 0.2)
    g.fillRect(0, 0, TS, TS)
    g.lineStyle(2, 0x00ff88, 0.9)
    g.strokeRect(1, 1, TS - 2, TS - 2)
    g.generateTexture('tile_exit', TS, TS)

    // Ruin — glowing amber overlay
    g.clear()
    g.fillStyle(theme.floor)
    g.fillRect(0, 0, TS, TS)
    g.fillStyle(theme.ruin || 0xcc8820, 0.5)
    g.fillRect(4, 4, TS - 8, TS - 8)
    g.lineStyle(2, theme.ruin || 0xcc8820, 0.9)
    g.strokeRect(4, 4, TS - 8, TS - 8)
    // Cross marker
    g.lineStyle(1, theme.ruin || 0xcc8820, 0.7)
    g.lineBetween(TS / 2, 6, TS / 2, TS - 6)
    g.lineBetween(6, TS / 2, TS - 6, TS / 2)
    g.generateTexture('tile_ruin', TS, TS)

    // Ruin sprite (larger visual marker)
    g.clear()
    g.fillStyle(theme.ruin || 0xcc8820, 0.2)
    g.fillRect(2, 2, TS - 4, TS - 4)
    g.lineStyle(2, theme.ruin || 0xcc8820, 1)
    g.strokeRect(2, 2, TS - 4, TS - 4)
    g.lineStyle(1, theme.ruin || 0xcc8820, 0.8)
    g.lineBetween(2, 2, TS - 2, TS - 2)
    g.lineBetween(TS - 2, 2, 2, TS - 2)
    g.generateTexture('ruin', TS, TS)

    // Player — blue humanoid placeholder
    g.clear()
    g.fillStyle(0x3366cc)
    g.fillRect(8, 10, 16, 18)
    g.fillStyle(0x5588ee)
    g.fillRect(9, 2, 14, 13)
    g.fillStyle(0xffcc88)
    g.fillRect(11, 4, 10, 9)
    g.generateTexture('player', TS, TS)

    // NPC sprites per type (A=blue, B=purple, C=gold)
    const npcColors = {
      a: [0x336699, 0x5588bb, 0xffcc88],
      b: [0x663399, 0x9955cc, 0xffcc88],
      c: [0xaa8800, 0xffcc00, 0xffeeaa],
    }
    for (const [type, [body, head, face]] of Object.entries(npcColors)) {
      g.clear()
      g.fillStyle(body)
      g.fillRect(8, 10, 16, 18)
      g.fillStyle(head)
      g.fillRect(9, 2, 14, 13)
      g.fillStyle(face)
      g.fillRect(11, 4, 10, 9)
      g.generateTexture(`npc_${type}`, TS, TS)
    }

    g.destroy()
  }

  _buildTiles(mapData) {
    this.walls = this.physics.add.staticGroup()

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = mapData.tiles[y][x]
        const px = x * TILE_SIZE + TILE_SIZE / 2
        const py = y * TILE_SIZE + TILE_SIZE / 2

        if (tile === TILE.FLOOR) {
          this.add.image(px, py, 'tile_floor')
        } else if (tile === TILE.WALL) {
          this.walls.create(px, py, 'tile_wall')
        } else if (tile === TILE.OBSTACLE) {
          this.add.image(px, py, 'tile_floor')
          this.walls.create(px, py, 'tile_obstacle')
        } else if (tile === TILE.EXIT) {
          this.add.image(px, py, 'tile_exit')
        } else if (tile === TILE.RUIN) {
          this.add.image(px, py, 'tile_ruin')
        }
      }
    }
  }

  _showInscription(ruinObj) {
    const pos = ruinObj.pos
    const loot = ruinObj.loot
    const title = `[ ${pos.name || 'Ruins'} ]`
    const bodyParts = []
    if (pos.description) bodyParts.push(pos.description)
    bodyParts.push(`Item found: ${loot.name}`)
    this.inscTitle.setText(title)
    this.inscBody.setText(bodyParts.join('\n'))
    this.inscriptionOverlay.setVisible(true)
    this.inscriptionRuin = ruinObj
  }

  refreshNpcDots() {
    const chatHistories = this.registry.get('chatHistories') || {}
    const gameState = this.registry.get('gameState') || {}
    for (const obj of this.npcObjects) {
      const hasChat = (chatHistories[obj.npc.npc_id]?.length || 0) > 0
      const recruited = gameState.recruited_npcs?.includes(obj.npc.npc_id)
      const dotColor = recruited ? 0x4ade80 : hasChat ? 0xffd700 : 0xff4444
      obj.dot.setFillStyle(dotColor)
    }
  }

  update(_time, delta) {
    this.interactCooldown = Math.max(0, this.interactCooldown - delta)

    // Movement
    const k = this.keys
    let vx = 0, vy = 0
    if (k.a.isDown || k.left.isDown) vx = -PLAYER_SPEED
    else if (k.d.isDown || k.right.isDown) vx = PLAYER_SPEED
    if (k.w.isDown || k.up.isDown) vy = -PLAYER_SPEED
    else if (k.s.isDown || k.down.isDown) vy = PLAYER_SPEED
    if (vx && vy) { vx *= 0.707; vy *= 0.707 }
    this.player.setVelocity(vx, vy)

    const px = this.player.x
    const py = this.player.y

    // Nearest NPC within interact radius
    this.nearNpc = null
    let minDist = INTERACT_RADIUS
    for (const obj of this.npcObjects) {
      const d = Phaser.Math.Distance.Between(px, py, obj.px, obj.py)
      if (d < minDist) { minDist = d; this.nearNpc = obj }
    }

    // Nearest uncollected ruin
    this.nearRuin = null
    let minRuinDist = INTERACT_RADIUS
    for (const obj of this.ruinObjects) {
      if (obj.collected) continue
      const rx = obj.pos.x * TILE_SIZE + TILE_SIZE / 2
      const ry = obj.pos.y * TILE_SIZE + TILE_SIZE / 2
      const d = Phaser.Math.Distance.Between(px, py, rx, ry)
      if (d < minRuinDist) { minRuinDist = d; this.nearRuin = obj }
    }

    // Near exit?
    this.nearExit = Phaser.Math.Distance.Between(
      px, py, this.exitCenter.x, this.exitCenter.y
    ) < INTERACT_RADIUS

    // Update prompts (camera-space positioning)
    const cam = this.cameras.main
    if (this.nearNpc) {
      const screenX = (this.nearNpc.px - cam.scrollX) * cam.zoom
      const screenY = (this.nearNpc.py - cam.scrollY) * cam.zoom - 44
      this.talkPrompt.setPosition(screenX, screenY).setVisible(true)
      this.exitPrompt.setVisible(false)
      this.ruinPrompt?.setVisible(false)
    } else if (this.nearRuin) {
      const rx = this.nearRuin.pos.x * TILE_SIZE + TILE_SIZE / 2
      const ry = this.nearRuin.pos.y * TILE_SIZE + TILE_SIZE / 2
      const screenX = (rx - cam.scrollX) * cam.zoom
      const screenY = (ry - cam.scrollY) * cam.zoom - 44
      const promptText = this.nearRuin.examined
        ? '[ E ] Pick up item'
        : (this.nearRuin.pos.name ? `[ E ] Examine: ${this.nearRuin.pos.name}` : '[ E ] Examine')
      this.ruinPrompt.setText(promptText).setPosition(screenX, screenY).setVisible(true)
      this.talkPrompt.setVisible(false)
      this.exitPrompt.setVisible(false)
    } else if (this.nearExit) {
      this.exitPrompt.setPosition(this.scale.width / 2, this.scale.height - 40).setVisible(true)
      this.talkPrompt.setVisible(false)
      this.ruinPrompt?.setVisible(false)
    } else {
      this.talkPrompt.setVisible(false)
      this.exitPrompt.setVisible(false)
      this.ruinPrompt?.setVisible(false)
    }

    // Auto-hide inscription overlay when player moves away from examined ruin
    if (this.inscriptionOverlay.visible && this.inscriptionRuin) {
      if (!this.nearRuin || this.nearRuin !== this.inscriptionRuin) {
        this.inscriptionOverlay.setVisible(false)
      }
    }

    // Auto-close chat when player walks away
    if (this.activeChatNpcId) {
      const chatNpc = this.npcObjects.find(o => o.npc.npc_id === this.activeChatNpcId)
      if (chatNpc) {
        const dist = Phaser.Math.Distance.Between(px, py, chatNpc.px, chatNpc.py)
        if (dist > INTERACT_RADIUS * 2.5) {
          this.activeChatNpcId = null
          this.onChatClose?.()
        }
      }
    }

    // E key interaction
    if (Phaser.Input.Keyboard.JustDown(k.e) && this.interactCooldown === 0) {
      if (this.nearNpc) {
        this.interactCooldown = 400
        this.activeChatNpcId = this.nearNpc.npc.npc_id
        this.onNpcInteract?.(this.nearNpc.npc)
      } else if (this.nearRuin) {
        if (!this.nearRuin.examined) {
          // First interaction: show inscription
          this.interactCooldown = 400
          this.nearRuin.examined = true
          this._showInscription(this.nearRuin)
        } else {
          // Second interaction: collect item
          this.interactCooldown = 600
          this.inscriptionOverlay.setVisible(false)
          this.inscriptionRuin = null
          this.nearRuin.collected = true
          this.nearRuin.sprite.setAlpha(0.25)
          this.nearRuin.label.setText('(explored)').setColor('#444')
          const item = {
            item_id: this.nearRuin.ruinId,
            name: this.nearRuin.loot.name,
            description: this.nearRuin.loot.description,
            from_npc_id: null,
            from_npc_name: this.nearRuin.pos.name || 'Exploration',
          }
          this.onExplorationPickup?.(this.nearRuin.ruinId, item)
        }
      } else if (this.nearExit) {
        this.interactCooldown = 800
        this.onExitReached?.()
      }
    }
  }
}

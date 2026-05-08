export const TILE = { FLOOR: 0, WALL: 1, OBSTACLE: 2, EXIT: 3, RUIN: 4 }
export const TILE_SIZE = 32
export const MAP_W = 40
export const MAP_H = 30

export const THEME = {
  town:    { floor: 0x3d6b35, wall: 0x5a4010, obstacle: 0x2a8030, accent: 0x90ee90, ruin: 0x88aa44 },
  ruins:   { floor: 0x4a3828, wall: 0x2a1a0a, obstacle: 0x6a5040, accent: 0xd4a030, ruin: 0xcc8820 },
  temple:  { floor: 0x383858, wall: 0x282848, obstacle: 0x5050a0, accent: 0x9090ff, ruin: 0xcc88ff },
  arena:   { floor: 0x8b7355, wall: 0x5a3a1a, obstacle: 0x7a6040, accent: 0xff6030, ruin: 0xff8844 },
  abyss:   { floor: 0x18081e, wall: 0x080810, obstacle: 0x281030, accent: 0xaa00ff, ruin: 0x8800cc },
  forge:   { floor: 0x3a1a0a, wall: 0x1a0800, obstacle: 0x602010, accent: 0xff6600, ruin: 0xffaa22 },
  library: { floor: 0x3a2a18, wall: 0x1e1408, obstacle: 0x5a4028, accent: 0xffe080, ruin: 0xffdd44 },
  default: { floor: 0x282828, wall: 0x181818, obstacle: 0x383838, accent: 0x888888, ruin: 0xaaaaaa },
}

// Items dropped by ruins, keyed by area_type
export const RUIN_LOOT = {
  library: { name: 'Ancient Tome',       description: 'A fragment of knowledge left in the library, recording lost theories' },
  ruins:   { name: 'Runic Inscription',  description: 'Ancient rune-carved information bearing the wisdom of past scholars' },
  temple:  { name: 'Temple Engraving',   description: 'An ancient truth recorded deep within the temple' },
  arena:   { name: 'Trial Chronicle',    description: 'Battle records and technique summaries preserved in the arena' },
  abyss:   { name: 'Abyss Stele',        description: 'A mysterious record discovered in the dark depths' },
  forge:   { name: 'Forge Blueprint',    description: 'A crystallization of craft knowledge and formulas left by artisans' },
  town:    { name: 'Village Journal',    description: 'A resident\'s notes on daily life and local maps' },
  default: { name: 'Mystery Fragment',   description: 'A fragment of knowledge of unknown origin' },
}

function seededRng(seed) {
  let s = seed | 0
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s ^= s >>> 16
    return (s >>> 0) / 0x100000000
  }
}

export function generateMap(areaType, npcIds = [], explorableElements = []) {
  const seed = (areaType || 'default').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)
  const rng = seededRng(seed)

  const tiles = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.FLOOR))

  // Border walls
  for (let x = 0; x < MAP_W; x++) { tiles[0][x] = TILE.WALL; tiles[MAP_H - 1][x] = TILE.WALL }
  for (let y = 0; y < MAP_H; y++) { tiles[y][0] = TILE.WALL; tiles[y][MAP_W - 1] = TILE.WALL }

  // Exit gap in bottom wall (2 tiles wide, centered)
  const exitX = Math.floor(MAP_W / 2) - 1
  tiles[MAP_H - 1][exitX] = TILE.EXIT
  tiles[MAP_H - 1][exitX + 1] = TILE.EXIT

  // Scatter obstacles (avoid top 5 rows, bottom 6 rows, edges)
  for (let i = 0; i < 40; i++) {
    const x = 2 + Math.floor(rng() * (MAP_W - 4))
    const y = 5 + Math.floor(rng() * (MAP_H - 11))
    if (tiles[y][x] === TILE.FLOOR) tiles[y][x] = TILE.OBSTACLE
  }

  // NPC positions — spread across map with randomised Y, minimum spacing enforced
  const placed = []
  const npcPositions = npcIds.map((id, i) => {
    const colW = Math.floor((MAP_W - 6) / npcIds.length)
    const colX = 3 + colW * i
    let nx, ny, attempts = 0
    do {
      nx = colX + Math.floor(rng() * Math.max(1, colW))
      ny = 6 + Math.floor(rng() * (MAP_H - 14))
      attempts++
    } while (
      attempts < 20 &&
      placed.some(p => Math.abs(p.x - nx) < 5 && Math.abs(p.y - ny) < 5)
    )
    nx = Math.max(3, Math.min(MAP_W - 4, nx))
    ny = Math.max(6, Math.min(MAP_H - 8, ny))
    placed.push({ x: nx, y: ny })
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (tiles[ny + dy]?.[nx + dx] !== undefined)
          tiles[ny + dy][nx + dx] = TILE.FLOOR
    return { x: nx, y: ny, npcId: id }
  })

  // Ruin positions — use explorable_elements if provided, else generate generic ones
  const ruinPositions = []
  const ruinCount = explorableElements.length > 0 ? explorableElements.length : 2
  for (let ri = 0; ri < ruinCount; ri++) {
    let rx, ry, attempts = 0
    do {
      rx = 3 + Math.floor(rng() * (MAP_W - 6))
      ry = 8 + Math.floor(rng() * (MAP_H - 16))
      attempts++
    } while (
      attempts < 30 && (
        placed.some(p => Math.abs(p.x - rx) < 6 && Math.abs(p.y - ry) < 6) ||
        ruinPositions.some(p => Math.abs(p.x - rx) < 8 && Math.abs(p.y - ry) < 8)
      )
    )
    rx = Math.max(3, Math.min(MAP_W - 4, rx))
    ry = Math.max(8, Math.min(MAP_H - 10, ry))
    placed.push({ x: rx, y: ry })
    // Clear 1-tile radius around ruin
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (tiles[ry + dy]?.[rx + dx] !== undefined && tiles[ry + dy][rx + dx] !== TILE.WALL)
          tiles[ry + dy][rx + dx] = TILE.FLOOR
    tiles[ry][rx] = TILE.RUIN
    const el = explorableElements[ri]
    ruinPositions.push({
      x: rx, y: ry,
      ruinId: el?.element_id || `ruin_${areaType}_${ri}`,
      name: el?.name || null,
      description: el?.description || null,
      itemName: el?.item_name || null,
      itemDescription: el?.item_description || null,
    })
  }

  // Player spawn: top center
  const spawnX = Math.floor(MAP_W / 2)
  const spawnY = 2
  for (let dy = 0; dy <= 2; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (tiles[spawnY + dy]?.[spawnX + dx] !== undefined)
        tiles[spawnY + dy][spawnX + dx] = TILE.FLOOR

  return { tiles, npcPositions, ruinPositions, playerSpawn: { x: spawnX, y: spawnY }, exitX }
}

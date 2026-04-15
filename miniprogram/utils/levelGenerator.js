const COLOR_POOL = ['red', 'blue', 'green', 'yellow', 'purple', 'orange']

const SHAPES = {
  rectangle: (w = 4, h = 4) => {
    const cells = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        cells.push({ x, y })
      }
    }
    return cells
  },
  hollowRectangle: (w = 5, h = 5) => {
    const cells = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const border = x === 0 || y === 0 || x === w - 1 || y === h - 1
        if (border) cells.push({ x, y })
      }
    }
    return cells
  },
  cross: (size = 5) => {
    const cells = []
    const mid = Math.floor(size / 2)
    for (let i = 0; i < size; i++) {
      cells.push({ x: mid, y: i })
      if (i !== mid) cells.push({ x: i, y: mid })
    }
    return cells
  },
  letterL: (w = 4, h = 5) => {
    const cells = []
    for (let y = 0; y < h; y++) cells.push({ x: 0, y })
    for (let x = 1; x < w; x++) cells.push({ x, y: h - 1 })
    return cells
  },
  letterT: (w = 5, h = 5) => {
    const cells = []
    const mid = Math.floor(w / 2)
    for (let x = 0; x < w; x++) cells.push({ x, y: 0 })
    for (let y = 1; y < h; y++) cells.push({ x: mid, y })
    return cells
  }
}

function getDifficulty(level) {
  if (level <= 3) return { colors: 3, layers: 2, complexity: 1 }
  if (level <= 6) return { colors: 4, layers: 3, complexity: 2 }
  if (level <= 10) return { colors: 4, layers: 4, complexity: 3 }

  const extra = Math.min(level - 11, 3)
  return {
    colors: Math.min(6, 5 + Math.floor((level - 11) / 3)),
    layers: Math.min(6, 5 + extra),
    complexity: 4
  }
}

function pickTemplates(complexity) {
  const allTemplates = ['rectangle', 'hollowRectangle', 'cross', 'letterL', 'letterT']
  if (complexity === 1) return allTemplates.slice(0, 3)
  if (complexity === 2) return allTemplates.slice(0, 4)
  return allTemplates
}

function buildBaseCells(level, complexity) {
  const templates = pickTemplates(complexity)
  const templateName = templates[level % templates.length]

  switch (templateName) {
    case 'rectangle':
      return SHAPES.rectangle(4 + (level % 2), 4 + Math.floor(level % 3 === 0))
    case 'hollowRectangle':
      return SHAPES.hollowRectangle(5 + (level % 2), 5)
    case 'cross':
      return SHAPES.cross(5 + (level % 2) * 2)
    case 'letterL':
      return SHAPES.letterL(4 + (level % 2), 5 + Math.floor(level % 3 === 0))
    case 'letterT':
    default:
      return SHAPES.letterT(5 + (level % 2), 5)
  }
}

function allocateColors(total, palette) {
  const counts = {}
  palette.forEach((color) => { counts[color] = 0 })

  // 先按 3 的倍数分配，适配 3 消逻辑
  const chunks = Math.floor(total / 3)
  for (let i = 0; i < chunks; i++) {
    const color = palette[i % palette.length]
    counts[color] += 3
  }

  // 剩余数量补齐
  let assigned = chunks * 3
  while (assigned < total) {
    const color = palette[assigned % palette.length]
    counts[color] += 1
    assigned += 1
  }

  const colors = []
  Object.keys(counts).forEach((color) => {
    for (let i = 0; i < counts[color]; i++) colors.push(color)
  })

  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = colors[i]
    colors[i] = colors[j]
    colors[j] = tmp
  }

  return colors
}

function generateLevel(level = 1) {
  const difficulty = getDifficulty(level)
  const palette = COLOR_POOL.slice(0, difficulty.colors)
  const baseCells = buildBaseCells(level, difficulty.complexity)

  const layerOffsets = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 }
  ]

  const blocks = []
  const total = baseCells.length * difficulty.layers
  const colorBag = allocateColors(total, palette)

  let idCounter = 1
  let colorIndex = 0
  for (let layer = 1; layer <= difficulty.layers; layer++) {
    const offset = layerOffsets[layer - 1] || { x: 0, y: 0 }
    baseCells.forEach((cell) => {
      blocks.push({
        id: `L${level}-B${idCounter++}`,
        x: cell.x + offset.x,
        y: cell.y + offset.y,
        layer,
        color: colorBag[colorIndex++],
        removed: false
      })
    })
  }

  const xs = blocks.map((b) => b.x)
  const ys = blocks.map((b) => b.y)
  const bounds = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  }

  return {
    level,
    palette,
    difficulty,
    blocks,
    bounds
  }
}

module.exports = {
  COLOR_POOL,
  generateLevel
}

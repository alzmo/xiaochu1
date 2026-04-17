const { COLOR_POOL } = require('./config')

const SHAPES = {
  rectangle: (w = 4, h = 4) => {
    const cells = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) cells.push({ x, y })
    }
    return cells
  },
  hollowRectangle: (w = 5, h = 5) => {
    const cells = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const isBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1
        if (isBorder) cells.push({ x, y })
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

function pickShapeTemplates(complexity) {
  const allShapeTemplates = ['rectangle', 'hollowRectangle', 'cross', 'letterL', 'letterT']
  if (complexity === 1) return allShapeTemplates.slice(0, 3)
  if (complexity === 2) return allShapeTemplates.slice(0, 4)
  return allShapeTemplates
}

function buildLevelShape(level, complexity) {
  const templates = pickShapeTemplates(complexity)
  const templateName = templates[level % templates.length]

  switch (templateName) {
    case 'rectangle':
      return SHAPES.rectangle(4 + (level % 2), 4 + Number(level % 3 === 0))
    case 'hollowRectangle':
      return SHAPES.hollowRectangle(5 + (level % 2), 5)
    case 'cross':
      return SHAPES.cross(5 + (level % 2) * 2)
    case 'letterL':
      return SHAPES.letterL(4 + (level % 2), 5 + Number(level % 3 === 0))
    case 'letterT':
    default:
      return SHAPES.letterT(5 + (level % 2), 5)
  }
}

function createColorBag(totalCount, palette) {
  const colorBag = []
  const chunks = Math.floor(totalCount / 3)

  for (let i = 0; i < chunks; i++) {
    const color = palette[i % palette.length]
    colorBag.push(color, color, color)
  }

  for (let i = colorBag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = colorBag[i]
    colorBag[i] = colorBag[j]
    colorBag[j] = tmp
  }

  return colorBag
}

function buildBlockSlots(levelShape, layers, level) {
  const layerOffsets = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 }
  ]

  const slots = []
  let idCounter = 1
  for (let layer = 1; layer <= layers; layer++) {
    const offset = layerOffsets[layer - 1] || { x: 0, y: 0 }
    levelShape.forEach((cell) => {
      slots.push({
        id: `L${level}-B${idCounter++}`,
        x: cell.x + offset.x,
        y: cell.y + offset.y,
        layer
      })
    })
  }

  return slots
}

function generateLevel(level = 1) {
  const difficulty = getDifficulty(level)
  const palette = COLOR_POOL.slice(0, difficulty.colors)
  const levelShape = buildLevelShape(level, difficulty.complexity)
  const blockSlots = buildBlockSlots(levelShape, difficulty.layers, level)

  const usableCount = Math.max(3, Math.floor(blockSlots.length / 3) * 3)
  const selectedSlots = blockSlots.slice(0, usableCount)
  const colorBag = createColorBag(selectedSlots.length, palette)

  const blockLayers = selectedSlots.map((slot, index) => ({
    ...slot,
    color: colorBag[index],
    removed: false
  }))

  const xs = blockLayers.map((b) => b.x)
  const ys = blockLayers.map((b) => b.y)

  return {
    level,
    palette,
    difficulty,
    levelShape,
    blockLayers,
    bounds: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    }
  }
}

module.exports = {
  generateLevel
}

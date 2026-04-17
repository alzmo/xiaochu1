const { COLOR_POOL, BIN_CAPACITY, TEMP_SLOT_LIMIT } = require('./config')

function uniqueColors(colors) {
  return Array.from(new Set(colors))
}

function getPalette(levelData) {
  if (levelData && levelData.palette && levelData.palette.length) return levelData.palette
  return COLOR_POOL
}

function getRemainingBlocks(levelData) {
  return levelData.blockLayers.filter((block) => !block.removed)
}

function getVisibleBlocks(levelData) {
  const remainingBlocks = getRemainingBlocks(levelData)
  const topLayerByCell = new Map()

  remainingBlocks.forEach((block) => {
    const key = `${block.x},${block.y}`
    const current = topLayerByCell.get(key)
    if (!current || block.layer > current.layer) topLayerByCell.set(key, block)
  })

  return Array.from(topLayerByCell.values())
}

function getPendingColors(levelData, tempSlots) {
  const tempColors = tempSlots.map((slot) => slot.color)
  const remainingColors = getRemainingBlocks(levelData).map((block) => block.color)
  return uniqueColors([...tempColors, ...remainingColors])
}

function pickRefreshColor({ levelData, tempSlots, colorBins, excludeBinIndex = -1, currentColor = null }) {
  const palette = getPalette(levelData)
  const pendingColors = getPendingColors(levelData, tempSlots)
  const excludedColors = colorBins
    .filter((_, idx) => idx !== excludeBinIndex)
    .map((bin) => bin.color)
  const excludedSet = new Set(excludedColors)

  const pendingCount = {}
  tempSlots.forEach((slot) => {
    pendingCount[slot.color] = (pendingCount[slot.color] || 0) + 1
  })
  getRemainingBlocks(levelData).forEach((block) => {
    pendingCount[block.color] = (pendingCount[block.color] || 0) + 1
  })

  const prioritizedPending = pendingColors
    .filter((color) => !excludedSet.has(color))
    .sort((a, b) => {
      const diff = (pendingCount[b] || 0) - (pendingCount[a] || 0)
      if (diff !== 0) return diff
      return palette.indexOf(a) - palette.indexOf(b)
    })
  if (prioritizedPending.length > 0) return prioritizedPending[0]

  const fallbackPool = palette.filter((color) => !excludedSet.has(color))
  if (fallbackPool.length > 0) return fallbackPool[0]

  if (currentColor) return currentColor
  return palette[0] || COLOR_POOL[0]
}

function processStoreStep(levelData, tempSlots, colorBins) {
  for (let i = 0; i < tempSlots.length; i++) {
    const slotBlock = tempSlots[i]
    const targetBinIndex = colorBins.findIndex((bin) => bin.color === slotBlock.color && bin.count < bin.capacity)
    if (targetBinIndex < 0) continue

    const targetBin = colorBins[targetBinIndex]
    tempSlots.splice(i, 1)
    targetBin.count += 1

    if (targetBin.count >= targetBin.capacity) {
      targetBin.count = 0
      targetBin.color = pickRefreshColor({
        levelData,
        tempSlots,
        colorBins,
        excludeBinIndex: targetBinIndex,
        currentColor: targetBin.color
      })
    }
    return true
  }

  return false
}

function runAutoStoreSteps(levelData, tempSlots, colorBins, maxSteps = 12) {
  const safeMaxSteps = Math.max(0, maxSteps)
  for (let i = 0; i < safeMaxSteps; i++) {
    const moved = processStoreStep(levelData, tempSlots, colorBins)
    if (!moved) break
  }
}

function hasStorableTempBlock(tempSlots, colorBins) {
  return tempSlots.some((slot) => colorBins.some((bin) => bin.color === slot.color && bin.count < bin.capacity))
}

function createInitialBins(levelData) {
  const palette = getPalette(levelData)
  const pendingColors = getPendingColors(levelData, [])
  const first = pendingColors[0] || palette[0] || COLOR_POOL[0]
  const secondPool = pendingColors.filter((color) => color !== first)
  const paletteFallback = palette.filter((color) => color !== first)
  const second = secondPool[0] || paletteFallback[0] || first

  return [
    { color: first, count: 0, capacity: BIN_CAPACITY },
    { color: second, count: 0, capacity: BIN_CAPACITY }
  ]
}

function cloneSnapshot(levelData, tempSlots, colorBins) {
  return {
    levelData: {
      ...levelData,
      blockLayers: levelData.blockLayers.map((block) => ({ ...block }))
    },
    tempSlots: tempSlots.map((slot) => ({ ...slot })),
    colorBins: colorBins.map((bin) => ({ ...bin }))
  }
}

function getDynamicTempLimit(extraTempSlots = 0) {
  return TEMP_SLOT_LIMIT + Math.max(0, extraTempSlots)
}

function isVictoryState(levelData, tempSlots, colorBins) {
  const noBlocks = getRemainingBlocks(levelData).length === 0
  const noTemp = tempSlots.length === 0
  const noBinCount = colorBins.every((bin) => bin.count === 0)
  return noBlocks && noTemp && noBinCount
}

module.exports = {
  uniqueColors,
  getPalette,
  getRemainingBlocks,
  getVisibleBlocks,
  getPendingColors,
  pickRefreshColor,
  processStoreStep,
  runAutoStoreSteps,
  hasStorableTempBlock,
  createInitialBins,
  cloneSnapshot,
  getDynamicTempLimit,
  isVictoryState
}

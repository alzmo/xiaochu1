const {
  GAME_TITLE,
  COLOR_POOL,
  TEMP_SLOT_LIMIT,
  BIN_COUNT,
  BIN_CAPACITY
} = require('./config')
const { generateLevel } = require('./levelGenerator')

const AUTO_STORE_STEP_LIMIT = 8

function pickRandomColor(colorCandidates) {
  const idx = Math.floor(Math.random() * colorCandidates.length)
  return colorCandidates[idx]
}

function uniqueColors(colors) {
  return Array.from(new Set(colors))
}

function createGameState() {
  const state = {
    title: GAME_TITLE,
    currentLevel: 1,
    levelData: null,
    tempSlots: [],
    colorBins: [],
    gameStatus: 'playing',
    statusText: '',
    layout: null
  }

  function getActivePalette() {
    const palette = state.levelData && state.levelData.palette && state.levelData.palette.length
      ? state.levelData.palette
      : COLOR_POOL
    return uniqueColors(palette)
  }

  function loadLevel(level) {
    state.currentLevel = level
    state.levelData = generateLevel(level)
    state.tempSlots = []
    state.colorBins = createInitialColorBins()
    state.gameStatus = 'playing'
    state.statusText = `第 ${level} 关`
  }

  function getRemainingBlocks() {
    return state.levelData.blockLayers.filter((block) => !block.removed)
  }

  function getPendingColors() {
    const tempColors = state.tempSlots.map((slot) => slot.color)
    const remainingColors = getRemainingBlocks().map((block) => block.color)
    return uniqueColors([...tempColors, ...remainingColors])
  }

  function pickBinRefreshColor(excludedColors = [], forceColor = null) {
    const palette = getActivePalette()
    const excludedSet = new Set(excludedColors)

    if (forceColor && !excludedSet.has(forceColor)) return forceColor

    const pendingColors = getPendingColors()
    const prioritizedPending = pendingColors.filter((color) => !excludedSet.has(color))
    if (prioritizedPending.length > 0) return pickRandomColor(prioritizedPending)

    const fallbackPool = palette.filter((color) => !excludedSet.has(color))
    if (fallbackPool.length > 0) return pickRandomColor(fallbackPool)

    if (forceColor) return forceColor
    return palette[0] || COLOR_POOL[0]
  }

  function pickInitialBinColors() {
    const palette = getActivePalette()
    const pendingColors = getPendingColors()
    const firstColor = pickBinRefreshColor([])

    const pendingWithoutFirst = pendingColors.filter((color) => color !== firstColor)
    const nonDuplicatePool = palette.filter((color) => color !== firstColor)

    let secondColor
    if (pendingWithoutFirst.length > 0) {
      secondColor = pickRandomColor(pendingWithoutFirst)
    } else if (nonDuplicatePool.length > 0) {
      secondColor = pickRandomColor(nonDuplicatePool)
    } else {
      secondColor = firstColor
    }

    return [firstColor, secondColor]
  }

  function createInitialColorBins() {
    const [firstColor, secondColor] = pickInitialBinColors()
    return [
      { color: firstColor, count: 0, capacity: BIN_CAPACITY },
      { color: secondColor, count: 0, capacity: BIN_CAPACITY }
    ]
  }

  // 设计说明：同坐标更高层存在方块时，下层不可点，体现“层叠遮挡”的核心规则。
  function getVisibleBlocks() {
    const remainingBlocks = getRemainingBlocks()
    return remainingBlocks.filter((block) => {
      const coveredByUpper = remainingBlocks.some((other) => {
        return other.id !== block.id && other.x === block.x && other.y === block.y && other.layer > block.layer
      })
      return !coveredByUpper
    })
  }

  function processStoreOneStep() {
    for (let i = 0; i < state.tempSlots.length; i++) {
      const slotBlock = state.tempSlots[i]
      const targetBin = state.colorBins.find((bin) => bin.color === slotBlock.color && bin.count < bin.capacity)
      if (!targetBin) continue

      state.tempSlots.splice(i, 1)
      targetBin.count += 1

      if (targetBin.count >= targetBin.capacity) {
        targetBin.count = 0
        const otherBinColors = state.colorBins
          .filter((bin) => bin !== targetBin)
          .map((bin) => bin.color)
        const pendingColors = getPendingColors()
        const criticalColor = pendingColors.length === 1 ? pendingColors[0] : null
        const forceColor = criticalColor && !otherBinColors.includes(criticalColor) ? criticalColor : null

        targetBin.color = pickBinRefreshColor(otherBinColors, forceColor)
      }
      return true
    }

    return false
  }

  function runAutoStoreSteps(maxSteps = AUTO_STORE_STEP_LIMIT) {
    const safeMaxSteps = Math.max(0, maxSteps)
    for (let step = 0; step < safeMaxSteps; step++) {
      const moved = processStoreOneStep()
      if (!moved) break
    }
  }

  function hasStorableTempBlock() {
    return state.tempSlots.some((slot) => {
      return state.colorBins.some((bin) => bin.color === slot.color && bin.count < bin.capacity)
    })
  }

  function tryPickBlock(blockId) {
    if (state.gameStatus !== 'playing') return

    const visibleBlocks = getVisibleBlocks()
    const picked = visibleBlocks.find((block) => block.id === blockId)
    if (!picked) return

    if (state.tempSlots.length >= TEMP_SLOT_LIMIT) {
      state.gameStatus = 'fail'
      state.statusText = '暂存槽已满，挑战失败'
      return
    }

    picked.removed = true
    state.tempSlots.push({ id: picked.id, color: picked.color })
    runAutoStoreSteps(AUTO_STORE_STEP_LIMIT)
    evaluateGameResult()
  }

  function evaluateGameResult() {
    const remainingBlocks = getRemainingBlocks()

    if (remainingBlocks.length === 0) {
      runAutoStoreSteps(TEMP_SLOT_LIMIT)
      if (state.tempSlots.length === 0) {
        state.gameStatus = 'win'
        state.statusText = '胜利！点击下方“下一关”继续'
        return
      }

      state.gameStatus = 'fail'
      state.statusText = '画布已清空但暂存槽无法收纳，挑战失败'
      return
    }

    const canContinueStore = hasStorableTempBlock()
    if (state.tempSlots.length >= TEMP_SLOT_LIMIT && !canContinueStore) {
      state.gameStatus = 'fail'
      state.statusText = '暂存槽无可收纳，挑战失败'
      return
    }

    const visibleBlocks = getVisibleBlocks()
    if (!visibleBlocks.length && remainingBlocks.length > 0) {
      state.gameStatus = 'fail'
      state.statusText = '无可点击方块，挑战失败'
      return
    }

    state.statusText = `第 ${state.currentLevel} 关进行中`
  }

  function setLayout(layout) {
    state.layout = layout
  }

  function resolveTapAction(x, y) {
    if (!state.layout) return null

    const { blockRects, restartButtonRect, nextButtonRect } = state.layout

    const hitBlock = blockRects.find((rect) => {
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    })
    if (hitBlock) return { type: 'pick_block', blockId: hitBlock.blockId }

    const hitRestart = x >= restartButtonRect.left && x <= restartButtonRect.right && y >= restartButtonRect.top && y <= restartButtonRect.bottom
    if (hitRestart) return { type: 'restart' }

    const hitNext = x >= nextButtonRect.left && x <= nextButtonRect.right && y >= nextButtonRect.top && y <= nextButtonRect.bottom
    if (hitNext) return { type: 'next_level' }

    return null
  }

  function handleTap(x, y) {
    const action = resolveTapAction(x, y)
    if (!action) return

    if (action.type === 'pick_block') {
      tryPickBlock(action.blockId)
      return
    }

    if (action.type === 'restart') {
      loadLevel(state.currentLevel)
      return
    }

    if (action.type === 'next_level' && state.gameStatus === 'win') {
      loadLevel(state.currentLevel + 1)
    }
  }

  function update() {
    // 第一版无需动画，update 预留给后续效果和节奏控制。
  }

  loadLevel(1)

  return {
    state,
    setLayout,
    getVisibleBlocks,
    handleTap,
    update
  }
}

module.exports = {
  createGameState
}

const { GAME_TITLE, BIN_CAPACITY, TEMP_SLOT_LIMIT } = require('./config')
const { generateLevel } = require('./levelGenerator')
const { solveLevelState } = require('./solver')
const { loadProgress, saveProgress } = require('./storage')
const { createLevelPreparation } = require('./levelPreparation')
const {
  getVisibleBlocks,
  getRemainingBlocks,
  runAutoStoreSteps,
  hasStorableTempBlock,
  createInitialBins,
  getPendingColors,
  cloneSnapshot,
  getDynamicTempLimit,
  isVictoryState,
  pickRefreshColor
} = require('./gameRules')

const AUTO_STORE_STEP_LIMIT = 12
const LEVEL_BUILD_RETRY_LIMIT = 20

function createGameState() {
  const state = {
    title: GAME_TITLE,
    currentLevel: 1,
    levelData: null,
    tempSlots: [],
    colorBins: [],
    solverPath: [],
    solverExpandedNodes: 0,
    gameStatus: 'playing',
    statusText: '',
    layout: null,
    highlightedBlockId: null,
    helpMessage: '',
    extraTempSlots: 0,
    adHelpState: {
      canAddBin: true,
      canAddTempSlot: true,
      canHintStep: true
    },
    levelPrepScope: {
      currentBundleReady: false,
      nextBundleReady: false
    }
  }

  function buildSolvableLevelBundle(level) {
    for (let attempt = 1; attempt <= LEVEL_BUILD_RETRY_LIMIT; attempt++) {
      const levelData = generateLevel(level)
      const colorBins = createInitialBins(levelData)

      const solveResult = solveLevelState(
        { levelData, tempSlots: [], colorBins },
        { maxNodes: 2500, autoStoreStepLimit: AUTO_STORE_STEP_LIMIT }
      )

      if (!solveResult.solvable) continue

      return {
        level,
        levelData,
        initialBins: colorBins,
        solverPath: solveResult.path,
        expandedNodes: solveResult.expandedNodes
      }
    }

    const fallbackLevel = generateLevel(level)
    return {
      level,
      levelData: fallbackLevel,
      initialBins: createInitialBins(fallbackLevel),
      solverPath: [],
      expandedNodes: 0
    }
  }

  const levelPreparation = createLevelPreparation(buildSolvableLevelBundle)

  function applyBundle(bundle) {
    state.currentLevel = bundle.level
    state.levelData = bundle.levelData
    state.tempSlots = []
    state.colorBins = bundle.initialBins.map((bin) => ({ ...bin }))
    state.solverPath = bundle.solverPath || []
    state.solverExpandedNodes = bundle.expandedNodes || 0
    state.gameStatus = 'playing'
    state.statusText = `第 ${bundle.level} 关`
    state.helpMessage = ''
    state.highlightedBlockId = null
    state.extraTempSlots = 0
    state.adHelpState = {
      canAddBin: true,
      canAddTempSlot: true,
      canHintStep: true
    }

    saveProgress(bundle.level)

    levelPreparation.startPrepare(bundle.level + 1)
    state.levelPrepScope.currentBundleReady = true
    state.levelPrepScope.nextBundleReady = false
  }

  function loadLevel(level) {
    const prepared = levelPreparation.consumePrepared(level)
    const bundle = prepared || buildSolvableLevelBundle(level)
    applyBundle(bundle)
  }

  function getVisibleBlocksSafe() {
    return getVisibleBlocks(state.levelData)
  }

  function getRemainingBlocksSafe() {
    return getRemainingBlocks(state.levelData)
  }

  function getHintSnapshot() {
    return cloneSnapshot(state.levelData, state.tempSlots, state.colorBins)
  }

  function markNoSolution() {
    state.gameStatus = 'fail'
    state.statusText = '当前局面已无解 / 你已经走偏了'
    state.helpMessage = '提示：当前局面已无解，请重开或使用广告帮助能力。'
  }

  function requestHintStep() {
    if (state.gameStatus !== 'playing') return

    const snapshot = getHintSnapshot()
    const hintResult = solveLevelState(
      {
        levelData: snapshot.levelData,
        tempSlots: snapshot.tempSlots,
        colorBins: snapshot.colorBins
      },
      { maxNodes: 1800, autoStoreStepLimit: AUTO_STORE_STEP_LIMIT, extraTempSlots: state.extraTempSlots }
    )

    if (!hintResult.solvable || !hintResult.path.length) {
      if (hintResult.reason === 'no_solution') {
        markNoSolution()
      } else {
        state.helpMessage = '提示系统搜索中：当前局面较复杂，建议先清理高层方块。'
      }
      state.highlightedBlockId = null
      return
    }

    const nextStep = hintResult.path[0]
    state.highlightedBlockId = nextStep.blockId
    state.helpMessage = `建议点击：${nextStep.color}（layer ${nextStep.layer}）`
    state.statusText = `第 ${state.currentLevel} 关进行中（已给出一步提示）`
  }

  function processStoreAndCheck() {
    runAutoStoreSteps(state.levelData, state.tempSlots, state.colorBins, AUTO_STORE_STEP_LIMIT)
    evaluateGameResult()
  }

  function tryPickBlock(blockId) {
    if (state.gameStatus !== 'playing') return

    const visibleBlocks = getVisibleBlocksSafe()
    const picked = visibleBlocks.find((block) => block.id === blockId)
    if (!picked) return

    const tempLimit = getDynamicTempLimit(state.extraTempSlots)
    if (state.tempSlots.length >= tempLimit) {
      state.gameStatus = 'fail'
      state.statusText = '暂存槽已满，挑战失败'
      return
    }

    picked.removed = true
    state.tempSlots.push({ id: picked.id, color: picked.color })
    if (state.highlightedBlockId === blockId) state.highlightedBlockId = null
    processStoreAndCheck()
  }

  function evaluateGameResult() {
    if (isVictoryState(state.levelData, state.tempSlots, state.colorBins)) {
      state.gameStatus = 'win'
      state.statusText = '胜利！点击下方“下一关”继续'
      state.helpMessage = ''
      return
    }

    const remainingBlocks = getRemainingBlocksSafe()
    const canContinueStore = hasStorableTempBlock(state.tempSlots, state.colorBins)
    const tempLimit = getDynamicTempLimit(state.extraTempSlots)

    if (state.tempSlots.length >= tempLimit && !canContinueStore) {
      state.gameStatus = 'fail'
      state.statusText = '暂存槽爆满且无法收纳，挑战失败'
      return
    }

    if (!getVisibleBlocksSafe().length && remainingBlocks.length > 0) {
      state.gameStatus = 'fail'
      state.statusText = '无可点击方块，挑战失败'
      return
    }

    const solveCheck = solveLevelState(
      {
        levelData: cloneSnapshot(state.levelData, state.tempSlots, state.colorBins).levelData,
        tempSlots: state.tempSlots,
        colorBins: state.colorBins
      },
      { maxNodes: 1200, autoStoreStepLimit: AUTO_STORE_STEP_LIMIT, extraTempSlots: state.extraTempSlots }
    )

    if (!solveCheck.solvable && solveCheck.reason === 'no_solution') {
      markNoSolution()
      return
    }

    state.gameStatus = 'playing'
    state.statusText = `第 ${state.currentLevel} 关进行中`
  }

  function addExtraBinHelp() {
    if (state.gameStatus !== 'playing') return
    if (!state.adHelpState.canAddBin) return

    const pendingColors = getPendingColors(state.levelData, state.tempSlots)
    const usedColors = new Set(state.colorBins.map((bin) => bin.color))
    const recommendedColor = pendingColors.find((color) => !usedColors.has(color))
      || pickRefreshColor({ levelData: state.levelData, tempSlots: state.tempSlots, colorBins: state.colorBins })

    state.colorBins.push({ color: recommendedColor, count: 0, capacity: BIN_CAPACITY })
    state.adHelpState.canAddBin = false
    state.helpMessage = '已增加 1 个收纳篮（广告能力预留接口）'
    evaluateGameResult()
  }

  function addExtraTempSlotHelp() {
    if (state.gameStatus !== 'playing') return
    if (!state.adHelpState.canAddTempSlot) return

    state.extraTempSlots += 1
    state.adHelpState.canAddTempSlot = false
    state.helpMessage = '已增加 1 个暂存槽（广告能力预留接口）'
    evaluateGameResult()
  }

  function nextLevel() {
    if (state.gameStatus !== 'win') return

    const targetLevel = state.currentLevel + 1
    const prepared = levelPreparation.consumePrepared(targetLevel)
    if (prepared) {
      state.levelPrepScope.nextBundleReady = true
      applyBundle(prepared)
      return
    }

    state.levelPrepScope.nextBundleReady = false
    loadLevel(targetLevel)
  }

  function setLayout(layout) {
    state.layout = layout
  }

  function resolveTapAction(x, y) {
    if (!state.layout) return null

    const {
      blockRects,
      restartButtonRect,
      nextButtonRect,
      hintButtonRect,
      addBinButtonRect,
      addTempButtonRect
    } = state.layout

    const hitBlock = blockRects.find((rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
    if (hitBlock) return { type: 'pick_block', blockId: hitBlock.blockId }

    const isInRect = (rect) => rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    if (isInRect(restartButtonRect)) return { type: 'restart' }
    if (isInRect(nextButtonRect)) return { type: 'next_level' }
    if (isInRect(hintButtonRect)) return { type: 'hint_step' }
    if (isInRect(addBinButtonRect)) return { type: 'add_bin_help' }
    if (isInRect(addTempButtonRect)) return { type: 'add_temp_help' }

    return null
  }

  function handleTap(x, y) {
    const action = resolveTapAction(x, y)
    if (!action) return

    if (action.type === 'pick_block') return tryPickBlock(action.blockId)
    if (action.type === 'restart') return loadLevel(state.currentLevel)
    if (action.type === 'next_level') return nextLevel()
    if (action.type === 'hint_step') return requestHintStep()
    if (action.type === 'add_bin_help') return addExtraBinHelp()
    if (action.type === 'add_temp_help') return addExtraTempSlotHelp()
  }

  function update() {
    levelPreparation.update()
  }

  const savedLevel = loadProgress()
  loadLevel(savedLevel)

  return {
    state,
    setLayout,
    getVisibleBlocks: getVisibleBlocksSafe,
    handleTap,
    update
  }
}

module.exports = {
  createGameState
}

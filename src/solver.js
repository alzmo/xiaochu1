const {
  getVisibleBlocks,
  getRemainingBlocks,
  runAutoStoreSteps,
  hasStorableTempBlock,
  getDynamicTempLimit,
  isVictoryState,
  cloneSnapshot
} = require('./gameRules')

const DEFAULT_SOLVER_OPTIONS = {
  maxNodes: 2200,
  autoStoreStepLimit: 12
}

const SOLVER_STATE = {
  SOLVABLE: 'solvable',
  UNSOLVABLE: 'unsolvable',
  UNKNOWN: 'unknown'
}

function buildStateSignature(levelData, tempSlots, colorBins) {
  const removedIds = levelData.blockLayers.filter((b) => b.removed).map((b) => b.id).sort().join(',')
  const tempKey = tempSlots.map((slot) => slot.color).join(',')
  const binKey = colorBins.map((bin) => `${bin.color}:${bin.count}`).join('|')
  return `${removedIds}#${tempKey}#${binKey}`
}

function clonePath(path, block) {
  return [...path, { blockId: block.id, color: block.color, layer: block.layer }]
}

function rankCandidateBlocks(visibleBlocks, colorBins) {
  return visibleBlocks
    .slice()
    .sort((a, b) => {
      const aStorable = colorBins.some((bin) => bin.color === a.color && bin.count < bin.capacity)
      const bStorable = colorBins.some((bin) => bin.color === b.color && bin.count < bin.capacity)
      if (aStorable !== bStorable) return aStorable ? -1 : 1
      if (a.layer !== b.layer) return b.layer - a.layer
      return a.id.localeCompare(b.id)
    })
}

function evaluateDeadState(levelData, tempSlots, colorBins, extraTempSlots) {
  const tempLimit = getDynamicTempLimit(extraTempSlots)
  const remainingBlocks = getRemainingBlocks(levelData)
  if (remainingBlocks.length === 0) return false

  if (tempSlots.length >= tempLimit && !hasStorableTempBlock(tempSlots, colorBins)) return true
  const visibleBlocks = getVisibleBlocks(levelData)
  return visibleBlocks.length === 0
}

function simulatePickStep(snapshot, blockId, options) {
  const { levelData, tempSlots, colorBins } = cloneSnapshot(snapshot.levelData, snapshot.tempSlots, snapshot.colorBins)
  const picked = levelData.blockLayers.find((block) => block.id === blockId && !block.removed)
  if (!picked) return null

  const tempLimit = getDynamicTempLimit(options.extraTempSlots)
  if (tempSlots.length >= tempLimit) return null

  picked.removed = true
  tempSlots.push({ id: picked.id, color: picked.color })
  runAutoStoreSteps(levelData, tempSlots, colorBins, options.autoStoreStepLimit)

  return { levelData, tempSlots, colorBins }
}

function createSolveResult(state, payload = {}) {
  return {
    state,
    solvable: state === SOLVER_STATE.SOLVABLE,
    path: payload.path || [],
    expandedNodes: payload.expandedNodes || 0,
    reason: payload.reason || '',
    searchLimitHit: state === SOLVER_STATE.UNKNOWN
  }
}

function solveLevelState(input, options = {}) {
  const mergedOptions = {
    ...DEFAULT_SOLVER_OPTIONS,
    ...options,
    extraTempSlots: Math.max(0, options.extraTempSlots || 0)
  }

  const rootSnapshot = cloneSnapshot(input.levelData, input.tempSlots || [], input.colorBins || [])
  const initialState = {
    snapshot: rootSnapshot,
    path: []
  }

  const stack = [initialState]
  const visited = new Set()
  let expandedNodes = 0

  while (stack.length > 0 && expandedNodes < mergedOptions.maxNodes) {
    const node = stack.pop()
    const { levelData, tempSlots, colorBins } = node.snapshot

    if (isVictoryState(levelData, tempSlots, colorBins)) {
      return createSolveResult(SOLVER_STATE.SOLVABLE, {
        path: node.path,
        expandedNodes,
        reason: 'solved'
      })
    }

    const signature = buildStateSignature(levelData, tempSlots, colorBins)
    if (visited.has(signature)) continue
    visited.add(signature)

    if (evaluateDeadState(levelData, tempSlots, colorBins, mergedOptions.extraTempSlots)) continue

    const visibleBlocks = rankCandidateBlocks(getVisibleBlocks(levelData), colorBins)
    expandedNodes += 1

    for (let i = visibleBlocks.length - 1; i >= 0; i--) {
      const block = visibleBlocks[i]
      const nextSnapshot = simulatePickStep(node.snapshot, block.id, mergedOptions)
      if (!nextSnapshot) continue

      stack.push({
        snapshot: nextSnapshot,
        path: clonePath(node.path, block)
      })
    }
  }

  if (expandedNodes >= mergedOptions.maxNodes) {
    return createSolveResult(SOLVER_STATE.UNKNOWN, {
      path: [],
      expandedNodes,
      reason: 'nodes_exceeded'
    })
  }

  return createSolveResult(SOLVER_STATE.UNSOLVABLE, {
    path: [],
    expandedNodes,
    reason: 'no_solution'
  })
}

module.exports = {
  solveLevelState,
  SOLVER_STATE
}

const { generateLevel, COLOR_POOL } = require('../../utils/levelGenerator')

const CELL_SIZE = 78
const BOARD_OFFSET_X = 120
const BOARD_OFFSET_Y = 40

function buildTopIdSet(blocks) {
  const topMap = {}
  blocks.forEach((block) => {
    if (block.removed) return
    const key = `${block.x},${block.y}`
    if (!topMap[key] || block.layer > topMap[key].layer) {
      topMap[key] = block
    }
  })

  const idSet = {}
  Object.keys(topMap).forEach((key) => {
    idSet[topMap[key].id] = true
  })
  return idSet
}

Page({
  data: {
    level: 1,
    status: 'playing',
    statusLabel: '进行中',
    blocks: [],
    renderBlocks: [],
    stashSlots: [null, null, null, null, null],
    bins: [],
    stashCount: 0,
    levelPalette: []
  },

  onLoad() {
    this.loadLevel(1)
  },

  loadLevel(level) {
    const levelData = generateLevel(level)
    const bins = this.initBins(levelData.palette)

    this.setData({
      level,
      status: 'playing',
      statusLabel: '进行中',
      blocks: levelData.blocks,
      stashSlots: [null, null, null, null, null],
      bins,
      stashCount: 0,
      levelPalette: levelData.palette
    }, () => {
      this.refreshRenderBlocks()
    })
  },

  initBins(palette) {
    const shuffled = palette.slice().sort(() => Math.random() - 0.5)
    const selected = []
    for (let i = 0; i < 3; i++) {
      selected.push({
        color: shuffled[i % shuffled.length],
        items: []
      })
    }
    return selected
  },

  refreshRenderBlocks() {
    const topIdSet = buildTopIdSet(this.data.blocks)
    const renderBlocks = this.data.blocks.map((block) => {
      const left = BOARD_OFFSET_X + block.x * CELL_SIZE
      const top = BOARD_OFFSET_Y + block.y * CELL_SIZE
      return {
        ...block,
        left,
        top,
        z: block.layer,
        clickable: !!topIdSet[block.id]
      }
    })

    this.setData({ renderBlocks })
  },

  onTapBlock(e) {
    const { status, blocks, stashSlots } = this.data
    if (status !== 'playing') return

    const id = e.currentTarget.dataset.id
    const topIdSet = buildTopIdSet(blocks)
    if (!topIdSet[id]) return

    const blockIndex = blocks.findIndex((item) => item.id === id)
    if (blockIndex < 0) return

    const emptyIndex = stashSlots.findIndex((slot) => slot === null)
    if (emptyIndex < 0) {
      this.failGame()
      return
    }

    const target = blocks[blockIndex]
    const updatedBlocks = blocks.slice()
    updatedBlocks[blockIndex] = {
      ...target,
      removed: true
    }

    const updatedSlots = stashSlots.slice()
    updatedSlots[emptyIndex] = {
      id: target.id,
      color: target.color
    }

    this.setData({
      blocks: updatedBlocks,
      stashSlots: updatedSlots,
      stashCount: this.countStash(updatedSlots)
    }, () => {
      this.autoStoreLoop()
      this.refreshRenderBlocks()
      this.checkGameState()
    })
  },

  autoStoreLoop() {
    let moved = true
    let stashSlots = this.data.stashSlots.slice()
    let bins = this.data.bins.map((bin) => ({ ...bin, items: bin.items.slice() }))

    while (moved) {
      moved = false

      for (let i = 0; i < stashSlots.length; i++) {
        const item = stashSlots[i]
        if (!item) continue

        const binIndex = bins.findIndex((bin) => bin.color === item.color && bin.items.length < 3)
        if (binIndex === -1) continue

        bins[binIndex].items.push(item)
        stashSlots[i] = null
        moved = true

        if (bins[binIndex].items.length >= 3) {
          bins[binIndex] = {
            color: this.pickNewBinColor(stashSlots, bins),
            items: []
          }
        }
      }
    }

    this.setData({
      stashSlots,
      bins,
      stashCount: this.countStash(stashSlots)
    })
  },

  pickNewBinColor(stashSlots, bins) {
    const pendingCount = {}
    COLOR_POOL.forEach((color) => { pendingCount[color] = 0 })

    stashSlots.forEach((item) => {
      if (item) pendingCount[item.color] += 1
    })

    this.data.blocks.forEach((block) => {
      if (!block.removed) pendingCount[block.color] += 1
    })

    const sorted = Object.keys(pendingCount)
      .sort((a, b) => pendingCount[b] - pendingCount[a])

    const topColor = sorted.find((c) => pendingCount[c] > 0)
    if (!topColor) {
      return this.data.levelPalette[Math.floor(Math.random() * this.data.levelPalette.length)]
    }

    return topColor
  },

  countStash(slots) {
    return slots.filter(Boolean).length
  },

  checkGameState() {
    const remainBlocks = this.data.blocks.filter((b) => !b.removed).length
    const stashCount = this.data.stashSlots.filter(Boolean).length

    if (remainBlocks === 0 && stashCount === 0) {
      this.setData({
        status: 'win',
        statusLabel: '胜利'
      })
      return
    }

    if (stashCount >= 5) {
      this.failGame()
      return
    }

    this.setData({
      status: 'playing',
      statusLabel: '进行中'
    })
  },

  failGame() {
    this.setData({
      status: 'fail',
      statusLabel: '失败'
    })
  },

  restartLevel() {
    this.loadLevel(this.data.level)
  },

  nextLevel() {
    this.loadLevel(this.data.level + 1)
  }
})

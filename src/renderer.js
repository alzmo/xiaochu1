const { COLOR_STYLE, TEMP_SLOT_LIMIT } = require('./config')

function createRenderer(canvas, gameStateApi) {
  const ctx = canvas.getContext('2d')

  function calcLayout() {
    const width = canvas.width
    const height = canvas.height

    const topPanel = {
      left: 16,
      top: 16,
      width: width - 32,
      height: Math.round(height * 0.5)
    }

    const tempArea = {
      left: 16,
      top: topPanel.top + topPanel.height + 12,
      width: width - 32,
      height: 86
    }

    const binsArea = {
      left: 16,
      top: tempArea.top + tempArea.height + 10,
      width: width - 32,
      height: 96
    }

    const helpArea = {
      left: 16,
      top: binsArea.top + binsArea.height + 8,
      width: width - 32,
      height: 52
    }

    const footerArea = {
      left: 16,
      top: helpArea.top + helpArea.height + 8,
      width: width - 32,
      height: 66
    }

    return { width, height, topPanel, tempArea, binsArea, helpArea, footerArea }
  }

  function drawRoundRect(left, top, width, height, radius, fillStyle, strokeStyle, lineWidth = 1) {
    const r = Math.min(radius, width / 2, height / 2)
    ctx.beginPath()
    ctx.moveTo(left + r, top)
    ctx.lineTo(left + width - r, top)
    ctx.quadraticCurveTo(left + width, top, left + width, top + r)
    ctx.lineTo(left + width, top + height - r)
    ctx.quadraticCurveTo(left + width, top + height, left + width - r, top + height)
    ctx.lineTo(left + r, top + height)
    ctx.quadraticCurveTo(left, top + height, left, top + height - r)
    ctx.lineTo(left, top + r)
    ctx.quadraticCurveTo(left, top, left + r, top)
    ctx.closePath()

    if (fillStyle) {
      ctx.fillStyle = fillStyle
      ctx.fill()
    }

    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle
      ctx.lineWidth = lineWidth
      ctx.stroke()
    }
  }

  function drawCenteredText(text, x, y, fontSize = 14, color = COLOR_STYLE.text) {
    ctx.fillStyle = color
    ctx.font = `${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y)
  }

  function drawBlockLayerLabel(layer, centerX, centerY, blockSize) {
    const fontSize = Math.max(11, Math.floor(blockSize * 0.38))
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = Math.max(2, Math.floor(fontSize / 5))
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)'
    ctx.fillStyle = '#ffffff'
    const text = `${layer}`
    ctx.strokeText(text, centerX, centerY)
    ctx.fillText(text, centerX, centerY)
  }

  function drawBlocks(layout, visibleBlocks) {
    const { state } = gameStateApi
    const { bounds } = state.levelData
    const boardPadding = 16
    const boardLeft = layout.topPanel.left + boardPadding
    const boardTop = layout.topPanel.top + boardPadding + 20
    const boardWidth = layout.topPanel.width - boardPadding * 2
    const boardHeight = layout.topPanel.height - boardPadding * 2 - 20

    const gridWidth = Math.max(1, bounds.maxX - bounds.minX + 1)
    const gridHeight = Math.max(1, bounds.maxY - bounds.minY + 1)
    const cellSize = Math.floor(Math.min(boardWidth / gridWidth, boardHeight / gridHeight))

    const offsetX = boardLeft + Math.floor((boardWidth - gridWidth * cellSize) / 2)
    const offsetY = boardTop + Math.floor((boardHeight - gridHeight * cellSize) / 2)

    const blockRects = []
    visibleBlocks
      .sort((a, b) => a.layer - b.layer)
      .forEach((block) => {
        const left = offsetX + (block.x - bounds.minX) * cellSize
        const top = offsetY + (block.y - bounds.minY) * cellSize
        const size = Math.max(14, cellSize - 3)

        const isHighlighted = state.highlightedBlockId === block.id
        drawRoundRect(left, top, size, size, 6, COLOR_STYLE[block.color], COLOR_STYLE.border)
        if (isHighlighted) {
          drawRoundRect(left - 3, top - 3, size + 6, size + 6, 9, null, '#f59e0b', 3)
          drawRoundRect(left - 6, top - 6, size + 12, size + 12, 11, 'rgba(251, 191, 36, 0.2)', null)
        }
        drawBlockLayerLabel(block.layer, left + size / 2, top + size / 2, size)
        if (isHighlighted) {
          drawCenteredText('推荐', left + size / 2, top - 8, 11, '#b45309')
        }
        blockRects.push({
          blockId: block.id,
          left,
          right: left + size,
          top,
          bottom: top + size
        })
      })

    return blockRects
  }

  function drawTempSlots(layout) {
    const { state } = gameStateApi
    const tempLimit = TEMP_SLOT_LIMIT + (state.extraTempSlots || 0)
    const slotGap = 8
    const slotWidth = Math.floor((layout.tempArea.width - slotGap * (tempLimit + 1)) / tempLimit)
    const slotHeight = 58

    drawCenteredText(`暂存槽（当前上限 ${tempLimit}）`, layout.tempArea.left + layout.tempArea.width / 2, layout.tempArea.top + 10, 14)

    for (let i = 0; i < tempLimit; i++) {
      const left = layout.tempArea.left + slotGap + i * (slotWidth + slotGap)
      const top = layout.tempArea.top + 18
      drawRoundRect(left, top, slotWidth, slotHeight, 8, '#ffffff', '#cbd5e1')

      const slotBlock = state.tempSlots[i]
      if (slotBlock) drawRoundRect(left + 4, top + 4, slotWidth - 8, slotHeight - 8, 8, COLOR_STYLE[slotBlock.color], COLOR_STYLE.border)
    }
  }

  function drawColorBins(layout) {
    const { state } = gameStateApi
    drawCenteredText(`收纳框（${state.colorBins.length} 个 / 每个容量 3）`, layout.binsArea.left + layout.binsArea.width / 2, layout.binsArea.top + 10, 14)

    const gap = 12
    const binWidth = Math.floor((layout.binsArea.width - gap * (state.colorBins.length + 1)) / state.colorBins.length)
    const binHeight = 64
    const binTop = layout.binsArea.top + 18

    state.colorBins.forEach((bin, i) => {
      const left = layout.binsArea.left + gap + i * (binWidth + gap)
      drawRoundRect(left, binTop, binWidth, binHeight, 10, '#ffffff', '#94a3b8')
      drawRoundRect(left + 6, binTop + 8, binWidth - 12, 24, 8, COLOR_STYLE[bin.color], COLOR_STYLE.border)
      drawCenteredText(`颜色: ${bin.color}`, left + binWidth / 2, binTop + 20, 12)
      drawCenteredText(`${bin.count} / ${bin.capacity}`, left + binWidth / 2, binTop + 48, 14)
    })
  }

  function drawHelpArea(layout) {
    const { state } = gameStateApi
    const gap = 8
    const btnWidth = Math.floor((layout.helpArea.width - gap * 4) / 3)
    const btnHeight = 30
    const top = layout.helpArea.top + 6

    const hintButtonRect = {
      left: layout.helpArea.left + gap,
      top,
      right: layout.helpArea.left + gap + btnWidth,
      bottom: top + btnHeight
    }

    const addBinButtonRect = {
      left: hintButtonRect.right + gap,
      top,
      right: hintButtonRect.right + gap + btnWidth,
      bottom: top + btnHeight
    }

    const addTempButtonRect = {
      left: addBinButtonRect.right + gap,
      top,
      right: addBinButtonRect.right + gap + btnWidth,
      bottom: top + btnHeight
    }

    const drawButton = (rect, text, enabled) => {
      drawRoundRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top, 8, enabled ? '#ede9fe' : '#f1f5f9', '#a78bfa')
      drawCenteredText(text, (rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2, 12)
    }

    drawButton(hintButtonRect, '提示一步', state.adHelpState.canHintStep)
    drawButton(addBinButtonRect, '加收纳篮', state.adHelpState.canAddBin)
    drawButton(addTempButtonRect, '加暂存槽', state.adHelpState.canAddTempSlot)

    if (state.helpMessage) {
      const messageColor = state.helpMessage.includes('无解') ? '#b91c1c' : (state.helpMessage.includes('无法') ? '#92400e' : '#475569')
      drawCenteredText(state.helpMessage, layout.helpArea.left + layout.helpArea.width / 2, layout.helpArea.top + 44, 12, messageColor)
    }

    return { hintButtonRect, addBinButtonRect, addTempButtonRect }
  }

  function drawFooter(layout) {
    const { state } = gameStateApi

    const restartButtonRect = {
      left: layout.footerArea.left,
      top: layout.footerArea.top,
      right: layout.footerArea.left + Math.floor(layout.footerArea.width / 2) - 8,
      bottom: layout.footerArea.top + 36
    }
    const nextButtonRect = {
      left: restartButtonRect.right + 16,
      top: layout.footerArea.top,
      right: layout.footerArea.left + layout.footerArea.width,
      bottom: layout.footerArea.top + 36
    }

    drawRoundRect(restartButtonRect.left, restartButtonRect.top, restartButtonRect.right - restartButtonRect.left, restartButtonRect.bottom - restartButtonRect.top, 8, '#dbeafe', '#60a5fa')
    drawCenteredText('重开本关', (restartButtonRect.left + restartButtonRect.right) / 2, (restartButtonRect.top + restartButtonRect.bottom) / 2, 14)

    drawRoundRect(nextButtonRect.left, nextButtonRect.top, nextButtonRect.right - nextButtonRect.left, nextButtonRect.bottom - nextButtonRect.top, 8, state.gameStatus === 'win' ? '#dcfce7' : '#f1f5f9', '#86efac')
    drawCenteredText('下一关', (nextButtonRect.left + nextButtonRect.right) / 2, (nextButtonRect.top + nextButtonRect.bottom) / 2, 14)

    drawCenteredText(state.statusText, layout.footerArea.left + layout.footerArea.width / 2, layout.footerArea.top + 52, 14)

    return { restartButtonRect, nextButtonRect }
  }

  function drawFrame() {
    const { state, getVisibleBlocks, setLayout } = gameStateApi
    const layout = calcLayout()
    const visibleBlocks = getVisibleBlocks()

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    drawCenteredText(state.title, layout.width / 2, 20, 16)

    drawRoundRect(layout.topPanel.left, layout.topPanel.top, layout.topPanel.width, layout.topPanel.height, 12, COLOR_STYLE.panel, '#cbd5e1')
    drawCenteredText(`关卡 ${state.currentLevel}`, layout.topPanel.left + 50, layout.topPanel.top + 12, 13)

    const blockRects = drawBlocks(layout, visibleBlocks)
    drawTempSlots(layout)
    drawColorBins(layout)
    const helpButtons = drawHelpArea(layout)
    const buttons = drawFooter(layout)

    setLayout({
      blockRects,
      restartButtonRect: buttons.restartButtonRect,
      nextButtonRect: buttons.nextButtonRect,
      hintButtonRect: helpButtons.hintButtonRect,
      addBinButtonRect: helpButtons.addBinButtonRect,
      addTempButtonRect: helpButtons.addTempButtonRect
    })
  }

  return {
    drawFrame
  }
}

module.exports = {
  createRenderer
}

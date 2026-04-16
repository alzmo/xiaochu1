const { COLOR_STYLE, TEMP_SLOT_LIMIT, BIN_COUNT } = require('./config')

function createRenderer(canvas, gameStateApi) {
  const ctx = canvas.getContext('2d')

  function calcLayout() {
    const width = canvas.width
    const height = canvas.height

    const topPanel = {
      left: 16,
      top: 16,
      width: width - 32,
      height: Math.round(height * 0.56)
    }

    const tempArea = {
      left: 16,
      top: topPanel.top + topPanel.height + 14,
      width: width - 32,
      height: 84
    }

    const binsArea = {
      left: 16,
      top: tempArea.top + tempArea.height + 12,
      width: width - 32,
      height: 96
    }

    const footerArea = {
      left: 16,
      top: binsArea.top + binsArea.height + 10,
      width: width - 32,
      height: 66
    }

    return { width, height, topPanel, tempArea, binsArea, footerArea }
  }

  function drawRoundRect(left, top, width, height, radius, fillStyle, strokeStyle) {
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

        drawRoundRect(left, top, size, size, 6, COLOR_STYLE[block.color], COLOR_STYLE.border)
        drawBlockLayerLabel(block.layer, left + size / 2, top + size / 2, size)
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
    const slotGap = 8
    const slotWidth = Math.floor((layout.tempArea.width - slotGap * (TEMP_SLOT_LIMIT + 1)) / TEMP_SLOT_LIMIT)
    const slotHeight = 58

    drawCenteredText('暂存槽（最多 5 个）', layout.tempArea.left + layout.tempArea.width / 2, layout.tempArea.top + 10, 14)

    for (let i = 0; i < TEMP_SLOT_LIMIT; i++) {
      const left = layout.tempArea.left + slotGap + i * (slotWidth + slotGap)
      const top = layout.tempArea.top + 18
      drawRoundRect(left, top, slotWidth, slotHeight, 8, '#ffffff', '#cbd5e1')

      const slotBlock = state.tempSlots[i]
      if (slotBlock) {
        drawRoundRect(left + 4, top + 4, slotWidth - 8, slotHeight - 8, 8, COLOR_STYLE[slotBlock.color], COLOR_STYLE.border)
      }
    }
  }

  function drawColorBins(layout) {
    const { state } = gameStateApi
    drawCenteredText('收纳框（2 个 / 每个容量 3）', layout.binsArea.left + layout.binsArea.width / 2, layout.binsArea.top + 10, 14)

    const gap = 16
    const binWidth = Math.floor((layout.binsArea.width - gap * (BIN_COUNT + 1)) / BIN_COUNT)
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

    drawRoundRect(
      restartButtonRect.left,
      restartButtonRect.top,
      restartButtonRect.right - restartButtonRect.left,
      restartButtonRect.bottom - restartButtonRect.top,
      8,
      '#dbeafe',
      '#60a5fa'
    )
    drawCenteredText('重开本关', (restartButtonRect.left + restartButtonRect.right) / 2, (restartButtonRect.top + restartButtonRect.bottom) / 2, 14)

    drawRoundRect(
      nextButtonRect.left,
      nextButtonRect.top,
      nextButtonRect.right - nextButtonRect.left,
      nextButtonRect.bottom - nextButtonRect.top,
      8,
      state.gameStatus === 'win' ? '#dcfce7' : '#f1f5f9',
      '#86efac'
    )
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
    const buttons = drawFooter(layout)

    setLayout({
      blockRects,
      restartButtonRect: buttons.restartButtonRect,
      nextButtonRect: buttons.nextButtonRect
    })
  }

  return {
    drawFrame
  }
}

module.exports = {
  createRenderer
}

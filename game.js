const { createGameState } = require('./src/gameState')
const { createRenderer } = require('./src/renderer')

function createMainCanvas() {
  const systemInfo = wx.getSystemInfoSync()
  const canvas = wx.createCanvas()
  canvas.width = systemInfo.windowWidth
  canvas.height = systemInfo.windowHeight
  return canvas
}

function boot() {
  const canvas = createMainCanvas()
  const gameState = createGameState()
  const renderer = createRenderer(canvas, gameState)

  let lastTime = Date.now()

  wx.onTouchStart((event) => {
    const touch = event.touches && event.touches[0]
    if (!touch) return
    gameState.handleTap(touch.clientX, touch.clientY)
  })

  function loop() {
    const now = Date.now()
    const deltaMs = now - lastTime
    lastTime = now

    gameState.update(deltaMs)
    renderer.drawFrame()

    requestAnimationFrame(loop)
  }

  loop()
}

boot()

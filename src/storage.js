const SAVE_KEY = 'stack_mine_progress_v1'

function readSave() {
  const raw = wx.getStorageSync(SAVE_KEY)
  if (!raw || typeof raw !== 'object') return null
  return raw
}

function loadProgress() {
  const save = readSave()
  if (!save || typeof save.currentLevel !== 'number' || save.currentLevel < 1) return 1
  return Math.floor(save.currentLevel)
}

function saveProgress(currentLevel) {
  const safeLevel = Math.max(1, Math.floor(currentLevel || 1))
  wx.setStorageSync(SAVE_KEY, {
    currentLevel: safeLevel,
    updatedAt: Date.now()
  })
}

module.exports = {
  loadProgress,
  saveProgress
}

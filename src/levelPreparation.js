function createLevelPreparation(buildLevelBundle) {
  const cacheByLevel = new Map()
  let preparingTask = null

  function startPrepare(level) {
    if (cacheByLevel.has(level)) return
    if (preparingTask && preparingTask.level === level) return
    preparingTask = { level }
  }

  function consumePrepared(level) {
    if (!cacheByLevel.has(level)) return null
    const bundle = cacheByLevel.get(level)
    cacheByLevel.delete(level)
    return bundle
  }

  function update() {
    if (!preparingTask) return

    const level = preparingTask.level
    const bundle = buildLevelBundle(level)
    if (bundle) {
      cacheByLevel.set(level, bundle)
      preparingTask = null
    }
  }

  return {
    startPrepare,
    consumePrepared,
    update
  }
}

module.exports = {
  createLevelPreparation
}

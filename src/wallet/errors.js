class MissingSeedError extends Error {
  constructor () {
    super('Missing seed.')
    this.name = 'MissingSeed'
  }
}

module.exports = {
  MissingSeedError
}

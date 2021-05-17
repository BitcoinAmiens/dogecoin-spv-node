class MissingSeedError extends Error {
  constructor () {
    super('Missing seed.')
    this.name = 'MissingSeed'
  }
}

class NotEnoughtKeysGenerated extends Error {
  constructor () {
    super('At least 20 keys must have been generated at first run. Not enought keys has been generated.')
    this.name = 'NotEnoughtKeysGenerated'
  }
}

module.exports = {
  MissingSeedError,
  NotEnoughtKeysGenerated
}

class OSNotSupported extends Error {
  constructor (platform) {
    super(`Platform ${platform} not supported.`)
    this.name = 'OSNotSupported'
  }
}

class MissingNetworkArg extends Error {
  constructor () {
    super('`network` argument is required.')
    this.name = 'MissingNetworkArg'
  }
}

module.exports = {
  OSNotSupported,
  MissingNetworkArg
}

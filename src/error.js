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

class MainnetNotSupported extends Error {
  constructor () {
    super('`mainnet` network supported.')
    this.name = 'MainnetNotSupported'
  }
}

class UnknownNetwork extends Error {
  constructor () {
    super('Unknown network. Please pass oe of this value : `regtest`, `testnet` or `mainnet`.')
    this.name = 'UnknownNetwork'
  }
}

module.exports = {
  OSNotSupported,
  MissingNetworkArg,
  MainnetNotSupported,
  UnknownNetwork
}

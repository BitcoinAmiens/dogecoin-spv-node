const constants = require('./constants').constants
const networks = require('./network')
const path = require('path')
const { MainnetNotSupported, UnknownNetwork } =require('./error')

function getSettings (network, dev) {
  let settings

  switch (network) {
    case networks.REGTEST:
      settings = constants.regtest
      break
    case networks.TESTNET:
      settings = constants.testnet
      break
    case networks.MAINNET:
      throw new MainnetNotSupported()
    default:
      throw new UnknownNetwork()
  }

  if (dev) {
    settings.DATA_FOLDER = path.join(__dirname, '..', 'data', settings.DATA_SUBFOLDER)
  } else {
    settings.DATA_FOLDER = path.join(process.env.HOME, '.dogecoin-spv', settings.DATA_SUBFOLDER)
  }

  return settings
}

module.exports = { getSettings }

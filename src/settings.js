const constants = require('./constants').constants
const networks = require('./network')
const path = require('path')
const os = require('os')
const { MainnetNotSupported, UnknownNetwork } = require('./error')

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
    let platformDataFolder = os.homedir()
    switch (process.platform) {
      case 'darwin':
        platformDataFolder = path.join(platformDataFolder, 'Library', 'Application Support')
        break
      case 'win32':
        platformDataFolder = path.join(platformDataFolder, 'AppData', 'Local')
        break
      default:
        platformDataFolder = path.join(platformDataFolder, '.local', 'share')
    }
    settings.DATA_FOLDER = path.join(platformDataFolder, '.dogecoin-spv', settings.DATA_SUBFOLDER)
  }

  return settings
}

module.exports = { getSettings }

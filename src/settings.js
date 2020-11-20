const constants = require('./constants').constants
const networks = require('./network')

function getSettings (network) {
  let settings

  switch (network) {
    case networks.REGTEST:
      settings = constants.regtest
      break
    case networks.TESTNET:
      settings = constants.testnet
      break
    default:
      // should be mainnet but now throw error
      throw new Error('This a beta version. Mainnet not supported.')
  }

  settings.DATA_FOLDER = path.join(__dirname, '..', 'data', settings.DATA_SUBFOLDER)
  
  return settings
}

module.exports = { getSettings }

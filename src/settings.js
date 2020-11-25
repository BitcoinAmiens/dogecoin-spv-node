const constants = require('./constants').constants
const networks = require('./network')
const path = require('path')

function getSettings (network, dev) {
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
  
  if (dev) {
    settings.DATA_FOLDER = path.join(__dirname, '..', 'data', settings.DATA_SUBFOLDER)
  } else {
    settings.DATA_FOLDER = path.join(process.env.HOME, '.dogecoin-spv', settings.DATA_SUBFOLDER)
  }
  
  return settings
}

module.exports = { getSettings }

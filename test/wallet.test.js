const test = require('ava')
const Wallet = require('../src/wallet')
const { getSettings } = require('../src/settings')
const networks = require('../src/network')
const bip32 = require('bip32')


test('should generate a new address', t => {
  var settings = getSettings(networks.REGTEST)
  var wallet = new Wallet(settings)
  
  let address = wallet.generateNewAddress()
  
  t.true(address.startsWith('n') || address.startsWith('m'))  
})

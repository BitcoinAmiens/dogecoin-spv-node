const test = require('ava')
const Wallet = require('../src/wallet')
const { getSettings } = require('../src/settings')
const networks = require('../src/network')
const fs = require('fs')
const path = require('path')

test.before(t => {
  // setup wallet files
  let settings = getSettings(networks.REGTEST)
  // Only use this mnemonic for test!
  const mnemonic = 'neutral acoustic balance describe access pitch tourist skull recycle nation silent crawl'

  if (!fs.existsSync(settings.DATA_FOLDER)) {
    fs.mkdirSync(settings.DATA_FOLDER, {recursive: true})
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'spvnode'))
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'wallet'))
    
    let wallet = new Wallet(settings)
    wallet.createSeedFile(mnemonic)
    wallet.init()
  }
  
})

test('should generate a new address', t => {
  let settings = getSettings(networks.REGTEST)
  let wallet = new Wallet(settings)
  
  let address = wallet.generateNewAddress()
  
  t.true(address.startsWith('n') || address.startsWith('m'))  
})
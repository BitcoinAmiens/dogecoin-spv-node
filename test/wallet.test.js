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
  }
  
  let wallet = new Wallet(settings)
  
  if (!fs.existsSync(wallet.seed_file)) {
    wallet.createSeedFile(mnemonic)
  }  
  
  t.context = { wallet }
  
})

test('should generate a new address', t => {
  let wallet = t.context.wallet
  
  let address = wallet.generateNewAddress()
  
  t.true(address.startsWith('n') || address.startsWith('m'))  
})
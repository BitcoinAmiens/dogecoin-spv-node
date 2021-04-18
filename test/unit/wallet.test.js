const test = require('ava')
const Wallet = require('../../src/wallet')
const { getSettings } = require('../../src/settings')
const networks = require('../../src/network')
const fs = require('fs')
const path = require('path')
const { decodeTxMessage } = require('../../src/commands/tx')
const { SATOSHIS, MIN_FEE } = require('../../src/constants')


test.before(t => {
  // setup wallet files
  let settings = getSettings(networks.REGTEST)
  
  // Test data folder
  settings.DATA_FOLDER = path.join(__dirname, 'data')

  // Only use this mnemonic for test!
  const mnemonic = 'neutral acoustic balance describe access pitch tourist skull recycle nation silent crawl'

  if (!fs.existsSync(settings.DATA_FOLDER)) {
    fs.mkdirSync(settings.DATA_FOLDER, {recursive: true})
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'wallet'))
  }
  
  let wallet = new Wallet(settings)
  
  if (!fs.existsSync(wallet.seed_file)) {
    wallet.createSeedFile(mnemonic)
  }  
  
  t.context = { wallet }
})

test.after(t => {
    // Clean after
    fs.rmdirSync(path.join(__dirname, 'data'), {recursive: true})
})

test.serial('should generate a new address', t => {
  let wallet = t.context.wallet
  
  let address = wallet.generateNewAddress()
    
  t.is(address, 'n3ajdvaJC3BVB92pQnoJ88MN5exnFNDhxe')  
})

test.serial('should save the tx', async t => {
  let wallet = t.context.wallet

  const rawTransaction = '01000000016ca871d43b0ebed02d4402af7623c7adae5321b70aba59da362e493b23da59c300000000484730440220572da036010d09744835903e14087be4fdea7482df3f94291178832ad8579ded02204d464cdcb8d394c6c663e986e7b6b32a68c22cf30d8f5f7cfbb854ad14dc297001feffffff0200e87648170000001976a914f209dd7f1451468a67dc4f98d945d83be056a80d88ac007fa213470b00001976a91439a6b6e32361ed8268355a00b06c218963c7bb7688acc5010000'
  const tx = decodeTxMessage(Buffer.from(rawTransaction, 'hex'))

  await wallet.addTxToWallet(tx)
  
  return wallet.db.txs.get('da4cfccc4abb6c417b1225e29881ac1f00e08ad1f2f1ed4e0f4c311b56de934500000000')
    .then(function (value) { t.pass() })
    .catch(function (error) { t.fail(error.message) })
})

test.serial('should create a newly signed transaction', async t => {
  let wallet = t.context.wallet
  
  let amount = 10n
  let tx = await wallet.send(amount, 'nVttKKCcjJT5k3TZKe54HedpZugbwfsp5W', MIN_FEE * SATOSHIS)
  
  t.is(decodeTxMessage(tx).txIns[0].signature, '483045022100cb08c91a6de8b3bc8b9738927e891397b988952cbc8b25c18f5555948945028002206895857c3871ff1e29da8005d85c0233898cf7e0c0b63810e03ce087bdfc7e64012102c8a4ac5ff642b0ede931afd357e5c6bb9a5c6c65c6e9aee68f72ca5a6d54219d')
})
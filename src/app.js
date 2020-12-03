const SPVNode = require('./spvnode')
const Wallet = require('./wallet')
const { getSettings } = require('./settings')
const networks = require('./network')
const { setupLog } = require('./debug')
const debug = require('debug')('app')
const Interface = require('./interface/interface')
const Store = require('./store/store')
const { OSNotSupported } = require('./error')

const fs = require('fs')
const path = require('path')
const process = require('process')

// TODO: app args should be the app settings
async function app (args) {
  if (typeof args.network !== 'string') {
    throw new Error('`network` argument is required.')
  }

  // Only support 'linux' for now
  if (process.platform !== 'linux') {
    throw new OSNotSupported(process.platform)
  }

  const settings = getSettings(args.network, args.dev)
  // Redirect output stream to log file
  setupLog()

  // Create data folders for data
  if (!fs.existsSync(settings.DATA_FOLDER)) {
    fs.mkdirSync(settings.DATA_FOLDER, { recursive: true })
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'spvnode'))
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'wallet'))
  }

  const SEED_FILE = path.join(settings.DATA_FOLDER, 'seed.json')

  // Create Wallet
  const wallet = new Wallet(settings)

  // Interface Store (keep track of all the data)
  const store = new Store()

  // get balance
  wallet.getBalance()
    .then(function (balance) {
      store.setBalance(balance)
    })

  // Will be needed in the interface
  const sendTransaction = (amount, address) => {
    wallet.send(amount, address)
      .then(function (rawTransaction) {
        debug(rawTransaction.toString('hex'))

        spvnode.sendRawTransaction(rawTransaction)
        debug('SENT !')
      })
  }

  // Will be needed in the interface
  const getAddress = () => { return wallet.getAddress() }

  // Create Interface
  const ui = new Interface({
    store,
    getAddress,
    sendTransaction
  })

  // Do we have seed already ?
  try {
    fs.accessSync(SEED_FILE)
  } catch (err) {
    const mnemonic = wallet.generateMnemonic()
    wallet.createSeedFile(mnemonic)
    ui.showMnemonicScreen(mnemonic)
    // TODO: It has to be a better way
    while (!ui.screen.continue) {
      await new Promise((resolve, reject) => setTimeout(resolve, 2000))
    }
  }

  // We made sure we have a seed file
  wallet.init()
  // show main screen
  ui.showMainScreen()

  // Because of how weird javascript works we can have this before
  // instanciating spvnode
  ui.on('quit', async function () {
    debug("'quit' event received from the ui")

    if (spvnode.isShuttingDown()) { return }

    await spvnode.shutdown()

    process.exit()
  })

  wallet.on('balance', function () {
    debug('BALANCE UPDATED!')
    wallet.getBalance()
      .then(function (newBalance) {
        store.setBalance(newBalance)
      })
  })

  const pubkeyHashes = []
  wallet.pubkeyHashes.forEach(function (value, key) {
    // TODO: remove change addresses. This is not needed in the filter ?
    pubkeyHashes.push(key.toString('hex'))
  })

  // Create SPV node
  const spvnode = new SPVNode(pubkeyHashes, settings)

  spvnode.on('tx', function (tx) {
    // Register tx to wallet! Maybe it ours... maybe not
    wallet.addTxToWallet(tx)
  })

  spvnode.on('synchronized', function (newData) {
    debug('Our node is synchronized')
    store.setSPVState(newData)
  })

  spvnode.on('newState', function (newData) {
    store.setSPVState(newData)
  })

  spvnode.on('reject', function (rejectMessage) {
    debug(rejectMessage)
    store.setRejectMessage(rejectMessage)
  })

  // catches ctrl+c event
  process.on('SIGINT', async function () {
    debug('SIGINT received interrupting process...')

    if (spvnode.isShuttingDown()) {
      debug('Is already shutting down')
      return
    }

    // Close wallet and stop spv node
    await spvnode.shutdown()

    process.exit()
  })

  // catches SIGTERM events
  process.on('SIGTERM', async function () {
    // Close wallet and stop spv node
    debug('SIGTERM received terminating process...')

    if (spvnode.isShuttingDown()) { return }

    await spvnode.shutdown()

    process.exit()
  })

  // Add regtest peer
  if (args.network === networks.REGTEST) {
    await spvnode.addPeer(settings.NODE_IP, settings.DEFAULT_PORT)
  }

  await spvnode.start()

  // start synchronizing
  await spvnode.synchronize()
}

module.exports = app

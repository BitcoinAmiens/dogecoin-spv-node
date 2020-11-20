const SPVNode = require('./spvnode')
const Wallet = require('./wallet')
const { getSettings } = require('./settings')
const networks = require('./network')
const debug = require('debug')('app')
const Interface = require('./interface/interface')
const Store = require('./store/store')

const fs = require('fs')
const path = require('path')

// TODO: app args should be the app settings
async function app (args) {
  
  if (typeof args.network !== 'string') {
    throw new Error('`network` argument is required.')
  }
  
  var settings = getSettings(args.network)

  //////////////////////////////////
  //
  // Create data folders for data
  //
  //////////////////////////////////
  if (!fs.existsSync(settings.DATA_FOLDER)) {
    fs.mkdirSync(settings.DATA_FOLDER, {recursive: true})
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'spvnode'))
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'wallet'))
  }
  
  const SEED_FILE = path.join(settings.DATA_FOLDER, 'seed.json')


  //////////////////////////////////
  //
  // Create Wallet
  //
  //////////////////////////////////
  const wallet = new Wallet()

  //////////////////////////////////
  //
  // Interface Store (keep track of all the data)
  //
  //////////////////////////////////
  const store = new Store()


  //////////////////////////////////
  //
  // Interface <--> Wallet functions
  //
  //////////////////////////////////

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
  
  // Generate mnmonic in case we don't have one yet
  const generateMnemonic = () => { return }

  //////////////////////////////////
  //
  // Create Interface
  //
  //////////////////////////////////
  const interface = new Interface({
    store,
    getAddress,
    sendTransaction
  })
  
  // Going to glitch ?
  
  ///////////////////////////////////
  //
  //   Do we have seed already ?
  //
  //////////////////////////////////
  try {
    fs.accessSync(SEED_FILE)
  } catch (err) {
    const mnemonic = wallet.generateMnemonic() 
    wallet.createSeedFile(mnemonic)
    interface.showMnemonicScreen(mnemonic)
    // TODO: It has to be a better way
    while (!interface.screen.continue) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  
  // We made sure we have a seed file
  wallet.init()
  
  // show main screen
  interface.showMainScreen()

  //////////////////////////////////
  //
  // Event listeners !!!!!!!!!!
  //
  //////////////////////////////////

  // Because of how weird javascript works we can have this before
  // instanciating spvnode
  interface.on('quit', async function () {
    debug("'quit' event received from the interface")

    if (spvnode.isShuttingDown()) {return}

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

  let pubkeyHashes = []
  wallet.pubkeyHashes.forEach(function (value, key) {
    // TODO: remove change addresses. This is not needed in the filter ?
    pubkeyHashes.push(key.toString('hex'))
  })

  //////////////////////////////////
  //
  // Create SPV node
  //
  //////////////////////////////////
  var spvnode = new SPVNode(pubkeyHashes, settings)


  //////////////////////////////////
  //
  // More listeners !!!!!!
  //
  //////////////////////////////////

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

  //////////////////////////////////
  //
  // Stopping this damn app
  //
  //////////////////////////////////

  //catches ctrl+c event
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

  //catches SIGTERM events
  process.on('SIGTERM', async function () {
    // Close wallet and stop spv node
    debug('SIGTERM received terminating process...')

    if (spvnode.isShuttingDown()) {return}

    await spvnode.shutdown()

    process.exit()
  })

  //////////////////////////////////
  //
  // Starting this damn app
  //
  //////////////////////////////////

  // Add regtest peer
  if (args.network === networks.REGTEST) {
    await spvnode.addPeer(settings.NODE_IP, settings.DEFAULT_PORT)
  }

  await spvnode.start()

  // start synchronizing
  await spvnode.synchronize()

}

module.exports = app

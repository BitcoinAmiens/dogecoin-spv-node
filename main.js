const SPVNode = require('./src/spvnode')
const Wallet = require('./src/wallet')
const constants = require('./src/constants')
const network = require('./src/network')
const debug = require('debug')('main')
const Interface = require('./src/interface/interface')
const Store = require('./src/store/store')

const fs = require('fs')
const path = require('path');

// TODO: regtest IP node should be moved to constant
const NODE_IP = '127.0.0.1'

async function main () {

  //////////////////////////////////
  //
  // Create data folders for data
  //
  //////////////////////////////////
  if (!fs.existsSync(constants.DATA_FOLDER)) {
    fs.mkdirSync(constants.DATA_FOLDER, {recursive: true})
    fs.mkdirSync(path.join(constants.DATA_FOLDER, 'spvnode'))
    fs.mkdirSync(path.join(constants.DATA_FOLDER, 'wallet'))
  }

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
        debug(rawTransaction)

        spvnode.sendRawTransaction(rawTransaction)
        debug('SENT !')
      })
    }

  // Will be needed in the interface
  const getAddress = () => { return wallet.getAddress() }

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
  var spvnode = new SPVNode(pubkeyHashes)


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
  // Staring this damn app
  //
  //////////////////////////////////

  // Add regtest peer
  if (process.env.NETWORK === network.REGTEST) {
    await spvnode.addPeer(NODE_IP, constants.DEFAULT_PORT)
  }

  await spvnode.start()

  // start synchronizing
  await spvnode.synchronize()

}

main()

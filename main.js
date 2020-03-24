var SPVNode = require('./src/spvnode')
var Wallet = require('./src/wallet')
const constants = require('./src/constants')
const debug = require('debug')('main')
const Interface = require('./interface')
const fs = require('fs')

// TODO: regtest IP node should be moved to constant
const NODE_IP = '192.168.50.4'
const AMOUNT = 2000 * constants.SATOSHIS
// TODO: Create proper test
const TO_ADDRESS = 'n3p9T8GtBwC6DSK1neCuE1XPs7ftroRx63'


async function main () {

  // Create data folder
  if (!fs.existsSync(constants.DATA_FOLDER)) {
    fs.mkdirSync(constants.DATA_FOLDER)
    fs.mkdirSync(constants.DATA_FOLDER + '/spvnode')
    fs.mkdirSync(constants.DATA_FOLDER + '/wallet')
  }

  // Create interface
  const interface = new Interface()

  // Create wallet
  const wallet = new Wallet()

  // get balance
  var balance = await wallet.getBalance()

  wallet.on('balance', function () {
    debug('BALANCE UPDATED!')
    wallet.getBalance()
      .then(function (balance) {
        debug('New Balance :', balance/constants.SATOSHIS)
      })
  })

  let pubkeyHashes = []
  wallet.pubkeyHashes.forEach(function (value, key) {
    pubkeyHashes.push(key.toString('hex'))
  })

  var spvnode = new SPVNode(pubkeyHashes)

  spvnode.on('tx', function (tx) {
    // Register tx to wallet!
    wallet.addTxToWallet(tx)
  })

  spvnode.on('synchronized', function () {
    debug('Our node is synchronized')

    wallet.getBalance()
      .then(function (balance) {
        debug(balance/constants.SATOSHIS)
      })

    /*wallet.send(AMOUNT, TO_ADDRESS)
      .then(function (rawTransaction) {
        debug(rawTransaction)
        //spvnode.sendRawTransaction(rawTransaction)
      })*/

  })

  spvnode.on('newState', function (newData) {
    newData = {
      ...newData,
      balance
    }
    interface.update(newData)
  })

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

  // TODO: Start regtest or testnet
  // process.env.NETWORK

  // Add regtest peer
  //await spvnode.addPeer(NODE_IP, constants.DEFAULT_PORT)
  // Initiate node and load database values

  try {
    await spvnode.start()
  } catch (error) {
    console.log(error)
    process.exit()
  }


  // start synchronizing
  await spvnode.synchronize()

}

main()

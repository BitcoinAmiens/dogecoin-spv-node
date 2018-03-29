var Peer = require('./peer')
var level = require('level')
var BloomFilter = require('bloom-filter')
const constants = require('./constants')
var { ADDRESSES } = require('../walletAddresses')

const NODE_IP = '192.168.50.4'
const NODE_PORT = 18444

class SPVNode {
  constructor () {
    this.peers = []
    this.balance = 0
    this.height = 0
    this.txs = []
    this.db = level(__dirname + '/db')
  }

  start () {
    var peer = new Peer(NODE_IP, NODE_PORT, this)
    this.peers.push(peer)

    peer.connect().then(() => {
      // Prepare filter here
      var filter = BloomFilter.create(ADDRESSES.length, 0.001)
      for (var index in ADDRESSES) {
        var bufferAddress = new Buffer(ADDRESSES[index])
        filter.insert(bufferAddress)
      }

      // We want the filter to autoupdate
      filter.nFlags = 1

      //
      peer.sendFilterLoad(filter).then(() => {
        // peer.sendGetHeader()
        peer.sendGetBlocks()
        // peer.sendGetData()
      })
    })
      .catch((error) => {
        console.log(error)
      })
  }

  updateBalance (newBalance) {
    this.balance += newBalance
    console.log('Update balance :', this.balance / constants.SATOSHIS)
  }

  updateTxs (newTx) {
    // Verify if we already have this tx
    // If not added it txs array
    // else do nothing
    if (this.txs.indexOf(newTx) >= 0) {
      return
    }

    // TODO: need to verify if address belongs to wallet
    // And we actually need txOuts records not txs stupid (:heart:)
    this.txs.push(newTx)

    // Update balance now
    newTx.txOuts.forEach((txOut) => {
      this.updateBalance(txOut.value)
    })
  }

  updateHeight (newHeight) {
    this.height = newHeight
  }
}

module.exports = SPVNode

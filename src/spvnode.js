var Peer = require('./peer')
var level = require('level')
var BloomFilter = require('bloom-filter')
var { ADDRESSES } = require('../walletAddresses')

const NODE_IP = '127.0.0.1'
const NODE_PORT = 18444

class SPVNode {
  constructor () {
    this.peers = []
    this.db = level(__dirname + '/db')
  }

  start () {
    var peer = new Peer(NODE_IP, NODE_PORT)
    this.peers.push(peer)

    peer.connect().then(() => {
      // Prepare filter here
      var filter = BloomFilter.create(ADDRESSES.length, 0.001)
      for (var index in ADDRESSES) {
        var bufferAddress = new Buffer(ADDRESSES[index])
        filter.insert(bufferAddress)
      }

      // Load filter
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
}

module.exports = SPVNode

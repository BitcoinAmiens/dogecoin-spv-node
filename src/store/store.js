const EventEmitter = require('events')

class Store extends EventEmitter {
  balance = 0
  height = 0
  bestHeight = 0
  hash = null
  peers = new Map()
  tips = new Map()
  merkleHeight = 0

  getNumPeers () {
    return this.peers.length
  }

  setBalance (balance) {
    this.balance = balance

    this.emit('changed')
  }

  setSPVState (data) {
    this.height = data.height
    this.bestHeight = data.bestHeight
    this.hash = data.hash
    this.peers = data.peers
    this.tips = data.tips
    this.merkleHeight = data.merkleHeight

    this.emit('changed')
  }

}

module.exports = Store

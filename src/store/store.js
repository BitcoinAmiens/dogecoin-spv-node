const EventEmitter = require('events')

class Store extends EventEmitter {
  constructor () {
    super()

    this.balance = BigInt(0)
    this.height = 0
    this.bestHeight = 0
    this.hash = null
    this.peers = new Map()
    this.tips = new Map()
    this.merkleHeight = 0
    this.rejectMessage = {}
    this.paymentChannels = []
  }

  getNumPeers () {
    return this.peers.length
  }

  setBalance (balance) {
    this.balance = balance

    this.emit('changed')
  }

  setSPVState (data) {
    if (data === undefined) { throw new Error("Received 'undefined' set of data") }

    this.height = data.height
    this.bestHeight = data.bestHeight
    this.hash = data.hash
    this.peers = data.peers
    this.tips = data.tips
    this.merkleHeight = data.merkleHeight

    this.emit('changed')
  }

  setRejectMessage (rejectMessage) {
    this.rejectMessage = rejectMessage

    this.emit('rejected')
  }

  setPaymentChannels (paymentChannels) {
    this.paymentChannels = paymentChannels

    this.emit('changed')
  }
}

module.exports = Store

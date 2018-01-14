var net = require('net')
var crypto = require('crypto')
var EventEmitter = require('events')
var BloomFilter = require('bloom-filter')

var packet = require('./commands/packet')
var version = require('./commands/version')
var inv = require('./commands/inv')
var filterload = require('./commands/filterload')

class Peer extends EventEmitter {
  constructor (ip, port) {
    super()

    this.id = -1
    this.socket = new net.Socket()
    this.ip = ip
    this.port = port
    this.servcies
    this.version
    this.agent
    this.verack = false
    this.closed = false

    this.socket.on('data', this._onData.bind(this))
    this.socket.on('close', this._onClose.bind(this))
  }

  connect () {
    return new Promise ( (resolve, reject) => {
      this.socket.connect(this.port, this.ip, () => {
        console.log('Connect')
        var message = version.versionMessage()
        const versionPacket = packet.preparePacket('version', message)
        this.socket.write(versionPacket)

        this.on('verack', function () {
          resolve()
        })

        this.on('closed', function () {
          this.closed = true
          reject('closed')
        })
      })
    })
  }

  _onData (data) {
    var decodedResponse = packet.decodePacket(data)

    switch (decodedResponse.cmd) {
      case 'version':
        console.log('version command received')
        const versionMessage = version.decodeVersionMessage(decodedResponse.payload)
        this._sendVerackMessage()
        break
      case 'verack':
        this.verack = true
        this.emit('verack')
        console.log('verack command received')
        break
      case 'ping':
        this._sendPongMessage()
        break
      case 'inv':
        const invMessage = inv.decodeInvMessage(decodedResponse.payload)
        console.log(invMessage)
        break
      default:
        console.log(decodedResponse.cmd)
    }
  }

  sendAddr () {

  }

  sendGetAddr () {
    var getAddrMessage = packet.preparePacket('getaddr', Buffer.alloc(0))
    this.socket.write(getAddrMessage)
  }

  sendFilterLoad () {
    const address = 'ngGM8A6kjA8HSvkCJac2UkSAHanZifUBWY'
    var filter = BloomFilter.create(1, 0.0001)
    var bufferAddress = new Buffer(address)
    filter.insert(bufferAddress)
    var payload = filterload.encodeFilterLoad(filter.toObject())
    const filterloadMessage = packet.preparePacket('filterload', payload)
    console.log(filterloadMessage)
    this.socket.write(filterloadMessage)
  }

  _sendVerackMessage () {
    var verackMessage = packet.preparePacket('verack', Buffer.alloc(0))
    this.socket.write(verackMessage)
  }

  _sendPongMessage () {
    const pongMessage = packet.preparePacket('pong', crypto.randomBytes(64))
    this.socket.write(pongMessage)
  }

  _onClose (response) {
    this.emit('closed')
    console.log('Closing: ' + response)
  }
}

module.exports = Peer

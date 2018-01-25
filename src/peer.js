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

        this.on('verack', function () {
          resolve()
        })

        this.on('closed', function () {
          this.closed = true
          reject('closed')
        })

        this.socket.write(versionPacket)
      })
    })
  }

  _onData (data) {

    var decodedResponses = []

    // decode packet need to be able to decode several message in one packet
    // https://stackoverflow.com/questions/1010753/missed-socket-message#1010777
    while (data.length > 0) {
      var decodedResponse = packet.decodePacket(data)
      if (!decodedResponse) {
        break
      }
      data = data.slice(decodedResponse.length + 24)
      decodedResponses.push(decodedResponse)
    }

    decodedResponses.forEach((msg) => {
      console.log(msg)
      switch (msg.cmd) {
        case 'version':
          const versionMessage = version.decodeVersionMessage(msg.payload)
          this._sendVerackMessage()
          break
        case 'verack':
          this.verack = true
          this.emit('verack')
          break
        case 'ping':
          this._sendPongMessage()
          break
        case 'inv':
          const invMessage = inv.decodeInvMessage(msg.payload)
          console.log(invMessage)
          break
        default:
          console.log(msg.cmd)
      }
    })
  }

  sendAddr () {

  }

  sendGetAddr () {
    var getAddrMessage = packet.preparePacket('getaddr', Buffer.alloc(0))
    this.socket.write(getAddrMessage)
  }

  sendFilterLoad () {
    const address = '5b2a3f53f605d62c53e62932dac6925e3d74afa5a4b459745c36d42d0ed26a69'
    var filter = BloomFilter.create(1, 0.0001)
    var bufferAddress = new Buffer(address)
    filter.insert(bufferAddress)
    console.log(filter.toObject().vData)
    var payload = filterload.encodeFilterLoad(filter.toObject())
    console.log(payload)
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

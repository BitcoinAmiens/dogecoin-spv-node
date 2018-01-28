var net = require('net')
var EventEmitter = require('events')
var BloomFilter = require('bloom-filter')

var packet = require('./commands/packet')
var version = require('./commands/version')
var inv = require('./commands/inv')
var filterload = require('./commands/filterload')
var getheaders = require('./commands/getheaders')
var headers = require('./commands/headers')

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
          this._sendPongMessage(msg.payload)
          break
        case 'inv':
          const invMessage = inv.decodeInvMessage(msg.payload)
          break
        case 'headers':
          const headersMessage = headers.decodeHeadersMessage(msg.payload)
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
    const address = '3d2160a3b5dc4a9d62e7e66a295f70313ac808440ef7400d6c0772171ce973a5'
    var filter = BloomFilter.create(1, 0.0001)
    var bufferAddress = new Buffer(address)
    filter.insert(bufferAddress)
    var payload = filterload.encodeFilterLoad(filter.toObject())
    const filterloadMessage = packet.preparePacket('filterload', payload)
    this.socket.write(filterloadMessage)
    console.log('Filterload sent !')
  }

  sendGetHeader () {
    console.log('Prepare getHeaders')
    var payload = getheaders.encodeGetheadersMessage()
    const getHeadersMessage = packet.preparePacket('getheaders', payload)
    this.socket.write(getHeadersMessage)
  }

  sendGetData () {
    var getDataMessage = packet.preparePacket('getdata', Buffer.alloc(0))
    this.socket.write(getDataMessage)
  }

  _sendVerackMessage () {
    var verackMessage = packet.preparePacket('verack', Buffer.alloc(0))
    this.socket.write(verackMessage)
  }

  _sendPongMessage (nonce) {
    const pongMessage = packet.preparePacket('pong', nonce)
    this.socket.write(pongMessage)
  }

  _onClose (response) {
    this.emit('closed')
    console.log('Closing: ' + response)
  }
}

module.exports = Peer

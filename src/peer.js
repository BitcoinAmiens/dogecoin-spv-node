var net = require('net')
var EventEmitter = require('events')

var packet = require('./commands/packet')
var version = require('./commands/version')
var inv = require('./commands/inv')
var filterload = require('./commands/filterload')
var getheaders = require('./commands/getheaders')
var headers = require('./commands/headers')
var getblocks = require('./commands/getblocks')
var reject = require('./commands/reject')
var block = require('./commands/block')
var merkleblock = require('./commands/merkleblock')
var tx = require('./commands/tx')

const { GENESIS_BLOCK_HASH } = require('./constants')

class Peer extends EventEmitter {
  constructor (ip, port, node) {
    super()

    this.node = node

    this.id = -1
    this.socket = new net.Socket()
    this.ip = ip
    this.port = port
    this.servcies
    this.version
    this.agent
    this.verack = false
    this.closed = false
    this.incompleteData
    this.bestHeight = 0

    this.socket.on('data', this._onData.bind(this))
    this.socket.on('close', this._onClose.bind(this))
  }

  connect () {
    return new Promise ( (resolve, reject) => {
      this.socket.connect(this.port, this.ip, () => {
        console.log('Connecting...')
        var message = version.versionMessage()
        const versionPacket = packet.preparePacket('version', message)

        this.on('verack', function () {
          console.log('Connected !')
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

    if (this.incompleteData) {
      data = Buffer.concat([this.incompleteData, data], this.incompleteData.length + data.length)
      this.incompleteData = null
    }

    var decodedResponses = []

    // decode packet need to be able to decode several message in one packet
    // https://stackoverflow.com/questions/1010753/missed-socket-message#1010777
    while (data.length > 0) {
      var decodedResponse = packet.decodePacket(data)
      if (!decodedResponse) {
        this.incompleteData = Buffer.allocUnsafe(data.length)
        data.copy(this.incompleteData)
        break
      }
      data = data.slice(decodedResponse.length + 24)
      decodedResponses.push(decodedResponse)
    }

    decodedResponses.forEach((msg) => {
      switch (msg.cmd) {
        case 'version':
          const versionMessage = version.decodeVersionMessage(msg.payload)
          this._handleVersionMessage(versionMessage)
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
          var payload = inv.encodeInvMessage(invMessage)
          console.log(invMessage)
          this.sendGetData(payload)
          break
        case 'headers':
          const headersMessage = headers.decodeHeadersMessage(msg.payload)
          this._updateHeaders(headersMessage)
          break
        case 'reject':
          const rejectMessage = reject.decodeRejectMessage(msg.payload)
          console.log(rejectMessage)
          break
        case 'block':
          const blockMessage = block.decodeBlockMessage(msg.payload)
          console.log(blockMessage)
          break
        case 'merkleblock':
          const merkleblockMessage = merkleblock.decodeMerkleblockMessage(msg.payload)
          // console.log(merkleblockMessage)
          break
        case 'tx':
          const txMessage = tx.decodeTxMessage(msg.payload)
          // console.log(txMessage)
          this._updateTxs(txMessage)
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

  sendFilterLoad (filter) {
    var payload = filterload.encodeFilterLoad(filter.toObject())
    const filterloadMessage = packet.preparePacket('filterload', payload)
    return new Promise((resolve, reject) => {
      this.socket.write(filterloadMessage, function (err) {
        if (err) {
          reject(err)
          return
        }
        console.log('Filter loaded')
        resolve()
      })
    })
  }

  sendGetHeader (blockHash = GENESIS_BLOCK_HASH) {
    console.log(blockHash)
    var payload = getheaders.encodeGetheadersMessage(blockHash)
    const getHeadersMessage = packet.preparePacket('getheaders', payload)
    this.socket.write(getHeadersMessage, function (err) {
      if (err) {
        console.error(err)
        return
      }
      console.log('getheaders message sent')
    })
  }

  sendGetBlocks (blockHash = GENESIS_BLOCK_HASH) {
    var payload = getblocks.encodeGetblocksMessage(blockHash)
    const getBlocksMessage = packet.preparePacket('getblocks', payload)
    this.socket.write(getBlocksMessage, function (err) {
      if (err) {
        console.error(err)
        return
      }
      console.log('getblocks message sent')
    })
  }

  sendGetData (inv) {
    var getDataMessage = packet.preparePacket('getdata', inv)
    this.socket.write(getDataMessage, function (err) {
      if (err) {
        console.error(err)
        return
      }
      console.log('inv message sent')
    })
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

  _updateTxs (txMessage) {
    this.node.updateTxs(txMessage)
  }

  _updateHeaders (headersMessage) {
    console.log(headersMessage.headers[0])
    this.node.updateHeaders(headersMessage.headers)
  }

  _handleVersionMessage (versionMessage) {
    this.bestHeight = versionMessage.height
    this._sendVerackMessage()
  }
}

module.exports = Peer

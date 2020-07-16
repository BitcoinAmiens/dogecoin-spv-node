var net = require('net')
var EventEmitter = require('events')
var debug = require('debug')('peer')

const doubleHash = require('./utils/doubleHash')

const { readU64 } = require('./utils/write64')

var packet = require('./commands/packet')
var version = require('./commands/version')
var inv = require('./commands/inv')
var filterload = require('./commands/filterload')
var filteradd = require('./commands/filteradd')
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
    this.count = 0

    this.socket.on('data', this._onData.bind(this))
    this.socket.on('close', this._onClose.bind(this))
    this.socket.on('error', this._onError.bind(this))
    this.socket.on('timeout', this._onTimeOut.bind(this))

  }

  connect () {
    return new Promise ((resolve, reject) => {
      let something = this.socket.connect(this.port, this.ip, (res) => {
        debug('Connecting to', this.ip)
        var message = version.versionMessage()
        const versionPacket = packet.preparePacket('version', message)

        this.on('verack', function () {
          debug('Connected !')
          resolve()
        })

        this.on('closed', function () {
          this.closed = true
          reject('closed')
        })

        this.on('error', function () {
          debug('error while connecting')
          this.closed = true
          reject('error')
        })

        this.on('timeout', function () {
          this.closed = true
          reject('timeout')
        })

        this.socket.write(versionPacket)
      })
    })
  }

  _onError (error) {
    // TODO: register as not working node...
    debug(`ERROR ! ${this.ip} ${error}`)

    // If we uncomment this it throw a huge error
    //this.emit('error')
    this.socket = null
    this.node.removePeer(this)
  }

  _onTimeOut () {
    debug(`timeout ${this.ip}`)
    this.emit('timeout')
    this.socket = null
    this.node.removePeer(this)
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
          this._handleVerackMessage()
          break
        case 'ping':
          this._sendPongMessage(msg.payload)
          break
        case 'inv':
          const invMessage = inv.decodeInvMessage(msg.payload)
          this._handleInvMessage(invMessage)
          break
        case 'headers':
          const headersMessage = headers.decodeHeadersMessage(msg.payload)
          this._updateHeaders(headersMessage)
          break
        case 'reject':
          const rejectMessage = reject.decodeRejectMessage(msg.payload)
          debug(rejectMessage)
          break
        case 'block':
          const blockMessage = block.decodeBlockMessage(msg.payload)
          this._handleBlock(blockMessage)
          break
        case 'merkleblock':
          const merkleblockMessage = merkleblock.decodeMerkleblockMessage(msg.payload)
          this._handleMerkleblock(merkleblockMessage)
          break
        case 'tx':
          const txMessage = tx.decodeTxMessage(msg.payload)
          this._updateTxs(txMessage)
          break
        case 'notfound':
          debug('What you doing ????')
          break
        default:
          debug("Unknown command :",msg.cmd)
      }
    })
  }

  sendAddr () {
    // Not needed... We don't need node to connect to us ?
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
        debug('Filter loaded')
        resolve()
      })
    })
  }

  sendGetHeader (blockHash = [GENESIS_BLOCK_HASH]) {
    debug('peer n° %i getheaders', this.id)
    debug('Asked for :', blockHash)
    var payload = getheaders.encodeGetheadersMessage(blockHash)
    const getHeadersMessage = packet.preparePacket('getheaders', payload)
    this.socket.write(getHeadersMessage, function (err) {
      if (err) {
        console.error(err)
        return
      }
    })
  }

  sendGetBlocks (blockHash = [GENESIS_BLOCK_HASH]) {
    debug('peer n° %i getblocks', this.id)
    debug('Asked for :', blockHash)
    var payload = getblocks.encodeGetblocksMessage(blockHash)
    const getBlocksMessage = packet.preparePacket('getblocks', payload)
    this.socket.write(getBlocksMessage, function (err) {
      if (err) {
        console.error(err)
        return
      }
    })
  }

  sendGetData (inv) {
    debug('peer n° %i getdata', this.id)
    var getDataMessage = packet.preparePacket('getdata', inv)
    this.socket.write(getDataMessage, function (err) {
      if (err) {
        console.error(err)
        return
      }
    })
  }

  sendFilterAdd (element) {
    // TODO: using 'filteradd' has big privacy issues !
    var payload = filteradd.encodeFilterAdd(Buffer.from(element, 'hex'))
    const filteraddMessage = packet.preparePacket('filteradd', payload)
    return new Promise((resolve, reject) => {
      this.socket.write(filteraddMessage, function (err) {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  }

  sendRawTransaction (rawTransaction) {
    var txMessage = packet.preparePacket('tx', rawTransaction)
    this.socket.write(txMessage, function (err) {
      if (err) {
        console.error(err)
        return
      }
      debug('Raw Tx sent')
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
    debug('Connection closed')
    this.emit('closed')
    this.socket = null
    this.node.removePeer(this)
  }

  _updateTxs (txMessage) {
    //debug('Handle Tx message')
    this.node.updateTxs(txMessage)
  }

  _updateHeaders (headersMessage) {
    debug('peer n° %i received headers message', this.id)
    debug('Ip : ', this.ip)
    /* Verify difficulty */
    headersMessage.headers.map((header) => {
      let buf = Buffer.from(header.nBits, 'hex')
      let exponent = buf.slice(3,4)
      let coefficient = buf.slice(0,3)

      exponent = exponent.readUInt8()
      coefficient = coefficient.readUIntLE(0,3)

      let target = coefficient * 256**(exponent-3)

      let difficulty = Math.floor(Buffer.from('ffff', 'hex').readUInt16BE() * 256**(Buffer.from('1d', 'hex').readUInt8() - 3) / target)
      let proof = readU64(Buffer.from(header.hash, 'hex'),0)

      if (proof > target) {
        console.log('NOOOOOOO')
        process.exit()
      }

    })

    this.node.updateHeaders(headersMessage)
  }

  _handleVersionMessage (versionMessage) {
    this.bestHeight = versionMessage.height
    debug(versionMessage)
    this._sendVerackMessage()
  }

  _handleVerackMessage () {
    this.verack = true
    this.emit('verack')
  }

  _handleInvMessage (invMessage) {

    // It just notified us of a new bock.
    // TODO: We don't need this anymore
    if (invMessage.count === 1) {
      if (invMessage.inventory[0].type == 'MSG_TX') {
        // If it is mempool update message dont do anything for now
        return
      }

      // 2 because we want MSG_BLOCK
      //let payload = inv.encodeInvMessage(invMessage, 2)

      // Not working on regtest!!!
      // We are missing messages
      debug(invMessage)
      // Not good because can be sent in disorder..
      //this.sendGetData(payload)

      // If not synchronize, we don't process yet
      if (!this.node.isSynchonized()) {
        debug("Not time to accept this")
        return
      }

      // We have a problem because they almost happened simultanously
      this.node.isHeaderInDB(invMessage.inventory[0].hash)
        .then((result) => {
          if (!result) {
            // Ask for new headers if we don't have
            // this.node.sendGetHeaders()
            // Merkle block has headers so we can add them !
            return
          } else {
            debug("We have it in db")
          }
        })
        .catch(function(err) {
          throw err
        })
    }

    debug('Peer n° %s received inv message', this.id)
    debug('IP :', this.ip)

    // 3 because we want MSG_FILTERED_BLOCK
    var payload = inv.encodeInvMessage(invMessage, 3)

    this._updateBlocks(invMessage.inventory)
      .then(() => {
        // We have the headers we are ready to receive the merkle blocks
        try {
          this.sendGetData(payload)
        } catch (exception) {
          debug('Wut')
          console.log(exception)
        }
      })
      .catch(() => {
        debug('We got an inventory for which we don\'t have header')
      })

  }

  // TODO: Better name not clear with the `s`
  _updateBlocks (newBlocks) {
    return this.node.updateBlocks(newBlocks)
  }

  _handleMerkleblock (merkleblockMessage) {
    //debug('Handle merkleBlock')
    this.node.updateMerkleBlock(merkleblockMessage)
  }

  _handleBlock (blockMessage) {
    // Decode header
    let buffer = new Buffer.from(blockMessage.blockHeader, 'hex')

    let blockHeader = {}
    let offset = 0

    blockHeader.version = buffer.readInt32LE(offset)
    offset += 4

    blockHeader.previousHash = buffer.slice(offset, offset + 32).toString('hex')
    offset += 32

    if (blockHeader.previousHash === '0000000000000000000000000000000000000000000000000000000000000000') {
      // fs.writeFileSync('test/headers/data3.json', JSON.stringify(data))

      throw Error('PREVIOUS HASH SHOULD NOT BE NULL')
    }

    blockHeader.merklerootHash = buffer.slice(offset, offset + 32).toString('hex')
    offset += 32

    blockHeader.time = buffer.readUInt32LE(offset)
    offset += 4

    blockHeader.nBits = buffer.slice(offset, offset + 4).toString('hex')
    offset += 4

    blockHeader.nonce = buffer.readUInt32LE(offset)
    offset += 4

    // Need the hash
    blockHeader.hash = doubleHash(buffer).toString('hex')

    blockMessage.blockHeader = blockHeader

    this.node.processBlock(blockMessage)

  }
}

module.exports = Peer

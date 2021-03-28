const net = require('net')
const EventEmitter = require('events')
const debug = require('debug')('peer')

const doubleHash = require('./utils/doubleHash')

const packet = require('./commands/packet')
const version = require('./commands/version')
const inv = require('./commands/inv')
const filterload = require('./commands/filterload')
const filteradd = require('./commands/filteradd')
const getheaders = require('./commands/getheaders')
const headers = require('./commands/headers')
const getblocks = require('./commands/getblocks')
const reject = require('./commands/reject')
const block = require('./commands/block')
const merkleblock = require('./commands/merkleblock')
const tx = require('./commands/tx')
const addr = require('./commands/addr')

class Peer extends EventEmitter {
  constructor (ip, port, node, settings) {
    super()

    this.settings = settings

    this.node = node

    this.id = -1
    this.socket = new net.Socket()
    this.ip = ip
    this.port = port
    this.verack = false
    this.closed = false
    this.incompleteData = null
    this.bestHeight = 0
    this.count = 0

    // Have we queried this peer of data and are we waiting for an answer ?
    this.queried = false

    this.socket.on('data', (data) => {
      this._onData(data).catch((err) => debug(err))
    })
    this.socket.on('close', this._onClose.bind(this))
    this.socket.on('error', this._onError.bind(this))
    this.socket.on('timeout', this._onTimeOut.bind(this))
  }

  connect () {
    return new Promise((resolve, reject) => {
      this.socket.connect(this.port, this.ip, (res) => {
        debug(`Connecting to ${this.ip}:${this.port}`)
        const versionObj = version.getVersion(this.ip, this.port)
        const message = version.encodeVersionMessage(versionObj)
        const versionPacket = packet.preparePacket('version', message, this.settings.MAGIC_BYTES)

        this.on('verack', function () {
          debug('Connected !')
          resolve()
        })

        this.on('closed', function () {
          this.closed = true
          reject(new Error('Connection closed.'))
        })

        this.on('error', function () {
          debug('error while connecting')
          this.closed = true
          reject(new Error('Unexpected error when trying to connect to peer.'))
        })

        this.on('timeout', function () {
          this.closed = true
          reject(new Error('Timeout.'))
        })

        this.socket.write(versionPacket)
      })
    })
  }

  _onError (error) {
    // TODO: register as not working node...
    debug(`ERROR ! ${this.ip} ${error}`)

    // If we uncomment this it throw a huge error
    // this.emit('error')
    this.socket = null
    this.node.removePeer(this)
  }

  _onTimeOut () {
    debug(`timeout ${this.ip}`)
    this.emit('timeout')
    this.socket = null
    this.node.removePeer(this)
  }

  async _onData (data) {
    if (this.incompleteData) {
      data = Buffer.concat([this.incompleteData, data], this.incompleteData.length + data.length)
      this.incompleteData = null
    }

    const decodedResponses = []

    // decode packet need to be able to decode several message in one packet
    // https://stackoverflow.com/questions/1010753/missed-socket-message#1010777
    while (data.length > 0) {
      const decodedResponse = packet.decodePacket(data, this.settings.MAGIC_BYTES)
      if (!decodedResponse) {
        this.incompleteData = Buffer.allocUnsafe(data.length)
        data.copy(this.incompleteData)
        break
      }
      data = data.slice(decodedResponse.length + 24)
      decodedResponses.push(decodedResponse)
    }

    for (const msg of decodedResponses) {
      switch (msg.cmd) {
        case 'version':
          this._handleVersionMessage(msg.payload)
          break
        case 'verack':
          this._handleVerackMessage()
          break
        case 'ping':
          this._sendPongMessage(msg.payload)
          break
        case 'inv':
          await this._handleInvMessage(msg.payload)
          break
        case 'headers':
          await this._updateHeaders(msg.payload)
          break
        case 'reject':
          this._handleRejectMessage(msg.payload)
          break
        case 'block':
          this._handleBlock(msg.payload)
          break
        case 'merkleblock':
          this._handleMerkleblock(msg.payload)
          break
        case 'tx':
          this._updateTxs(msg.payload)
          break
        case 'addr':
          this._handleAddrMessage(msg.payload)
          break
        case 'notfound':
          debug('What you doing ????')
          break
        default:
          debug(`Unknown command : ${msg.cmd}`)
      }
    }
  }

  sendAddr () {
    // REVIEW: Do we need this ? We don't let people connect to us. We are not a full node.
    // We can forward addr msg tho... https://developer.bitcoin.org/reference/p2p_networking.html#addr
  }

  sendGetAddr () {
    const getAddrMessage = packet.preparePacket('getaddr', Buffer.alloc(0), this.settings.MAGIC_BYTES)
    this.socket.write(getAddrMessage)
  }

  sendFilterLoad (filter) {
    const payload = filterload.encodeFilterLoad(filter.toObject())
    const filterloadMessage = packet.preparePacket('filterload', payload, this.settings.MAGIC_BYTES)
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

  async sendGetHeader (blockHash) {
    debug(`peer ${this.ip} getheaders\nAsked for : ${blockHash}`)
    const payload = getheaders.encodeGetheadersMessage(blockHash)
    const getHeadersMessage = packet.preparePacket('getheaders', payload, this.settings.MAGIC_BYTES)
    await this.socket.write(getHeadersMessage)
    this.queried = true
  }

  async sendGetBlocks (blockHash, lastHash = '0000000000000000000000000000000000000000000000000000000000000000') {
    debug(`peer ${this.ip} getblocks\nAsked for : ${blockHash}`)
    const payload = getblocks.encodeGetblocksMessage(blockHash, lastHash)
    const getBlocksMessage = packet.preparePacket('getblocks', payload, this.settings.MAGIC_BYTES)
    await this.socket.write(getBlocksMessage)
    this.queried = true
  }

  async sendGetData (inv) {
    debug(`peer ${this.ip} getdata`)
    const getDataMessage = packet.preparePacket('getdata', inv, this.settings.MAGIC_BYTES)
    await this.socket.write(getDataMessage)
    this.queried = true
  }

  sendFilterAdd (element) {
    // TODO: using 'filteradd' has big privacy issues !
    const payload = filteradd.encodeFilterAdd(Buffer.from(element, 'hex'))
    const filteraddMessage = packet.preparePacket('filteradd', payload, this.settings.MAGIC_BYTES)
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

  async sendRawTransaction (rawTransaction) {
    const txMessage = packet.preparePacket('tx', rawTransaction, this.settings.MAGIC_BYTES)
    await this.socket.write(txMessage)
  }

  async _sendVerackMessage () {
    const verackMessage = packet.preparePacket('verack', Buffer.alloc(0), this.settings.MAGIC_BYTES)
    await this.socket.write(verackMessage)
  }

  async _sendPongMessage (nonce) {
    const pongMessage = packet.preparePacket('pong', nonce, this.settings.MAGIC_BYTES)
    await this.socket.write(pongMessage)
  }

  _onClose (response) {
    debug(`Connection closed ${this.ip}`)
    this.emit('closed')
    this.socket = null
    this.node.removePeer(this)
  }

  _updateTxs (txPayload) {
    const txMessage = tx.decodeTxMessage(txPayload)
    this.node.updateTxs(txMessage)
  }

  async _updateHeaders (headersPayload) {
    const headersMessage = headers.decodeHeadersMessage(headersPayload)

    debug(`peer ${this.ip} received headers message`)
    /* Verify difficulty */
    headersMessage.headers.forEach((header) => {
      const buf = Buffer.from(header.nBits, 'hex')
      let exponent = buf.slice(3, 4)
      let coefficient = buf.slice(0, 3)

      exponent = exponent.readUInt8()
      coefficient = coefficient.readUIntLE(0, 3)

      const target = coefficient * 256 ** (exponent - 3)

      // REVIEW: Why difficulty never used ?
      // const difficulty = Math.floor(Buffer.from('ffff', 'hex').readUInt16BE() * 256**(Buffer.from('1d', 'hex').readUInt8() - 3) / target)
      const proof = Buffer.from(header.hash, 'hex').readBigUInt64LE()

      if (proof > target) {
        debug('NOOOOOOO')
        // TODO: Throw a proper error.
        process.exit()
      }
    })

    await this.node.updateHeaders(headersMessage)
  }

  _handleRejectMessage (rejectPayload) {
    const rejectMessage = reject.decodeRejectMessage(rejectPayload)
    debug(rejectMessage)
    this.node.emitReject(rejectMessage)
  }

  _handleVersionMessage (versionPayload) {
    const versionMessage = version.decodeVersionMessage(versionPayload)

    debug(versionMessage)
    // Don't allow node version lower than 1.14
    if (versionMessage.version < 70015) {
      this.socket.destroy()
      return
    }
    this.bestHeight = versionMessage.height
    this._sendVerackMessage()
  }

  _handleVerackMessage () {
    this.verack = true
    this.emit('verack')
  }

  // Need to be sync
  async _handleInvMessage (invPayload) {
    const invMessage = inv.decodeInvMessage(invPayload)

    debug(`peer ${this.ip} received inv message\nInv Count : ${invMessage.count}`)
    this.queried = false

    // It just notified us of a new bock.
    // TODO: We don't need this anymore
    if (invMessage.count === 1) {
      if (invMessage.inventory[0].type === 'MSG_TX') {
        // If it is mempool update message dont do anything for now
        return
      }

      debug(invMessage)

      // We have a problem because they almost happened simultanously
      const result = await this.node.isHeaderInDB(invMessage.inventory[0].hash)

      if (!result) {
        debug('We dont have it so update headers')

        // If merkle not synchronize, we don't process yet
        if (this.node.isMerkleSynchronizing() || !this.node.isSynchronized()) {
          debug('Not time to accept this')
          return
        }

        // Ask for new headers if we don't have
        this.node.sendGetHeaders()
        // Merkle block has headers so we can add them !
        return
      }

      debug('We have it in db')
      // Edge case where we are missing only one merkle block otherwise we wait for
      // other merkleBlock to be verified
      // REVIEW : This would be easier if we saved merkleBlock in db maybe
      if (result.height > this.node.merkleHeight + 1) { return }
      debug('Process')
    }

    this._updateBlocks(invMessage.inventory)
      .then((inventory) => {
        const invMessage = {
          count: inventory.length,
          inventory
        }

        // 3 because we want MSG_FILTERED_BLOCK
        const newPayload = inv.encodeInvMessage(invMessage, 3)

        // We have the headers we are ready to receive the merkle blocks
        try {
          this.sendGetData(newPayload)
        } catch (exception) {
          debug('Wut')
          debug(exception)
        }
      })
      .catch((err) => {
        debug(err)
      })
  }

  // TODO: Better name not clear with the `s`
  _updateBlocks (newBlocks) {
    return this.node.updateBlocks(newBlocks)
  }

  _handleMerkleblock (merkleblockPayload) {
    const merkleblockMessage = merkleblock.decodeMerkleblockMessage(merkleblockPayload)
    this.node.updateMerkleBlock(merkleblockMessage)
  }

  _handleBlock (blockPayload) {
    const blockMessage = block.decodeBlockMessage(blockPayload)
    this.queried = false

    // Decode header
    const buffer = Buffer.from(blockMessage.blockHeader, 'hex')

    const blockHeader = {}
    let offset = 0

    blockHeader.version = buffer.readInt32LE(offset)
    offset += 4

    blockHeader.previousHash = buffer.slice(offset, offset + 32).toString('hex')
    offset += 32

    if (blockHeader.previousHash === '0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error('PREVIOUS HASH SHOULD NOT BE NULL')
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

  _handleAddrMessage (addrPayload) {
    const peersList = addr.decodeAddrMessage(addrPayload)
    // TODO: Save in database!
    this.node.updatePeersInfo(peersList.addresses)
  }
}

module.exports = Peer

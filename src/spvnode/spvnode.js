const Peer = require('./peer')
const SPVNodeDB = require('./db')
const { getDnsSeed } = require('./utils')
const debug = require('debug')('spvnode')
const BloomFilter = require('bloom-filter')
const EventEmitter = require('events')

const bmp = require('bitcoin-merkle-proof')
const doubleHash = require('../utils/doubleHash')
const net = require('net')

// slow nodes
const BAN_LIST = []

// Minimum number of peers we want to have
const MIN_PEER_COUNT = 3

// Enum node state
const NodeStatus = {
  INIT: 'init',
  SYNCING_HEADERS: 'syncing_headers',
  SYNCING_MERKLE_BLOCKS: 'syncing_merkle_block',
  SYNCHRONIZED: 'synchronized',
  SHUTDOWN: 'shutdown'
}

class SPVNode extends EventEmitter {
  constructor (addresses, settings) {
    super()

    this.state = NodeStatus.INIT

    // Peers list
    this.peers = []
    this.peersInfo = []

    // Follow header heigh
    this.height = 0
    this.bestHeight = 0
    // Caching merkle block height for faster update
    // FIXME: should be merkle count and not height. We can receive it in an incorrect order...
    this.merkleHeight = 0
    // Count number of merkle block received before getting next round
    this.merkleBlockCount = 0
    // Keep a value of the hash
    this.merkleBlockNextHash = null
    // Size of the inv message we are verifying
    this.merkleBlockBatchSize = 0
    this.tips = new Map()

    this.settings = settings

    // Initiate only at creation
    this.db = new SPVNodeDB(settings)

    // Do we still need this ? Now looking at tips
    this.hash = settings.GENESIS_BLOCK_HASH

    // need to be genesis block hash
    this.merkleHash = settings.GENESIS_BLOCK_HASH

    // Prepare filter here
    this.filter = BloomFilter.create(addresses.length, 0.001)
    for (const address of addresses) {
      const bufferAddress = Buffer.from(address, 'hex')
      this.filter.insert(bufferAddress)
    }

    // We want the filter to autoupdate
    this.filter.nFlags = 1
  }

  isShuttingDown () {
    return this.state === NodeStatus.SHUTDOWN
  }

  isSynchronized () {
    return this.state === NodeStatus.SYNCHRONIZED
  }

  isMerkleSynchronizing () {
    return this.state === NodeStatus.SYNCING_MERKLE_BLOCKS
  }

  async start () {
    debug('==== Starting spvnode ====')

    let value = await this.db.getHeight()
    this.height = value.height
    this.hash = value.hash

    value = await this.db.getMerkleHeight()
    this.merkleHeight = value.height
    this.merkleHash = value.hash

    this.tips = await this.db.getTips()

    if (this.settings.DNS_SEED.length <= 0) { return }

    // DNS peer
    const promises = []

    for (const host of this.settings.DNS_SEED) {
      const result = await getDnsSeed(host)

      for (const ip of result) {
        debug('Attempt connection with ', ip)
        // TODO: proper ban list
        if (BAN_LIST.indexOf(ip) >= 0) return

        const promise = this.addPeer(ip, this.settings.DEFAULT_PORT)
          .then(function () {
            debug('Peer ' + ip + ' added !')
          })
        promises.push(promise)
      }
    }
    // Once we are connected to one we can start doing stuff
    return Promise.any(promises)
  }

  _getCurrentState () {
    return {
      bestHeight: this.bestHeight,
      height: this.height,
      hash: this.hash,
      peers: this.peers,
      tips: this.tips,
      merkleHeight: this.merkleHeight + this.merkleBlockBatchSize - this.merkleBlockCount
    }
  }

  synchronize () {
    debug('==== Starting synchronizing ====')
    let hashes = [...this.tips.keys()]

    if (this.tips.size === 0) { hashes = [this.hash] }

    this.state = NodeStatus.SYNCING_HEADERS

    this._sendGetHeaders(hashes)
  }

  _sendGetHeaders (hashes) {
    if (this.peers.length <= 0) {
      debug('No peers.')
    }
    // Choose a random peer to getHeaders
    const rand = Math.floor(Math.random() * this.peers.length)
    const peer = this.peers[rand]

    if (!peer) {
      debug('WTF')
    }

    peer.sendGetHeader(hashes)
  }

  _sendGetBlocks (hashes) {
    if (this.peers.length <= 0) {
      debug('No peers.')
    }
    // Choose a random peer to getBlocks
    const rand = Math.floor(Math.random() * this.peers.length)
    const peer = this.peers[rand]

    peer.sendGetBlocks(hashes)
  }

  async addPeer (ip, port) {
    const peer = new Peer(ip, port, this, this.settings.MAGIC_BYTES)

    await peer.connect()
    await peer.sendFilterLoad(this.filter)
    this.peers.push(peer)

    if (peer.bestHeight > this.bestHeight) {
      this.bestHeight = peer.bestHeight

      // Emit new SPV node state
      this.emit('newState', this._getCurrentState())
    }

    // Trying to get more peers here
    peer.sendGetAddr()
  }

  updateFilter (element) {
    const buf = Buffer.from(element, 'hex')
    let inv = ''
    for (let i = 0; i < buf.length; i++) {
      inv = buf.slice(i, i + 1).toString('hex') + inv
    }
    this.peers.forEach(function (peer) {
      peer.sendFilterAdd(element)
    })
  }

  updateHeight (newHeight, hash) {
    this.height = newHeight
    this.hash = hash

    // Update best Height too
    if (this.height > this.bestHeight) { this.bestHeight = this.height }

    this.emit('newState', this._getCurrentState())
  }

  // Process new block
  // What happened if we have 2 new blocks in message ?
  async processBlock (newBlock) {
    // TODO: verify we haven't saved it yet ?

    // Verify header
    const previousHeader = await this.db.getHeader(newBlock.blockHeader.previousHash)

    if (previousHeader === null) {
      throw new Error("We don't have the Previous Hash !")
    }

    newBlock.blockHeader.height = previousHeader.height + 1

    await this.db.putHeader(newBlock.blockHeader)
    // We need to update tip
    const tip = this.tips.get(newBlock.blockHeader.previousHash)

    if (tip) {
      // We found a new tip
      // TODO: doesnt seems right what happened if we have a fork
      this.tips.delete(newBlock.blockHeader.previousHash)
      this.tips.set(newBlock.blockHeader.hash, newBlock.blockHeader)

      this.emit('newState', this._getCurrentState())
    }

    if (newBlock.blockHeader.height > this.height) {
      this.updateHeight(newBlock.blockHeader.height, newBlock.blockHeader.hash)
    }

    // Updating new heigh
    this.merkleHeight = newBlock.blockHeader.height
    this.merkleHash = newBlock.blockHeader.hash

    // Verify if one of the transactions is ours
    // TODO: We should rebuild the merkle root too
    newBlock.txn.forEach((tx) => {
      this.updateTx('tx', tx)
    })
  }

  async updateHeaders (headersMessage) {
    const ops = []
    const headers = headersMessage.headers
    let newBestHeight = this.height
    const pastHeaders = new Map()

    if (!headersMessage.count) {
      // if the message is empty nothing to update here
      debug('Got an empty headers message...')

      if (this.merkleHeight < this.bestHeight) {
        if (this.isMerkleSynchronizing()) { return }

        this.state = NodeStatus.SYNCING_MERKLE_BLOCKS

        this._sendGetBlocks([this.merkleHash])
        return
      }

      debug('Is Fully Synchronized !!!')
      this.emit('synchronized', this._getCurrentState())
      this.state = NodeStatus.SYNCHRONIZED

      return
    }

    // Prepapre batch request
    for (const header of headers) {
      const tip = this.tips.get(header.previousHash)

      if (tip) {
        header.height = tip.height + 1
        if (newBestHeight < header.height) {
          newBestHeight = header.height
        }

        this.tips.delete(header.previousHash)

        this.emit('newState', this._getCurrentState())
      } else {
        // TODO: we need to load the db with the first header
        // We need to verify if it doesnt exist in db
        // or current batch of headers
        header.height = 0

        if (pastHeaders.has(header.previousHash)) {
          // Should never happened because it is sending in order
          header.height = pastHeaders.get(header.previousHash).height + 1
        } else {
          const previousHeader = await this.db.getHeader(header.previousHash)
          if (previousHeader === null) {
            // Just not found
            if (header.previousHash === this.settings.PREVIOUS_HEADER) {
              // This is the block after the genesis block
              header.height = 1
            } else {
              throw Error('We should not have orphan headers here damn it !')
            }
          }

          header.height = previousHeader.height + 1
          if (newBestHeight < header.height) {
            newBestHeight = header.height
          }
        }
      }

      // Keep chains tips
      this.tips.set(header.hash, header)
      this.emit('newState', this._getCurrentState())

      if (this.tips.size > 1) {
        debug('We have a fork !')

        let hash = null
        let header
        for (const [key, value] of this.tips) {
          if (header && header.height > value.height) {
            this.tips.delete(key)
          } else {
            if (hash) { this.tips.delete(hash) }
            hash = key
            header = value
            newBestHeight = value.height
          }
        }

        debug(this.tips)
      }

      // keep a map of headers
      // Not sure we need it
      // It is suppose to be in order
      pastHeaders.set(header.hash, header)

      ops.push({
        key: header.hash,
        value: header,
        type: 'put'
      })
    }

    // Register everything in db
    await this.db.batchHeaders(ops)

    // Should keep a map of height --> hash
    const iterator = this.tips.entries()
    const value = iterator.next().value

    // TODO : Not sure what is used for ^

    if (value[1].height !== newBestHeight) {
      throw Error(`wrong hash for this height ${value[1].height} -> ${newBestHeight}`)
    }

    this.updateHeight(newBestHeight, value[0])

    // Show pourcentage
    debug(`Sync at ${((this.height / this.bestHeight) * 100).toFixed(2)}%\nHeight : ${this.height}`)

    let finishSyncHeader = true

    if (this.bestHeight > this.height) {
      const hashesNotSorted = []
      const hashes = []

      this.tips.forEach(function (value, key, map) {
        if (value.height > 0) {
          hashesNotSorted.push(value)
        }
      })

      hashesNotSorted.sort(function (a, b) {
        return b.height - a.height
      })

      for (const value of hashesNotSorted) {
        hashes.push(value.hash)
      }

      finishSyncHeader = false

      this._sendGetHeaders(hashes)
    }

    // If no more headers we can start asking for the rest
    if (finishSyncHeader) {
      if (this.merkleHeight < this.bestHeight) {
        debug('Asking for merkle blocs')

        if (this.isMerkleSynchronizing()) { debug('But we are still synchronizing merkle block'); return }

        this.state = NodeStatus.SYNCING_MERKLE_BLOCKS

        // Need getBlocks because we cannot ask directly using the headers. We are
        // not sure of what the full node has or if has been pruned ?
        this._sendGetBlocks([this.merkleHash])
      }
    }
  }

  updateTx (newTx) {
    this.emit('tx', newTx)
  }

  // Actually verify inventory
  async updateBlocks (newBlocks) {
    const invBlocks = []
    // Optimize with batchHeaders
    for (const block of newBlocks) {
      const result = await this.db.getHeader(block.hash)
      if (result) {
        invBlocks.push(block)
      }
    }

    // if invBlocks length is 0
    // well return empty [] and don't send the message

    // Only update if we haven't asked this yet
    if (this.merkleBlockNextHash !== invBlocks[invBlocks.length - 1].hash) {
      this.merkleBlockCount = invBlocks.length
      this.merkleBlockBatchSize = invBlocks.length
      this.merkleBlockNextHash = invBlocks[invBlocks.length - 1].hash
    }

    debug(`Merkle Hash updated : ${this.merkleBlockNextHash}`)

    return invBlocks
  }

  async updateMerkleBlock (merkleblockMessage) {
    const hash = doubleHash(Buffer.from(merkleblockMessage.blockHeader.slice(0, 80), 'hex'))

    const header = await this.db.getHeader(hash.toString('hex'))
    if (header === null) {
      return
    }

    debug(`Merkle Blocs synced at : ${((header.height / this.bestHeight) * 100).toFixed(2)}%\nHeight : ${header.height}`)

    const flags = []

    for (let i = 0; i < merkleblockMessage.flagBytes; i++) {
      flags.push(merkleblockMessage.flags.slice(i, i + 1).readUInt8())
    }

    const merkle = {
      flags,
      hashes: merkleblockMessage.hashes,
      numTransactions: merkleblockMessage.transactionCount,
      merkleRoot: Buffer.from(header.merklerootHash, 'hex')
    }

    // TODO: Need to better handle it
    if (!bmp.verify(merkle)) {
      throw new Error('Incorrect merkle tree in block')
    }

    this.merkleBlockCount -= 1

    this.emit('newState', this._getCurrentState())

    if (this.merkleBlockCount === 0) {
      // Find querying node and update state
      for (const peer of this.peers) {
        if (peer.queried) { peer.queried = false; break }
      }

      // This should be done once we have cleared all the merkle blocks
      this._sendGetBlocks([this.merkleBlockNextHash])

      // Update cache only when we verifly all the merkle blocks from the inv call
      this.merkleBlockBatchSize = 0
      this.merkleHeight = header.height
      this.merkleHash = header.hash

      // Maybe get merkleBlockNextHash from headers DB to get the height,
      // because we might receive out of order
      if (this.height === header.height) {
        debug('Is fully synchronized !!!')
        this.emit('synchronized', this._getCurrentState())
        this.state = NodeStatus.SYNCHRONIZED
      }
    }
  }

  sendRawTransaction (rawTransaction) {
    // We send to every peer!
    this.peers.forEach(function (peer) {
      // We should have a promise in return
      peer.sendRawTransaction(rawTransaction)
    })
  }

  removePeer (peer) {
    const indexPeer = this.peers.indexOf(peer)
    if (indexPeer >= 0) {
      debug(`Slice Peer : ${peer.ip} (${indexPeer})`)
      debug(`Querying : ${peer.queried}`)
      this.peers.splice(indexPeer, 1)
      if (peer.queried) { this.synchronize() }
      this.emit('newState', this._getCurrentState())
    }
  }

  updatePeersInfo (peersInfo) {
    const tmp = this.peersInfo.concat(peersInfo)
    this.peersInfo = [...new Set(tmp)]
    if (this.peers.length < MIN_PEER_COUNT) {
      // connect
      for (const peerInfo of this.peersInfo) {
        let connected = false
        for (const peer of this.peers) {
          if (net.isIPv4(peerInfo.host) && peer.ip === peerInfo.host && peer.port === peerInfo.port) {
            connected = true
            break
          }
        }
        if (!connected && net.isIPv4(peerInfo.host)) {
          debug(`Adding a new peer !! ${peerInfo.host}`)
          this.addPeer(peerInfo.host, peerInfo.port)
          break
        }
      }
    }
  }

  async shutdown () {
    this.state = NodeStatus.SHUTDOWN

    // Shutting down so we are saving node state
    await this.db.putMerklesHeight(this.merkleHeight, this.merkleHash)

    // Shuting down so we save height
    await this.db.putHeight(this.height, this.hash)

    // Shutting down so we are saving tips
    await this.db.putTips(this.tips)

    // End connection with all the peers
    // await this._disconnectAllPeers()
  }
}

module.exports = SPVNode

const Peer = require('./peer')
const debug = require('debug')('spvnode')
const level = require('level')
const BloomFilter = require('bloom-filter')
const EventEmitter = require('events')

const bmp = require('bitcoin-merkle-proof')
const dns = require('dns')
const doubleHash = require('./utils/doubleHash')
const path = require('path')
const net = require('net')

// slow nodes
const BAN_LIST = []

// Minimum number of peers we want to have
const MIN_PEER_COUNT = 3

class SPVNode extends EventEmitter {
  constructor (addresses, settings) {
    super()

    this._shutdown = false
    // Is it synchronized
    this._synchronized = false
    // Are we already synchronizing merkle blocks ?
    this._merkleSynchronizing = false
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
    this.headers = level(path.join(settings.DATA_FOLDER, 'spvnode', 'headers'), { valueEncoding: 'json' })
    this.merkles = level(path.join(settings.DATA_FOLDER, 'spvnode', 'merkles'), { valueEncoding: 'json' })
    this.tipsDB = level(path.join(settings.DATA_FOLDER, 'spvnode', 'tips'), { valueEncoding: 'json' })

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

  emitReject (rejectMessage) {
    this.emit('reject', rejectMessage)
  }

  isShuttingDown () {
    return this._shutdown
  }

  isSynchronized () {
    return this._synchronized
  }

  isMerkleSynchronizing () {
    return this._merkleSynchronizing
  }

  _getTipsFromDB () {
    const promise = new Promise((resolve, reject) => {
      this.tipsDB.createReadStream()
        .on('data', (data) => {
          debug(data.value)
          this.tips.set(data.key, data.value)
        })
        .on('error', function (err) { reject(err) })
        .on('end', function () { resolve() })
    })

    return promise
  }

  _getHeightFromDB () {
    // I could get that from header block count
    const promise = new Promise((resolve, reject) => {
      this.headers.get('height', (err, value) => {
        if (err && err.type !== 'NotFoundError') { reject(err) }
        if (err && err.type === 'NotFoundError') {
          resolve()
          return
        }

        this.height = value.height
        this.hash = value.hash

        debug(`Starting height : ${this.height}`)

        resolve()
      })
    })

    return promise
  }

  _getMerkleHeightFromDB () {
    // I could get that from header block count
    const promise = new Promise((resolve, reject) => {
      this.merkles.get('height', (err, value) => {
        if (err && err.type !== 'NotFoundError') { reject(err) }
        if (err && err.type === 'NotFoundError') {
          resolve()
          return
        }

        this.merkleHeight = value.height
        this.merkleHash = value.hash

        resolve()
      })
    })

    return promise
  }

  async start () {
    debug('==== Starting spvnode ====')

    await this._getHeightFromDB()

    await this._getTipsFromDB()

    await this._getMerkleHeightFromDB()

    if (this.settings.DNS_SEED.length <= 0) { return }

    // DNS peer
    const promises = []

    for (const host of this.settings.DNS_SEED) {
      const promise = new Promise((resolve, reject) => {
        this._getDnsSeed(host)
          .then((result) => {
            result.forEach((ip) => {
              debug('Attempt connection with ', ip)
              // draglet slow node. Fuck that.
              // TODO: proper ban list
              if (BAN_LIST.indexOf(ip) >= 0) return

              this.addPeer(ip, this.settings.DEFAULT_PORT)
                .then(function () {
                  debug('Peer ' + ip + ' added !')
                  resolve()
                })
                .catch(function (err) {
                  debug(`Fail to connect to ${ip}`)
                  debug(err)

                  // TODO: Wait for `any` to be supported and replace
                  // resolve(err)
                })
            })
          })
          .catch(function (err) {
            debug(`Fail to get DNS seed from ${host}`)
            debug(err)
            // reject(err)
          })
      })
      promises.push(promise)
    }
    // Once we are connected to one we can start doing stuff
    return Promise.race(promises)
  }

  _getDnsSeed (host) {
    return new Promise(function (resolve, reject) {
      dns.resolve(host, 'A', (err, result) => {
        if (err) {
          reject(err)
          return
        }

        if (result.length === 0) {
          reject(new Error('No DNS results.'))
          return
        }
        resolve(result)
      })
    })
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

    this.sendGetHeaders()
  }

  _sendGetHeaders (hashes) {
    if (this.peers.length <= 0) {
      debug('No peers.')
    }
    // Choose a random peer to getHeaders
    const rand = Math.floor(Math.random() * this.peers.length)
    const peer = this.peers[rand]

    peer.sendGetHeader(hashes)
  }

  sendGetHeaders () {
    let hashes = [...this.tips.keys()]

    if (this.tips.size === 0) { hashes = [this.hash] }

    this._sendGetHeaders(hashes)
  }

  isHeaderInDB (hash) {
    return new Promise((resolve, reject) => {
      this.headers.get(hash, (err, value) => {
        if (err && err.type !== 'NotFoundError') { reject(err) }

        if (err && err.type === 'NotFoundError') {
          resolve()
        } else {
          resolve(value)
        }
      })
    })
  }

  _sendGetBlocks (hashes) {
    if (this.peers.length <= 0) {
      debug('No peers.')
    }
    // Choose a random peer to getHeaders
    const rand = Math.floor(Math.random() * this.peers.length)
    const peer = this.peers[rand]

    peer.sendGetBlocks(hashes)
  }

  addPeer (ip, port) {
    const peer = new Peer(ip, port, this, this.settings)

    return new Promise((resolve, reject) => {
      peer.connect()
        .then(() => {
          peer.sendFilterLoad(this.filter).then(() => {
            this.peers.push(peer)

            if (peer.bestHeight > this.bestHeight) {
              this.bestHeight = peer.bestHeight

              // Emit new SPV node state
              this.emit('newState', this._getCurrentState())
            }

            // Trying to get more peers here
            peer.sendGetAddr()

            resolve()
          })
            .catch((err) => {
              debug(err)
              debug('Peer.connect failed')
              reject(err)
            })
        })
        .catch((error) => {
          // debug(error)
          reject(error)
        })
    })
  }

  // This should be move to wallet
  updateTxs (newTx) {
    this.emit('tx', newTx)
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
  // REVIEW: Do we actually used this ?
  processBlock (newBlock) {
    // TODO: verify we haven't saved it yet ?

    // Verify header
    this.headers.get(newBlock.blockHeader.previousHash, (err, value) => {
      if (err) {
        throw new Error("We don't have the Previous Hash !")
        // Throw error if we are processing block at the same time we are synchronizing
        // return
      }

      newBlock.blockHeader.height = value.height + 1

      // VERIFY HEADER DIFFICULTY BEFORE?

      this.headers.put(newBlock.blockHeader.hash, newBlock.blockHeader, (err) => {
        // If we couldnt registered we dont update
        if (err) {
          throw new Error('Couldnt update database with new block header!')
        }

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

        // Update merkle
        // Ok we are actually saving full block!
        // TODO: make it a function
        /*
        this.merkles.put(newBlock.blockHeader.hash, newBlock, (err) => {
          if (err) throw err
        })
        */

        // Updating new heigh
        this.merkleHeight = newBlock.blockHeader.height
        this.merkleHash = newBlock.blockHeader.hash

        // Verify if one of the transactions is ours
        // TODO: We should rebuild the merkle root too
        newBlock.txn.forEach((tx, index) => {
          this.updateTxs(tx)
        })
      })
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
        this._synchronized = true
        if (this.isMerkleSynchronizing()) { return }

        this._merkleSynchronizing = true

        // Need getBlocks because we cannot ask directly using the headers. We are
        // not sure of what the full node has or if has been pruned ?
        this._sendGetBlocks([this.merkleHash])
        return
      }

      debug('Is Fully Synchronized !!!')
      this.emit('synchronized', this._getCurrentState())
      this._synchronized = true

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
          const promise = () => {
            return new Promise((resolve, reject) => {
              this.headers.get(header.previousHash, function (err, value) {
                if (err) {
                  reject(err)
                  return
                }
                resolve(value)
              })
            })
          }

          await promise()
            .then((value) => {
              header.height = value.height + 1
              if (newBestHeight < header.height) {
                newBestHeight = header.height
              }
            })
            .catch((err) => {
              // Just not found
              if (header.previousHash === this.settings.PREVIOUS_HEADER) {
                // This is the block after the genesis block
                header.height = 1
                return
              }
              throw err
            })
        }
      }

      if (header.height === 0) {
        throw Error('We should not have orphan headers here damn it !')
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
    await this.headers.batch(ops)

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
        this._synchronized = true
        debug('Asking for merkle blocs')

        if (this.isMerkleSynchronizing()) { debug('But we are still synchronizing merkle block'); return }

        this._merkleSynchronizing = true

        // Need getBlocks because we cannot ask directly using the headers. We are
        // not sure of what the full node has or if has been pruned ?
        this._sendGetBlocks([this.merkleHash])
      }
    }
  }

  // Actually verify inventory
  async updateBlocks (newBlocks) {
    const invBlocks = []
    let result
    // Optimize with Promise.all()
    for (const block of newBlocks) {
      try {
        result = await this.headers.get(block.hash)
      } catch (err) {
        if (err.notFound) {
          result = null
        } else {
          throw err
        }
      }
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

  updateMerkleBlock (merkleblockMessage) {
    let hash = doubleHash(Buffer.from(merkleblockMessage.blockHeader, 'hex'))

    if (merkleblockMessage.blockHeader.length > 80) {
      hash = doubleHash(Buffer.from(merkleblockMessage.blockHeader.slice(0, 80), 'hex'))
    }

    this.headers.get(hash.toString('hex'), (err, value) => {
      if (err && err.type === 'NotFoundError') {
        return
      }

      // Still throw if we have an error
      if (err) {
        throw err
      }

      debug(`Merkle Blocs synced at : ${((value.height / this.bestHeight) * 100).toFixed(2)}%\nHeight : ${value.height}`)

      const flags = []

      for (let i = 0; i < merkleblockMessage.flagBytes; i++) {
        flags.push(merkleblockMessage.flags.slice(i, i + 1).readUInt8())
      }

      const merkle = {
        flags,
        hashes: merkleblockMessage.hashes,
        numTransactions: merkleblockMessage.transactionCount,
        merkleRoot: Buffer.from(value.merklerootHash, 'hex')
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
        this.merkleHeight = value.height
        this.merkleHash = value.hash

        // Maybe get merkleBlockNextHash from headers DB to get the height,
        // because we might receive out of order
        if (this.height === value.height) {
          debug('Is Fully Synchronized !!!')
          this.emit('synchronized', this._getCurrentState())
          this._merkleSynchronizing = false
        }
      }
    })
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

  _disconnectAllPeers () {
    const promises = []

    for (const peer of this.peers) {
      const promise = new Promise(function (resolve, reject) {
        debug(`Disconnecting peer ${peer.ip}`)
        peer.socket.end()
      })

      promises.push(promise)
    }

    return Promise.all(promises)
  }

  _saveMerklesHeightInDb (height, hash) {
    const promise = new Promise((resolve, reject) => {
      this.merkles.put('height', { height, hash }, (err) => {
        if (err) throw err

        debug('Merkle Height saved !')
        resolve()
      })
    })

    return promise
  }

  _saveHeightInDb (height, hash) {
    const promise = new Promise((resolve, reject) => {
      this.headers.put('height', { height, hash }, (err) => {
        if (err) throw err

        debug('Header Height saved !')
        resolve()
      })
    })

    return promise
  }

  _saveTipsInDb (tips) {
    const promise = new Promise((resolve, reject) => {
      const ops = []
      tips.forEach((value, key) => {
        ops.push({
          type: 'put',
          key,
          value
        })
      })

      this.tipsDB.clear(() => {
        this.tipsDB.batch(ops, (err) => {
          if (err) throw err

          debug('Tips saved !')
          resolve()
        })
      })
    })

    return promise
  }

  async shutdown () {
    this._shutdown = true

    // Shutting down so we are saving node state
    await this._saveMerklesHeightInDb(this.merkleHeight, this.merkleHash)

    // Shuting down so we save height
    await this._saveHeightInDb(this.height, this.hash)

    // Shutting down so we are saving tips
    await this._saveTipsInDb(this.tips)

    // End connection with all the peers
    // await this._disconnectAllPeers()
  }
}

module.exports = SPVNode

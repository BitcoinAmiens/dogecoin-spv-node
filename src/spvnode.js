var Peer = require('./peer')
var debug = require('./debug')('spvnode')
var level = require('level')
var BloomFilter = require('bloom-filter')
var EventEmitter = require('events')

const bmp = require('bitcoin-merkle-proof')
const dns = require('dns')
const constants = require('./constants')
const pubkeyToAddress = require('./utils/pubkeyToAddress')
const doubleHash = require('./utils/doubleHash')
const fs = require('fs')


// slow nodes
const BAN_LIST = ['198.58.102.18']

// TODO: move this to main
var { ADDRESSES } = require('../walletAddresses')

class SPVNode extends EventEmitter {

  _shutdown = false
  peers = []
  // Follow header heigh
  height = 0
  hash = null
  bestHeight = 0
  // Caching merkle block height for faster update
  // FIXME: should be merkle count and not height. We can receive it in an incorrect order...
  merkleHeight = 0
  // need to be genesis block hash
  merkleHash = constants.GENESIS_BLOCK_HASH


  constructor (addresses) {
    super()

    this.headers = level(__dirname + '/../data/spvnode/headers', {valueEncoding: 'json'})
    this.merkles = level(__dirname + '/../data/spvnode/merkles', {valueEncoding: 'json'})

    this.tips = new Map()

    // Prepare filter here
    this.filter = BloomFilter.create(addresses.length, 0.001)
    for (var address of addresses) {
      var bufferAddress = Buffer.from(address, 'hex')
      this.filter.insert(bufferAddress)
    }

    // We want the filter to autoupdate
    this.filter.nFlags = 1

    if (process.env.NETWORK === 'testnet') {
      debug('We are on TESTNET !')
    }
  }

  isShuttingDown () {
    return this._shutdown
  }

  _getHeightFromDB () {
    let promise = new Promise((resolve, reject) => {
      this.headers.get('height', (err, value) => {
        if (err && err.type !== 'NotFoundError') { reject() }
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

  async start () {
    debug('==== Starting spvnode ====')

    await this._getHeightFromDB()

    // DNS peer
    if (process.env.NETWORK !== 'regtest') {
      debug('Resolving DNS seed')
      var promises = []
      constants.DNS_SEED.forEach((host) => {
        let promise = new Promise((resolve, reject) => {
          this._getDnsSeed(host)
          .then((result) => {
            result.forEach((ip) => {
              debug('Attempt connection with ', ip)
              // draglet slow node. Fuck that.
              // TODO: proper ban list
              if (BAN_LIST.indexOf(ip) >= 0) return

              this.addPeer(ip, constants.DEFAULT_PORT)
                .then(function () {
                  debug('Peer ' + ip + ' added !' )
                  resolve()
                })
                .catch(function (err) {
                  debug(err)

                  // Dont reject anymore instead save as broken
                  //reject(err)

                  resolve()
                })
            })
          })
          .catch(function (err) {
            debug(err)
            reject()
          })
        })
        promises.push(promise)
      })
      // Once we are connected to one we can start doing stuff
      return Promise.race(promises)
    }
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

  _getCurrentState ()  {
    return {
      bestHeight: this.bestHeight,
      height: this.height,
      hash: this.hash,
      peers: this.peers,
      tips: this.tips,
      merkleHeight: this.merkleHeight
    }
  }

  synchronize () {
    debug('==== Starting synchronizing ====')
    if (this.peers.length <= 0) {
      console.error(new Error('No peers.'))
    }
    // Choose a random peer to getHeaders
    let rand = Math.floor(Math.random() * this.peers.length)
    let peer = this.peers[rand]

    if (this.hash) {
      peer.sendGetHeader([this.hash])
    } else {
      peer.sendGetHeader()
    }
  }

  // TODO: Unuse for now
  sendGetHeaders () {
    if (this.peers.length <= 0) {
      console.error(new Error('No peers.'))
    }
    // Choose a random peer to getHeaders
    let rand = Math.floor(Math.random() * this.peers.length)
    let peer = this.peers[rand]
  }

  addPeer (ip, port) {
    var peer = new Peer(ip, port, this)

    return new Promise((resolve, reject) => {
      peer.connect()
        .then(() => {
          peer.sendFilterLoad(this.filter).then(() => {

            peer.id = this.peers.length
            this.peers.push(peer)

            if (peer.bestHeight > this.bestHeight) {
              this.bestHeight = peer.bestHeight

              // Emit new SPV node state
              this.emit('newState', this._getCurrentState())
            }

            resolve()
          })
          .catch((err) => {
            console.log(err)
            reject(err)
          })
        })
        .catch((error) => {
          debug(error)
          reject(error)
        })
    })
  }

  // This should be move to wallet
  updateTxs (newTx) {
    //debug('New Tx :', newTx.id)

    this.emit('tx', newTx)
  }

  updateFilter (element) {
    let buf = Buffer.from(element, 'hex')
    let inv = ''
    for (let i=0; i < buf.length; i++) {
      inv = buf.slice(i, i+1).toString('hex') + inv
    }
    //debug('Filter updated with :', inv)

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
  processBlock (newBlock) {
    // TODO: verify we haven't saved it yet ?

    // Verify header
    this.headers.get(newBlock.blockHeader.previousHash, (err, value) => {

      if (err) {
        //throw new Error("We don't have the Previous Hash !")
        // Throw error if we are processing block at the same time we are synchronizing
        return
      }

      newBlock.blockHeader.height = value.height + 1

      // VERIFY HEADER DIFFIVULTY BEFORE?

      this.headers.put(newBlock.blockHeader.hash, newBlock.blockHeader, (err) => {
        // If we couldnt registered we dont update
        if (err) {
          throw new Error("Couldnt update database with new block header!")
        }

        // We need to update tip
        let tip = this.tips.get(newBlock.blockHeader.previousHash)

        if (tip) {
          // We found a new tip
          // TODO: doesnt seems right what happened if we have a fork
          this.tips.delete(newBlock.blockHeader.previousHash)
          this.tips.set(newBlock.blockHeader.hash, newBlock.blockHeader)

          this.emit('newState', this._getCurrentState())
        }

        if (newBlock.blockHeader.height > this.height ) {
          this.updateHeight(newBlock.blockHeader.height, newBlock.blockHeader.hash)
        }

        // Update merkle
        // Ok we are actually saving full block!
        // TODO: make it a function
        this.merkles.put(newBlock.blockHeader.hash, newBlock, (err) => {
          if (err) throw err


          // Updating new heigh
          this.merkleHeight = newBlock.blockHeader.height
          this.merkleHash = newBlock.blockHeader.hash
        })

        // Verify if one of the transactions is ours
        // TODO: We should rebuild the merkle root too
        newBlock.txn.forEach((tx, index) => {
          this.updateTxs(tx)
        })

      })
    })

  }

  async updateHeaders (headersMessage) {
    let ops = []
    let headers = headersMessage.headers
    let newBestHeight = this.height
    let pastHeaders = new Map()

    if (!headersMessage.count) {
      // if the message is empty nothing to update here

      // We still need to get the blocks
      // Choose a random peer to getBlocks
      let rand = Math.floor(Math.random() * this.peers.length)
      let peer = this.peers[rand]

      this.merkles.get('height', (err, value) => {
        if (err) throw err

        debug('Got an empty headers message...')

        /* NOT GOOD! you cant start from the height of headers... We need precedent blocks.*/
        if (value.height < this.bestHeight) {
          // Need getBlocks because we cannot ask directly using the headers. We are
          // not sure of what the full node has or if has been pruned ?
          peer.sendGetBlocks([value.hash])
          return
        }

        this.emit('synchronized')
      })

      return
    }

    // Prepapre batch request
    //headers.forEach( (element, index, array) => {
    for (let header of headers) {
      let tip = this.tips.get(header.previousHash)

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

          let promise = () => {
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
              if (header.previousHash === constants.PREVIOUS_HEADER) {
                // This is the block after the genesis block
                header.height = 1
                return
              }
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

    this.headers.batch(ops, (err) => {
      if (err) throw err

      // Should keep a map of height --> hash
      var iterator = this.tips.entries()
      var value = iterator.next().value

      // TODO : Not sure what is used for ^

      if (value[1].height !== newBestHeight) {
        throw Error('wrong hash for this height')
      }

      this.updateHeight(newBestHeight, value[0])

      // Show pourcentage
      debug('Sync at ' + ((this.height/this.bestHeight)*100).toFixed(2)+ '%')
      debug('Height :', this.height)

      var finishSyncHeader = true

      let rand = Math.floor(Math.random() * this.peers.length)
      let peer = this.peers[rand]

      if (this.bestHeight > this.height) {

        let hashesNotSorted = []
        let hashes = []

        this.tips.forEach(function (value, key, map) {
          if (value.height > 0) {
            hashesNotSorted.push(value)
          }
        })

        hashesNotSorted.sort(function (a, b) {
          return b.height - a.height
        })

        hashesNotSorted.forEach(function (value) {
          hashes.push(value.hash)
        })

        finishSyncHeader = false

        peer.sendGetHeader(hashes)
      }

      // If no more headers we can start asking for the rest
      if (finishSyncHeader) {
        this.merkles.get('height', (err, value) => {
          if (err && err.type !== 'NotFoundError') throw err

          if (err && err.type === 'NotFoundError') {
            value = {
              height: 0,
              hash: constants.GENESIS_BLOCK_HASH
            }
          }

          this.merkleHeight = value.height
          this.merkleHash = value.hash

          if (value.height < this.bestHeight) {

            // TODO: create a sendGetBlocks function
            let rand = Math.floor(Math.random() * this.peers.length)
            let peer = this.peers[rand]

            // Need getBlocks because we cannot ask directly using the headers. We are
            // not sure of what the full node has or if has been pruned ?
            peer.sendGetBlocks([value.hash])

            return
          }

        })
      }

    })
  }

  // Actually get more blocks process
  updateBlocks (newBlocks) {

    this.headers.get(newBlocks[newBlocks.length - 1].hash, (err, value) => {
      if (err) {
        // Receiving INV cmd from new block which I don't have the headers saved yet---
        // throw err
        console.log(newBlocks)
        return
      }

      if (value.height < this.bestHeight) {
        // Choose a random peer to getBlocks
        let rand = Math.floor(Math.random() * this.peers.length)
        let peer = this.peers[rand]

        // This should be done once we have cleared alll the merkle blocks
        peer.sendGetBlocks([newBlocks[newBlocks.length - 1].hash])
        return
      }

    })

  }

  updateMerkleBlock (merkleblockMessage) {
    var hash = doubleHash(Buffer.from(merkleblockMessage.blockHeader, 'hex'))

    if (merkleblockMessage.blockHeader.length > 80) {
      hash = doubleHash(Buffer.from(merkleblockMessage.blockHeader.slice(0, 80), 'hex'))
    }

    this.headers.get(hash.toString('hex'), (err, value) => {
      if (err) {
        // Send you not yet registered merkle block... but we don't have the header yet
        // console.log(hash)
        // console.log('Unknown header...')
        return
      }

      debug('Merkle Blocs synced at : ' + ((value.height/this.bestHeight)*100).toFixed(2)+ '%')
      debug('Heigh : ', value.height)

      let flags = []

      for (var i=0; i<merkleblockMessage.flagBytes; i++) {
        flags.push(merkleblockMessage.flags.slice(i, i+1).readUInt8())
      }

      var merkle = {
        flags,
        hashes: merkleblockMessage.hashes,
        numTransactions: merkleblockMessage.transactionCount,
        merkleRoot: Buffer.from(value.merklerootHash, 'hex')
      }

      var result = bmp.verify(merkle)

      // if doesn't throw it means that the merkle root is valid so we save this
      // Do we really need to save the full merkle block or just a valid?
      this.merkles.put(hash.toString('hex'), merkleblockMessage, (err) => {
        if (err) throw err

        // Update cache too
        this.merkleHeight = value.height
        this.merkleHash = value.hash

        this.emit('newState', this._getCurrentState())

        if (this.height === value.height) {
          this.emit('synchronized')
        }

        if (result.length > 0) {
          // TODO: update bloom filter ? Not sure...
          // this.txids.concat(result)
        }

      })
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
    if (this.peers.indexOf(peer) >= 0) {
      debug('Slice Peer :', this.peers.indexOf(peer))
      this.peers.slice(this.peers.indexOf(peer))
    }
  }

  _disconnectAllPeers () {
    let promises = []

    this.peers.map(function (peer) {
      let promise = new Promise( function (resolve, reject) {
        debug(`Disconnecting peer ${peer.ip}`)
        peer.socket.end()
      })

      promises.push()
    })

    return Promise.all(promises)
  }

  _saveMerklesHeightInDb (height, hash) {
    let promise = new Promise ((resolve, reject) => {
      this.merkles.put('height', {height, hash}, (err) => {
        if (err) throw err

        debug('Merkle Height saved !')
        resolve()
      })
    })

    return promise
  }

  _saveHeightInDb (height, hash) {
    let promise = new Promise ((resolve, reject) => {
      this.headers.put('height', { height, hash}, (err) => {
        if (err) throw err

        debug('Header Height saved !')
        resolve()
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

    // End connection with all the peers
    // await this._disconnectAllPeers()
  }

}

module.exports = SPVNode

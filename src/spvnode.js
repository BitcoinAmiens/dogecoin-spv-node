var Peer = require('./peer')
var debug = require('debug')('spvnode')
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
const BAN_LIST = []

// TODO: move this to main
var { ADDRESSES } = require('../walletAddresses')

class SPVNode extends EventEmitter {
  constructor (addresses = ADDRESSES) {
    super()

    //var db = sublevel(level(__dirname + '/../db', {valueEncoding: 'json'}))

    this.peers = []
    this.balance = 0
    this.totalSpent = 0
    this.height = 0
    this.hash = null
    this.bestHeight = 0
    this.txs = level(__dirname + '/../data/txs', {valueEncoding: 'json'})
    this.unspentTxs = level(__dirname + '/../data/unspent', {valueEncoding: 'json'})
    this.txids = new Map()
    this.txInsCounter = 0
    this.filter
    /*this.headers = db.sublevel('headers')
    this.merkles = db.sublevel('merkles')
    this.wallet = db.sublevel('wallet')*/
    this.headers = level(__dirname + '/../data/headers', {valueEncoding: 'json'})
    this.merkles = level(__dirname + '/../data/merkles', {valueEncoding: 'json'})
    this.wallet = level(__dirname + '/../data/wallet', {valueEncoding: 'json'})
    this.tips = new Map()
    this.addresses = addresses

    this.totalTxs = 0

    //console.log(this.addresses)

    // Prepare filter here
    this.filter = BloomFilter.create(this.addresses.length, 0.001)
    for (var address of this.addresses) {
      var bufferAddress = Buffer.from(address, 'hex')
      this.filter.insert(bufferAddress)
    }

    // We want the filter to autoupdate
    this.filter.nFlags = 1

    if (process.env.NETWORK === 'testnet') {
      debug('We are on TESTNET !')
    }
  }

  async start () {

    await this.headers.get('height', (err, value) => {
      if (err && err.type !== 'NotFoundError') throw err
      if (err && err.type === 'NotFoundError') return

      this.height = value.height
      this.hash = value.hash

      console.log('Hash :', this.hash)
      console.log('Height :', this.height)
    })

    await this.wallet.get('balance', (err, value) => {
      if (err && err.type !== 'NotFoundError') throw err
      if (err && err.type === 'NotFoundError') return

      this.balance = value
    })

    // DNS peer
    console.log('==== Starting spvnode ====')
    if (process.env.NETWORK !== 'regtest') {
      debug('Resolving DNS seed')
      var promises = []
      constants.DNS_SEED.forEach((host) => {
        let promise = new Promise((resolve, reject) => {
          this._getDnsSeed(host)
          .then((result) => {
            result.forEach((ip) => {
              debug(' Attempt connection with ', ip)
              // draglet slow node. Fuck that.
              // TODO: proper ban list
              if (BAN_LIST.indexOf(ip) >= 0) return

              this.addPeer(ip, constants.DEFAULT_PORT)
                .then(function () {
                  console.log('Peer ' + ip + ' added !' )
                  resolve()
                })
                .catch(function (err) {
                  console.log(err)
                  reject()
                })
            })
          })
          .catch(function (err) {
            console.log(err)
            reject(err)
          })
        })
        promises.push(promise)
      })
      // Once we are connected to one we can start doing stuff
      return Promise.race(promises)
    }
    return new Promise((resolve, reject) => {
      this.headers.get('height', (err, value) => {
        if (err) throw err

        this.height = value
        resolve()
      })
    })
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

  synchronize () {
    console.log('==== Starting synchronizing ====')
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
            }

            resolve()
          })
          .catch((err) => {
            console.log(err)
            reject(err)
          })
        })
        .catch((error) => {
          console.log(error)
          reject(error)
        })
    })
  }

  updateBalance (newBalance) {
    this.balance += newBalance
    this.totalTxs++
    this.wallet.put('balance', this.balance, (err) => {
      this.emit('balanceUpdated', this.balance)
    })
  }

  updateTxs (newTx) {
    let buf = Buffer.from(newTx.id, 'hex')
    let inv = ''
    for (let i=0; i < buf.length; i++) {
      inv = buf.slice(i, i+1).toString('hex') + inv
    }

    debug('New Tx :', newTx.id)

    newTx.txIns.forEach((txIn) => {
      let previousOutput = txIn.previousOutput.hash + txIn.previousOutput.index
      // If coinbase txIn we don't care
      if (txIn.previousOutput.hash === '0000000000000000000000000000000000000000000000000000000000000000') {
        return
      }
      let buf = Buffer.from(txIn.previousOutput.hash, 'hex')
      let inv = ''
      for (let i=0; i < buf.length; i++) {
        inv = buf.slice(i, i+1).toString('hex') + inv
      }

      let txOut = this.txids.get(previousOutput)

      if (txOut) {
        console.log('We have found : ', inv)
        this.txInsCounter++
        //this.updateBalance(-txOut.value)
        this.totalSpent  += txOut.value
      }
    })


      // TODO: need to verify if address belongs to wallet
      // And we actually need txOuts records not txs stupid (:heart:)
    newTx.txOuts.forEach((txOut, index) => {

      // We should have a switch here
      let firstByte = txOut.pkScript.slice(0, 1).toString('hex')
      let address

      switch (firstByte) {
        case '21':
          let pubkey = txOut.pkScript.slice(1, 34)
          //address = pubkeyToAddress(pubkey)
          address = pubkey.toString('hex')
          break

        case '76':
          let pubkeyHash = txOut.pkScript.slice(3, 23)
          //address = pubkeyToAddress(pubkeyHash, true)
          address = pubkeyHash.toString('hex')
          break

        // P2SH !!!newTx.txOuts
        case 'a9':
          let redeemScriptHash = txOut.pkScript.slice(2, 22)
          //address = pubkeyToAddress(redeemScriptHash, true, true)
          address = redeemScriptHash.toString('hex')
          break

        default:
          //console.log('unknown script')
      }

      if (this.addresses.indexOf(address)<0) {
        // Not in our wallet (false positive)
        return
      }

      let indexBuffer = Buffer.allocUnsafe(4)
      indexBuffer.writeInt32LE(index, 0)

      // console.log(indexBuffer)
      let previousOutput = newTx.id + indexBuffer.toString('hex')

      // Need to update filter for everyone
      // Actually not because we used the flag UPDATE in the bloom filter message
      // this.updateFilter(newTx.id)

      this.txids.set(previousOutput, txOut)

      this.updateBalance(txOut.value)

      // Save full tx in 'txs'
      this.txs.put(newTx.id, newTx, (err) => {
        if (err) throw err

        // save only the unspent output in 'unspent'
        this.unspentTxs.put(newTx.id, {txid: newTx.id, vout: newTx.txOuts.indexOf(txOut), value: txOut.value}, (err) => {
          if (err) throw err
        })
      })
    })
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

    this.updateHeightInDb(this.height, this.hash)
  }

  updateHeightInDb (newHeight, hash) {
    this.headers.put('height', { height: newHeight, hash}, (err) => {
      if (err) throw err
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
        console.log(value)

        /* NOT GOOD! you cant start from the height of headers... We need prececent blocks.*/
        if (value.height < this.bestHeight) {
          // Need getBlocks because we cannot ask directly using the hedaers. We are
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

      if (this.tips.size > 1) {
        console.log('We have a fork !')
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

      if (value[1].height !== newBestHeight) {
        throw Error('wrong hash for this height')
      }

      this.updateHeight(newBestHeight, value[0])

      // Show pourcentage
      debug('Sync at ' + ((this.height/this.bestHeight)*100).toFixed(2)+ '%')
      debug('Height :', this.height)

      var finishSyncHeader = true

      // TODO: randomize the selection of peers
      for (var peer of this.peers) {
        if (peer.bestHeight > this.height) {

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
          break
        }
      }

      // If no more headers we can start asking for the rest
      if (finishSyncHeader) {
        let rand = Math.floor(Math.random() * this.peers.length)
        let peer = this.peers[rand]

        this.merkles.get('height', (err, value) => {
          if (err && err.type !== 'NotFoundError') throw err

          if (err && err.type === 'NotFoundError') {
            value = {
              height: 0,
              hash: constants.GENESIS_BLOCK_HASH
            }
          }

          debug('Headers message had headers that needed to be processed!')
          /* We are cheating here */
          /*value = {
            height : 1991297,
            hash : 'be6e5b404aa35c5d677b249e4e477e6b31cf7312a199553666dfafef526ede6f'
          }*/

          if (value.height < this.bestHeight) {
            // Need getBlocks because we cannot ask directly using the hedaers. We are
            // not sure of what the full node has or if has been pruned ?
            peer.sendGetBlocks([value.hash])
            return
          }

          this.emit('synchronized')

        })
      }

    })
  }

  updateBlocks (newBlocks) {
    // Choose a random peer to getBlocks
    let rand = Math.floor(Math.random() * this.peers.length)
    let peer = this.peers[rand]

    this.headers.get(newBlocks[newBlocks.length - 1].hash, (err, value) => {
      if (err) {
        // Receiving INV cmd from new block which I don't have the headers saved yet---
        // throw err
        return
      }

      debug('Blocs synced at : ' + ((value.height/this.bestHeight)*100).toFixed(2)+ '%')
      debug('Heigh : ', value.height)

      if (value.height < this.bestHeight) {
        peer.sendGetBlocks([newBlocks[newBlocks.length - 1].hash])
        return
      }

      // It means we are done and we are just waiting for the last header
      this.emit('synchronized')
    })

  }

  updateMerkleBlock (merkleblockMessage) {
    var hash = doubleHash(Buffer.from(merkleblockMessage.blockHeader, 'hex'))

    //debug('Merkle Block :', hash.toString('hex'))

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

      //debug('Merkle Blocs synced at : ' + ((value.height/this.bestHeight)*100).toFixed(2)+ '%')
      //debug('Heigh : ', value.height)

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
      this.merkles.put(hash.toString('hex'), merkleblockMessage, (err) => {
        if (err) throw err

        this.merkles.put('height', {height: value.height, hash: value.hash}, function (err) {
          if (err) throw err
        })

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
      console.log('Slice Peer :', this.peers.indexOf(peer))
    }
  }

}

module.exports = SPVNode

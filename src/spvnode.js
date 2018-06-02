var Peer = require('./peer')
var level = require('level')
var sublevel = require('level-sublevel')
var BloomFilter = require('bloom-filter')
const bmp = require('bitcoin-merkle-proof')
const dns = require('dns')
const constants = require('./constants')
const pubkeyToAddress = require('./utils/pubkeyToAddress')
const doubleHash = require('./utils/doubleHash')
var { ADDRESSES } = require('../walletAddresses')

class SPVNode {
  constructor () {
    var db = sublevel(level(__dirname + '/../db', {valueEncoding: 'json'}))

    this.peers = []
    this.balance = 0
    this.height = 0
    this.hash = null
    this.bestHeight = 0
    // this.txs = db.sublevel('txs')
    this.txs = []
    this.filter = []
    this.merkle
    //this.merkles = db.sublevel('merkles')
    this.headers = db.sublevel('headers')
    this.heighs = db.sublevel('heights')
    this.wallet = db.sublevel('wallet')
    this.blocks = db.sublevel('blocks')
    this.tips = new Map()


    if (process.env.NETWORK === 'testnet') {
      console.log('We are on TESTNET !')
    }
  }

  async start () {

    await this.headers.get('height', (err, value) => {
      if (err) return
      console.log('Current height :', value)

      this.height = value.height
      this.hash = value.hash
    })

    // DNS peer
    console.log('==== Starting spvnode ====')
    if (process.env.NETWORK === 'testnet') {
      console.log('Resolving DNS seed')
      var promises = []
      constants.DNS_SEED.forEach((host) => {
        let promise = new Promise((resolve, reject) => {
          this._getDnsSeed(host)
          .then((result) => {
            result.forEach((ip) => {
              console.log(' Attempt connection with ', ip)
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

          // Prepare filter here
          var filter = BloomFilter.create(ADDRESSES.length, 0.001)
          for (var index in ADDRESSES) {
            var bufferAddress = Buffer.from(ADDRESSES[index], 'hex')
            filter.insert(bufferAddress)
          }

          // We want the filter to autoupdate
          filter.nFlags = 1

          this.peers.push(peer)

          if (peer.bestHeight > this.bestHeight) {
            this.bestHeight = peer.bestHeight
          }

          //
          peer.sendFilterLoad(filter).then(() => {
            //peer.sendGetHeader()
            //peer.sendGetBlocks()
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
    this.wallet.put('balance', this.balance, (err) => {
      console.log('Update balance :', this.balance / constants.SATOSHIS)
    })
  }

  updateTxs (newTx) {
    // Verify if we already have this tx
    // If not added it txs array
    // else do nothing
    if (this.txs.indexOf(newTx) >= 0) {

      return
    }

    // TODO: need to verify if address belongs to wallet
    // And we actually need txOuts records not txs stupid (:heart:)
    newTx.txOuts.forEach((txOut) => {
      // We should have a switch here
      let firstByte = txOut.pkScript.slice(0, 1).toString('hex')
      let address

      switch (firstByte) {
        case '21':
          let pubkey = txOut.pkScript.slice(1, 34)
          address = pubkeyToAddress(pubkey)
          break

        case '76':
          let pubkeyHash = txOut.pkScript.slice(3, 23)
          address = pubkeyToAddress(pubkeyHash, true)
          break

        default:
          //console.log('unknown script')
      }

      if (ADDRESSES.indexOf(address)<0) {

        // Not in our wallet (false positive)
        return
      }

      console.log(newTx)

      // this.txs.put()

      this.updateBalance(txOut.value)
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

      console.log('We got all of them')

      // Need getBlocks because we cannot ask directly using the hedaers. We are
      // not sure of what the full node has or if has been pruned ?
      peer.sendGetBlocks()

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
              console.log('Looking into db')
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
              if (header.previousHash === '9e555073d0c4f36456db8951f449704d544d2826d9aa60636b40374626780abb') {
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
      console.log('Sync at ' + ((this.height/this.bestHeight)*100).toFixed(2)+ '%')

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

        // Need getBlocks because we cannot ask directly using the hedaers. We are
        // not sure of what the full node has or if has been pruned ?
        peer.sendGetBlocks()

      }

    })
  }

  updateBlocks (newBlocks) {
    // Choose a random peer to getBlocks
    let rand = Math.floor(Math.random() * this.peers.length)
    let peer = this.peers[rand]

    var promises = []
    newBlocks.map((newBlock) => {
      // Not particurlarly fast a batch call would be more appropriate
      var promise = new Promise((resolve, reject) => {
        this.blocks.get(newBlock.hash, (err, value) => {
          if (err) {
            if (err.type == 'NotFoundError') {
              this.blocks.put(newBlock.hash, newBlock, (err) => {
                if (err) reject(err)

                resolve()
              })
            } else {
              reject(err)
            }
          }
          resolve()
        })
      })
      promises.push(promise)
    })

    Promise.all(promises)
      .then(() => {
        this.headers.get(newBlocks[newBlocks.length - 1].hash, (err, value) => {
          if (err) {

            // Reverse the buffer to look for the hash in testnet blockchain explorer
            var hashReverse = ''
            var hashBuffer = Buffer.from(newBlocks[newBlocks.length - 1].hash, 'hex')
            for (var i=0; i < hashBuffer.length; i++) {
              hashReverse = hashBuffer.slice(i, i+1).toString('hex') + hashReverse
            }

            // Receiving INV cmd from new block which I don't have the headers saved yet---
            // throw err
            return
          }

          if (value.height === this.bestHeight) {
            return
          }

          console.log('Blocs synced at : ' + ((value.height/this.bestHeight)*100).toFixed(2)+ '%')
          peer.sendGetBlocks([newBlocks[newBlocks.length - 1].hash])
        })
      }).catch((err) => {
        throw err
      })
  }

  updateMerkleBlock (merkleblockMessage) {
    var hash = doubleHash(Buffer.from(merkleblockMessage.blockHeader, 'hex'))

    this.headers.get(hash.toString('hex'), (err, value) => {
      if (err) {
        // Send you not yet registered merkle block... but we don't have the header yet
        // console.log(hash)
        // console.log('Unknown header...')
        return
      }

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
    })

    this.merkle = merkleblockMessage
  }

  removePeer (peer) {
    if (this.peers.indexOf(peer) >= 0) {
      console.log('Slice Peer :', this.peers.indexOf(peer))
    }
  }

}

module.exports = SPVNode

const level = require('level')
const path = require('path')

class WalletDB {
  constructor (dataFolder) {
    const subPath = 'wallet'
    this.unspentOutputs = level(path.join(dataFolder, subPath, 'unspent'), { valueEncoding: 'json' })
    this.txs = level(path.join(dataFolder, subPath, 'tx'), { valueEncoding: 'json' })
    this.pubkeys = level(path.join(dataFolder, subPath, 'pubkey'), { valueEncoding: 'json' })
  }

  // Get all the UTXO from the database
  getAllUnspentTxOutputs () {
    const unspentTxOutputs = []

    return new Promise((resolve, reject) => {
      this.unspentOutputs.createReadStream()
        .on('data', (data) => {
          unspentTxOutputs.push(data)
        })
        .on('error', function (err) { reject(err) })
        .on('end', function () { resolve(unspentTxOutputs) })
    })
  }

  // Get a specific unspent output using hash + index as a unique ID
  // Succesfully resolve if not found
  getUnspentOutput (outputID) {
    return new Promise((resolve, reject) => {
      this.unspentOutputs.get(outputID, function (err, value) {
        if (err && err.type !== 'NotFoundError') { reject(err); return }
        if (err && err.type === 'NotFoundError') { resolve(); return }

        resolve(value)
      })
    })
  }

  // Delete an unspent output
  delUnspentOutput (outputID) {
    return this.unspentOutputs.del(outputID)
  }

  putTx (outputID, tx) {
    return this.txs.put(outputID, tx)
  }

  putUnspentOutput (outputID, utxo) {
    return this.unspentOutputs.put(outputID, utxo)
  }

  getTx (outputID) {
    return this.txs.get(outputID)
  }

  putPubkey (pubkey) {
    return this.pubkeys.put(pubkey.hash, pubkey)
  }

  getPubkey (pubkeyHash) {
    return new Promise((resolve, reject) => {
      this.pubkeys.get(pubkeyHash, function (err, value) {
        if (err && err.type !== 'NotFoundError') { reject(err); return }
        if (err && err.type === 'NotFoundError') { resolve(); return }

        resolve(value)
      })
    })
  }

  // Get all the UTXO from the database
  getAllPubkeys () {
    const pubkeys = []

    return new Promise((resolve, reject) => {
      this.pubkeys.createReadStream()
        .on('data', (data) => {
          pubkeys.push(data.value)
        })
        .on('error', function (err) { reject(err) })
        .on('end', function () { resolve(pubkeys) })
    })
  }
}

module.exports = WalletDB

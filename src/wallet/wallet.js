const bip39 = require('bip39')
const bip32 = require('bip32')
const { encodeRawTransaction } = require('../commands/tx')
const doubleHash = require('../utils/doubleHash')
const { getAddressFromScript } = require('../utils/script')
const CompactSize = require('../utils/compactSize')

const secp256k1 = require('secp256k1')

const debug = require('debug')('wallet')

const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')

const WalletDB = require('./db')

const {
  pubkeyToAddress,
  pubkeyToPubkeyHash,
  prepareTransactionToSign,
  indexToBufferInt32LE,
  serializePayToPubkeyHashScript
} = require('./utils')

const { MissingSeedError } = require('./errors')

// HD wallet for dogecoin
class Wallet extends EventEmitter {
  constructor (settings) {
    super()

    this.settings = settings
    this.pubkeys = new Map()
    this.pubkeyHashes = new Map()
    this.pendingTxIns = new Map()
    this.pendingTxOuts = new Map()
    this.db = new WalletDB(this.settings.DATA_FOLDER)

    this.seed_file = path.join(this.settings.DATA_FOLDER, 'seed.json')

    // Looking for seed file
    try {
      fs.accessSync(this.seed_file)
      this._seed = this._readSeedFile()
    } catch (err) {
      this._seed = null
    }
  }

  init () {
    // Need to generate the 20 addresses here
    for (let i = 0; i < 20; i++) {
      // We need 20 addresses for bloom filter to protect privacy and it is a standard
      this.generateAddress()
    }

    // We need so the pubkey hashes are updated
    for (let i = 0; i < 20; i++) {
      // We need 20 addresses for bloom filter to protect privacy and it is a standard
      this.generateChangeAddress()
    }
  }

  createSeedFile (mnemonic) {
    this._seed = bip39.mnemonicToSeedSync(mnemonic)
    fs.writeFileSync(this.seed_file, JSON.stringify({ seed: this._seed.toString('hex') }), { flag: 'w' })
  }

  _readSeedFile () {
    const data = fs.readFileSync(this.seed_file)
    const jsonData = JSON.parse(data)
    return Buffer.from(jsonData.seed, 'hex')
  }

  static generateMnemonic () {
    return bip39.generateMnemonic()
  }

  _getSeed () {
    if (!this._seed) { this._seed = this._readSeedFile() }
    return this._seed
  }

  _getMasterPrivKey () {
    if (!this._seed) throw new MissingSeedError()
    const root = bip32.fromSeed(this._seed, this.settings.WALLET)
    return root.toBase58()
  }

  _updatePubkeysState (index, publicKey, changeAddress = 0) {
    this.pubkeys.set(publicKey.toString('hex'), { index, changeAddress, used: false })
    const pubKeyHash = pubkeyToPubkeyHash(publicKey)
    this.pubkeyHashes.set(pubKeyHash.toString('hex'), { publicKey, index, changeAddress })
  }

  _getNextIndex (changeAddress = false) {
    let index = 0
    this.pubkeys.forEach(function (value) {
      index += value.changeAddress
    })
    return changeAddress ? index : this.pubkeys.size - index
  }

  async getBalance () {
    let balance = BigInt(0)

    const unspentTxOutputs = await this.db.getAllUnspentTxOutputs()

    for (const utxo of unspentTxOutputs) {
      // dont count pending transaction in balance
      if (!this.pendingTxIns.has(utxo.key.slice(0, -8))) {
        balance += BigInt(utxo.value.value)
      }
    }

    // Adding pending tx out for more accurate balance
    for (const txout of this.pendingTxOuts) {
      balance += txout.value
    }

    return balance
  }

  getAddress () {
    const iterator = this.pubkeys[Symbol.iterator]()

    let pk
    for (const pubkey of iterator) {
      if (!pubkey[1].used) {
        pk = pubkey[0]
      }
    }

    return pubkeyToAddress(Buffer.from(pk, 'hex'), this.settings.NETWORK_BYTE)
  }

  async addTxToWallet (tx) {
    // prepare BigInt conversion to string so we can save to db
    for (const i in tx.txOuts) {
      tx.txOuts[i].value = tx.txOuts[i].value.toString()
    }

    if (this.pendingTxOuts.has(tx.id)) {
      this.pendingTxOuts.delete(tx.id)
    }

    // Look for input which use our unspent output
    for (const txIn of tx.txIns) {
      const previousOutput = txIn.previousOutput.hash + txIn.previousOutput.index
      // If coinbase txIn we don't care
      if (txIn.previousOutput.hash === '0000000000000000000000000000000000000000000000000000000000000000') {
        return
      }

      const utxo = await this.db.getUnspentOutput(previousOutput)

      if (utxo) {
        // remove the transaction from unspent transaction list
        await this.db.delUnspentOutput(previousOutput)
        // remove from pending tx
        if (this.pendingTxIns.has(txIn.previousOutput.hash)) {
          this.pendingTxIns.delete(txIn.previousOutput.hash)
        }

        this.emit('balance')
      }
    }

    // Decode pkScript and determine what kind of script it is
    for (const index in tx.txOuts) {
      const txOut = tx.txOuts[index]
      let address

      const firstByte = txOut.pkScript.slice(0, 1).toString('hex')

      // TODO: utils function that return script type and its info
      switch (firstByte) {
        case '21':
          // public key !
          address = txOut.pkScript.slice(1, 34).toString('hex')
          break
        case '76':
        // public key hash !
          address = txOut.pkScript.slice(3, 23).toString('hex')
          break
          // P2SH !!!newTx.txOuts
        case 'a9':
          // redeem script hash !
          address = txOut.pkScript.slice(2, 22).toString('hex')
          break
        default:
          debug('unknown script')
      }

      if (!this.pubkeyHashes.has(address)) {
        // Not in our wallet (false positive)
        return
      }

      const indexBuffer = indexToBufferInt32LE(index)

      const output = tx.id + indexBuffer.toString('hex')

      debug(`New tx : ${output}`)

      await this.db.putTx(output, tx)

      const utxo = {
        txid: tx.id,
        vout: tx.txOuts.indexOf(txOut),
        value: txOut.value
      }

      // save only the unspent output in 'unspent'
      await this.db.putUnspentOutput(output, utxo)

      this.emit('balance')
    }
  }

  generateNewAddress (changeAddress = false) {
    const index = this._getNextIndex(changeAddress)
    const path = this.settings.PATH + (changeAddress ? '1' : '0') + '/' + index
    const root = bip32.fromSeed(this._seed, this.settings.WALLET)
    const child = root.derivePath(path)
    const address = pubkeyToAddress(child.publicKey, this.settings.NETWORK_BYTE)
    this._updatePubkeysState(index, child.publicKey, changeAddress ? 1 : 0)

    return address
  }

  generateAddress () {
    return this.generateNewAddress()
  }

  generateChangeAddress () {
    return this.generateNewAddress(true)
  }

  getPrivateKey (index, change) {
    const path = this.settings.PATH + change + '/' + index
    const root = bip32.fromSeed(this._seed, this.settings.WALLET)
    const child = root.derivePath(path)
    return child
  }

  async _collectInputsForAmount (amount) {
    const unspentOuputsIterator = this.db.unspentOutputs.iterator()
    let stop = false
    let total = BigInt(0)
    const txIns = []

    while (total < amount && !stop) {
      const value = await new Promise((resolve, reject) => {
        unspentOuputsIterator.next(async (err, key, value) => {
          if (err) { reject(err) }

          if (typeof value === 'undefined' && typeof key === 'undefined') {
            // We are at the end so over
            stop = true
            resolve()
            return
          }

          const data = await this.db.getTx(key)
          const txin = {
            previousOutput: { hash: value.txid, index: value.vout },
            // Temporary just so we can sign it (https://bitcoin.stackexchange.com/questions/32628/redeeming-a-raw-transaction-step-by-step-example-required/32695#32695)
            signature: Buffer.from(data.txOuts[value.vout].pkScript.data, 'hex'),
            sequence: 4294967294
          }
          txIns.push(txin)

          this.pendingTxIns.set(value.txid, txin)

          resolve(value)
        })
      })

      if (value) {
        total += BigInt(value.value)
      }
    }

    await new Promise(function (resolve, reject) {
      unspentOuputsIterator.end(function (err) {
        if (err) { reject(err) }

        resolve()
      })
    })

    return { txIns, total }
  }

  async send (amount, to, fee) {
    let changeAddress
    for (const [key, value] of this.pubkeys.entries()) {
      if (value.changeAddress && !value.used) {
        changeAddress = pubkeyToAddress(Buffer.from(key, 'hex'), this.settings.NETWORK_BYTE)
        break
      }
    }

    const transaction = {
      version: 1,
      txInCount: 0,
      txIns: [],
      txOutCount: 2,
      txOuts: [],
      locktime: 0,
      hashCodeType: 1
    }

    const balance = await this.getBalance()

    if (balance < amount) {
      debug('Not enought funds!')
      throw new Error('Not enought funds')
    }

    const { txIns, total } = await this._collectInputsForAmount(amount)

    transaction.txIns = txIns
    transaction.txInCount = txIns.length

    let pkScript = serializePayToPubkeyHashScript(to)

    transaction.txOuts[0] = {
      value: amount,
      pkScriptSize: pkScript.length,
      pkScript
    }

    // If we have some change that need to be sent back
    if (total > amount) {
      if (!changeAddress) {
        changeAddress = this.generateChangeAddress()
      }

      pkScript = serializePayToPubkeyHashScript(changeAddress)

      transaction.txOuts[1] = {
        value: total - amount - fee,
        pkScriptSize: pkScript.length,
        pkScript
      }
    }

    transaction.txOutCount = transaction.txOuts.length

    debug('Tx in counts : ', transaction.txInCount)

    for (let txInIndex = 0; txInIndex < transaction.txInCount; txInIndex++) {
      const rawUnsignedTransaction = prepareTransactionToSign(transaction, txInIndex)
      const rawTransactionHash = doubleHash(rawUnsignedTransaction)

      // Which key ? Fuck
      const address = getAddressFromScript(transaction.txIns[txInIndex].signature)
      let value

      // We have pubkey hash
      // If public key compressed it should be 33 bytes (https://bitcoin.stackexchange.com/questions/2013/why-does-the-length-of-a-bitcoin-key-vary#2014)
      // TODO
      if (address.length === 20) {
        debug('PubKey Hash! Looking for index...')
        value = this.pubkeyHashes.get(address.toString('hex'))
      }

      const key = this.getPrivateKey(value.index, value.changeAddress)

      const signature = secp256k1.ecdsaSign(Buffer.from(rawTransactionHash, 'hex'), key.privateKey)

      const signatureDer = Buffer.from(secp256k1.signatureExport(signature.signature))

      const signatureCompactSize = CompactSize.fromSize(signatureDer.length + 1)
      const publicKeyCompactSize = CompactSize.fromSize(key.publicKey.length)

      const scriptSig = signatureCompactSize.toString('hex') + signatureDer.toString('hex') + '01' + publicKeyCompactSize.toString('hex') + key.publicKey.toString('hex')

      transaction.txIns[txInIndex].signatureSize = CompactSize.fromSize(Buffer.from(scriptSig).length, 'hex')
      transaction.txIns[txInIndex].signature = Buffer.from(scriptSig, 'hex')
    }

    delete transaction.hashCodeType

    const rawTransaction = encodeRawTransaction(transaction)

    if (transaction.txOuts[1]) {
      this.pendingTxOuts.set(doubleHash(rawTransaction).toString('hex'), transaction.txOuts[1])
    }

    return rawTransaction
  }
}

module.exports = Wallet

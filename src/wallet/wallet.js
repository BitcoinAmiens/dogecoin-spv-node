const bip39 = require('bip39')
const bip32 = require('bip32')
const { encodeRawTransaction } = require('../commands/tx')
const doubleHash = require('../utils/doubleHash')
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
  serializePayToPubkeyHashScript,
  serializePayToMultisigWithTimeLockScript,
  createPayToHash,
  getPubkeyHashFromScript
} = require('./utils')

const { MissingSeedError, NotEnoughtKeysGenerated } = require('./errors')

// HD wallet for dogecoin
class Wallet extends EventEmitter {
  constructor (settings) {
    super()

    this.settings = settings
    this.pendingTxIns = new Map()
    this.pendingTxOuts = new Map()
    this.db = new WalletDB(this.settings.DATA_FOLDER)

    this.seed_file = path.join(this.settings.DATA_FOLDER, 'seed.json')

    this._nextAddressIndex = 0
    this._nextChangeAddressIndex = 0

    // Looking for seed file
    // if seed file not create throw an error
    this._seed = this._readSeedFile()
  }

  async init () {
    const pubkeys = await this.db.getAllPubkeys()
    if (pubkeys.length === 0) {
      for (let i = 0; i < 20; i++) {
        // We need 20 addresses for bloom filter to protect privacy and it is a standard
        await this.generateAddress()
      }
    } else {
      if (pubkeys.length < 20) { throw new NotEnoughtKeysGenerated() }
      // Calculate addresses index
      let countChangeAddress = 0
      for (const pubkey of pubkeys) {
        debug(pubkeyToAddress(Buffer.from(pubkey.publicKey, 'hex'), this.settings.NETWORK_BYTE))
        if (pubkey.isChangeAddress) {
          countChangeAddress = countChangeAddress + 1
        }
      }
      this._nextAddressIndex = pubkeys.length - countChangeAddress
      this._nextChangeAddressIndex = countChangeAddress
    }
  }

  static createSeedFile (mnemonic, seedFile) {
    const seed = bip39.mnemonicToSeedSync(mnemonic)
    fs.writeFileSync(seedFile, JSON.stringify({ seed: seed.toString('hex') }), { flag: 'w' })
  }

  async getAllpubkeyHashes () {
    const pubkeys = await this.db.getAllPubkeys()
    const pubkeyHashes = []
    for (const pubkey of pubkeys) {
      pubkeyHashes.push(pubkey.hash)
    }
    return pubkeyHashes
  }

  _readSeedFile () {
    const data = fs.readFileSync(this.seed_file)
    const jsonData = JSON.parse(data)
    return Buffer.from(jsonData.seed, 'hex')
  }

  static generateMnemonic () {
    return bip39.generateMnemonic()
  }

  _getMasterPrivKey () {
    if (!this._seed) throw new MissingSeedError()
    const root = bip32.fromSeed(this._seed, this.settings.WALLET)
    return root.toBase58()
  }

  async _updatePubkeysState (index, publicKey, isChangeAddress = 0) {
    const pubKeyHash = pubkeyToPubkeyHash(publicKey)
    await this.db.putPubkey({ hash: pubKeyHash.toString('hex'), publicKey: publicKey.toString('hex'), isChangeAddress, index, used: false })
  }

  async _getNextIndex (changeAddress = false) {
    const pubkeys = await this.db.getAllPubkeys()
    let countChangeAddress = 0
    for (const pubkey of pubkeys) {
      if (pubkey.isChangeAddress) {
        countChangeAddress = countChangeAddress + 1
      }
    }
    return changeAddress ? countChangeAddress : pubkeys.length - countChangeAddress
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
      balance += BigInt(txout[1].value)
    }

    return balance
  }

  // Find an unused address or generate a new one
  async getUnusedPubkey () {
    const pubkeys = await this.db.getAllPubkeys()

    let pk
    for (const pubkey of pubkeys) {
      if (!pubkey.used) {
        if ((pk && pubkey.index < pk.index) || !pk) {
          pk = pubkey
        }
      }
    }

    if (!pk) {
      return this.generatePublicKey()
    }

    return Buffer.from(pk.publicKey, 'hex')
  }

    // Return a unused address
    async getAddress () {
      const pubkey = await this.getUnusedPubkey()

      return pubkeyToAddress(pubkey, this.settings.NETWORK_BYTE)
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

      const pubkeyHash = getPubkeyHashFromScript(txOut.pkScript)
      if (!pubkeyHash) {
        debug('unknown script')
        return
      }

      const pubkey = await this.db.getPubkey(pubkeyHash.toString('hex'))
      if (!pubkey) {
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

  async generatePublicKey (isChangeAddress = false) {
    const index = await this._getNextIndex(isChangeAddress)
    const path = this.settings.PATH + (isChangeAddress ? '1' : '0') + '/' + index
    const root = bip32.fromSeed(this._seed, this.settings.WALLET)
    const child = root.derivePath(path)
    await this._updatePubkeysState(index, child.publicKey, isChangeAddress ? 1 : 0)

    return child.publicKey
  }

  async generateNewAddress (isChangeAddress = false) {
    const pubkey = await this.generatePublicKey(isChangeAddress)

    return pubkeyToAddress(pubkey, this.settings.NETWORK_BYTE)
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

  async initiatePaymentChannel (amount, toPublicKey, fee, blocksLock) {
    let changeAddress
    const pubkeys = await this.db.getAllPubkeys()

    debug(`send! ${amount} ${fee}`)

    for (const pubkey of pubkeys) {
      if (pubkey.isChangeAddress && !pubkey.used) {
        changeAddress = pubkeyToAddress(Buffer.from(pubkey.publicKey, 'hex'), this.settings.NETWORK_BYTE)
        break
      }
    }

    if (!changeAddress) {
      changeAddress = await this.generateChangeAddress()
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

    const unusedPubkey = await this.getUnusedPubkey()
    const multisigScript = serializePayToMultisigWithTimeLockScript([unusedPubkey.toString('hex'), toPublicKey], blocksLock)
    const p2sh = createPayToHash(multisigScript)

    // TODO: save address and maybe add it to the filter
    debug(`P2SH hash script : ${p2sh.hashScript.toString('hex')}`)

    transaction.txOuts[0] = {
      value: amount,
      pkScriptSize: p2sh.script.length,
      pkScript: p2sh.script
    }

    // If we have some change that need to be sent back
    if (total > amount) {
      const pkScript = serializePayToPubkeyHashScript(changeAddress)

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

      const pubkeyHash = getPubkeyHashFromScript(transaction.txIns[txInIndex].signature)

      // We have pubkey hash
      debug('PubKey Hash! Looking for index...')
      const pubkey = await this.db.getPubkey(pubkeyHash.toString('hex'))

      const key = this.getPrivateKey(pubkey.index, pubkey.isChangeAddress)

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

    // TODO: Adding this to pending txs should be done once it has been successfully broadcasted
    if (transaction.txOuts[1]) {
      this.pendingTxOuts.set(doubleHash(rawTransaction).toString('hex'), transaction.txOuts[1])
    }

    debug(rawTransaction.toString('hex'))

    // use raw transaction to create refund transaction
    
    return { address: pubkeyToAddress(p2sh.hashScript, this.settings.SCRIPT_BYTE), rawTransaction: rawTransaction }
  }

  async send (amount, to, fee) {
    let changeAddress
    const pubkeys = await this.db.getAllPubkeys()

    debug(`send! ${amount} ${fee}`)

    for (const pubkey of pubkeys) {
      if (pubkey.isChangeAddress && !pubkey.used) {
        changeAddress = pubkeyToAddress(Buffer.from(pubkey.publicKey, 'hex'), this.settings.NETWORK_BYTE)
        break
      }
    }

    if (!changeAddress) {
      changeAddress = await this.generateChangeAddress()
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

      const pubkeyHash = getPubkeyHashFromScript(transaction.txIns[txInIndex].signature)

      // We have pubkey hash
      debug('PubKey Hash! Looking for index...')
      const pubkey = await this.db.getPubkey(pubkeyHash.toString('hex'))

      const key = this.getPrivateKey(pubkey.index, pubkey.isChangeAddress)

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

    // TODO: Adding this to pending txs should be done once it has been successfully broadcasted
    if (transaction.txOuts[1]) {
      this.pendingTxOuts.set(doubleHash(rawTransaction).toString('hex'), transaction.txOuts[1])
    }

    debug(rawTransaction.toString('hex'))
    return rawTransaction
  }
}

module.exports = Wallet

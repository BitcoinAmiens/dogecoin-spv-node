const bip39 = require('bip39')
const bip32 = require('bip32')
const { encodeRawTransaction } = require('../commands/tx')
const doubleHash = require('../utils/doubleHash')
const CompactSize = require('../utils/compactSize')

const debug = require('debug')('wallet')

const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')

const WalletDB = require('./db')
const { ScriptTypes } = require('./scripts')

const {
  pubkeyToAddress,
  pubkeyToPubkeyHash,
  prepareTransactionToSign,
  indexToBufferInt32LE,
  serializePayToPubkeyHashScript,
  serializePayToMultisigWithTimeLockScript,
  createPayToHash,
  getPubkeyHashFromScript,
  getScriptType,
  extractPubkeyHashFromP2PK,
  extractPubkeyHashFromP2PKH,
  extractScriptHashFromP2SH,
  sign
} = require('./utils')

const { MissingSeedError, NotEnoughtKeysGenerated, BalanceTooLow } = require('./errors')

// HD wallet for dogecoin
class Wallet extends EventEmitter {
  constructor (settings) {
    super()

    this.settings = settings
    this.pendingTxIns = new Map()
    this.pendingTxOuts = new Map()
    this.db = new WalletDB(this.settings.DATA_FOLDER)

    this._seedFile = path.join(this.settings.DATA_FOLDER, 'seed.json')
    this._redeemScriptsFile = path.join(this.settings.DATA_FOLDER, 'redeemscripts.json')

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
        debug(`Adding ${pubkeyToAddress(Buffer.from(pubkey.publicKey, 'hex'), this.settings.NETWORK_BYTE).toString('hex')}`)
        if (pubkey.isChangeAddress) {
          countChangeAddress = countChangeAddress + 1
        }
      }
      this._nextAddressIndex = pubkeys.length - countChangeAddress
      this._nextChangeAddressIndex = countChangeAddress
    }

    // Sync with redeemscripts.json
    const redeemScripts = this._readRedeemScriptsFile()
    for (const rs of redeemScripts) {
      const result = await this.db.getRedeemScript(rs.key)
      if (!result) {
        // If missing we add it
        await this.db.putRedeemScript(rs.key, rs.value)
      }
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
    const data = fs.readFileSync(this._seedFile)
    const jsonData = JSON.parse(data)
    return Buffer.from(jsonData.seed, 'hex')
  }

  _readRedeemScriptsFile () {
    if (!fs.existsSync(this._redeemScriptsFile)) {
      fs.writeFileSync(this._redeemScriptsFile, JSON.stringify([]), { flag: 'w' })
      return []
    }

    const data = fs.readFileSync(this._redeemScriptsFile)
    return JSON.parse(data)
  }

  updateRedeemScriptFile (rs) {
    let data = fs.readFileSync(this._redeemScriptsFile)
    data = JSON.parse(data)
    data.push(rs)
    fs.writeFileSync(this._redeemScriptsFile, JSON.stringify(data), { flag: 'w' })
  }

  saveRedeemScriptData (key, value) {
    this.updateRedeemScriptFile({ key, value })
    this.db.putRedeemScript(key, value)
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

  async _getChangeAddress () {
    let changeAddress
    const pubkeys = await this.db.getAllPubkeys()

    for (const pubkey of pubkeys) {
      if (pubkey.isChangeAddress && !pubkey.used) {
        changeAddress = pubkeyToAddress(Buffer.from(pubkey.publicKey, 'hex'), this.settings.NETWORK_BYTE)
        break
      }
    }

    if (!changeAddress) {
      changeAddress = await this.generateChangeAddress()
    }

    return changeAddress
  }

  async getBalance () {
    let balance = BigInt(0)

    const unspentTxOutputs = await this.db.getAllUnspentTxOutputs()

    for (const utxo of unspentTxOutputs) {
      // dont count pending transaction in balance or multisig tx neither
      if (!this.pendingTxIns.has(utxo.key.slice(0, -8)) && utxo.value.type !== ScriptTypes.PAY_TO_SCRIPT_HASH) {
        balance += BigInt(utxo.value.value)
      }
    }

    // Adding pending tx out for more accurate balance
    for (const txout of this.pendingTxOuts) {
      balance += BigInt(txout[1].value)
    }

    return balance
  }

  async getPaymentChannels () {
    const paymentChannels = []

    const unspentTxOutputs = await this.db.getAllUnspentTxOutputs()

    for (const utxo of unspentTxOutputs) {
      if (!this.pendingTxIns.has(utxo.value.txid) && utxo.value.type === ScriptTypes.PAY_TO_SCRIPT_HASH) {
        const tx = await this.db.getTx(utxo.key)
        const pkScript = Buffer.from(tx.txOuts[utxo.value.vout].pkScript)
        const hash = getPubkeyHashFromScript(pkScript)
        const address = pubkeyToAddress(hash, this.settings.SCRIPT_BYTE, true).toString('hex')

        debug(hash.toString('hex'))
        const commitment = await this.db.getCommitment(hash.toString('hex'))
        let precedentCommitmentValue = 0n
        if (commitment) {
          debug('Got one commitment')
          precedentCommitmentValue = BigInt(commitment.txOuts[0].value)
        }

        const balance = BigInt(utxo.value.value) - precedentCommitmentValue

        paymentChannels.push({ address, balance })
      }
    }

    return paymentChannels
  }

  async getPaymentChannel (addressP2SH) {
    const unspentTxOutputs = await this.db.getAllUnspentTxOutputs()

    for (const utxo of unspentTxOutputs) {
      if (!this.pendingTxIns.has(utxo.value.txid) && utxo.value.type === ScriptTypes.PAY_TO_SCRIPT_HASH) {
        const tx = await this.db.getTx(utxo.key)
        const pkScript = Buffer.from(tx.txOuts[utxo.value.vout].pkScript)
        const hash = getPubkeyHashFromScript(pkScript)
        const address = pubkeyToAddress(hash, this.settings.SCRIPT_BYTE, true).toString('hex')
        if (address === addressP2SH) {
          return tx
        }
      }
    }

    return null
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
    debug(tx)

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
      debug(txOut)

      const scriptType = getScriptType(txOut.pkScript)

      let scriptElement
      switch (scriptType) {
        case ScriptTypes.PAY_TO_PUBKEY:
          scriptElement = await this._handleP2PK(txOut.pkScript)
          break
        case ScriptTypes.PAY_TO_PUBKEY_HASH:
          scriptElement = await this._handleP2PKH(txOut.pkScript)
          break
        case ScriptTypes.PAY_TO_SCRIPT_HASH:
          scriptElement = await this._handleP2SH(txOut.pkScript)
          break
        default:
          debug('unknown script')
      }

      if (!scriptElement) {
        // Not in our wallet (false positive)
        continue
      }

      // Standard transaction
      const indexBuffer = indexToBufferInt32LE(index)

      const output = tx.id + indexBuffer.toString('hex')

      debug(`New tx : ${output}`)

      await this.db.putTx(output, tx)

      const utxo = {
        txid: tx.id,
        vout: tx.txOuts.indexOf(txOut),
        value: txOut.value,
        type: scriptType
      }

      debug(utxo)

      // save only the unspent output in 'unspent'
      await this.db.putUnspentOutput(output, utxo)

      this.emit('balance')
    }
  }

  async _handleP2PK (script) {
    const pubkeyHash = extractPubkeyHashFromP2PK(script)
    const pubkey = await this.db.getPubkey(pubkeyHash.toString('hex'))

    return pubkey
  }

  async _handleP2PKH (script) {
    debug('handle P2PKH')
    const pubkeyHash = extractPubkeyHashFromP2PKH(script)
    const pubkey = await this.db.getPubkey(pubkeyHash.toString('hex'))

    return pubkey
  }

  async _handleP2SH (script) {
    debug('Handle P2SH tx')
    let hashScript = extractScriptHashFromP2SH(script)
    hashScript = await this.db.getRedeemScript(hashScript.toString('hex'))

    return hashScript
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

          if (value.type === ScriptTypes.PAY_TO_SCRIPT_HASH) {
            // If is is a multisig don't use it
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

  _newTx () {
    return {
      version: 1,
      txIns: [],
      txOuts: [],
      locktime: 0,
      hashCodeType: 1
    }
  }

  async _signTransaction (transaction, index, redeemScript = null) {
    debug(`index to sign ${index}`)
    const rawUnsignedTransaction = prepareTransactionToSign(transaction, index)
    const rawTransactionHash = doubleHash(rawUnsignedTransaction)

    debug(`RawTransaction : ${rawUnsignedTransaction.toString('hex')}`)

    let pubkeyHash

    if (redeemScript) {
      pubkeyHash = pubkeyToPubkeyHash(Buffer.from(redeemScript.pubkey, 'hex'))
    } else {
      pubkeyHash = getPubkeyHashFromScript(transaction.txIns[index].signature)
    }

    // We have pubkey hash
    debug(`PubKey Hash ${pubkeyHash.toString('hex')}! Looking for index...`)
    const pubkey = await this.db.getPubkey(pubkeyHash.toString('hex'))

    const key = this.getPrivateKey(pubkey.index, pubkey.isChangeAddress)

    debug(`Pubkey ${key.publicKey.toString('hex')}`)

    const signature = sign(rawTransactionHash, key.privateKey)

    return { signature, publicKey: key.publicKey }
  }

  _addP2KHSignature (transaction, signature, publicKey, index) {
    const signatureCompactSize = CompactSize.fromSize(signature.length + 1)
    const publicKeyCompactSize = CompactSize.fromSize(publicKey.length)

    const scriptSig = signatureCompactSize.toString('hex') + signature.toString('hex') + '01' + publicKeyCompactSize.toString('hex') + publicKey.toString('hex')

    transaction.txIns[index].signatureSize = CompactSize.fromSize(Buffer.from(scriptSig).length, 'hex')
    transaction.txIns[index].signature = Buffer.from(scriptSig, 'hex')

    return transaction
  }

  async initiatePaymentChannel (amount, toPublicKey, fee, blocksLock) {
    debug('Initiate payment channel')

    const balance = await this.getBalance()
    if (balance < amount) {
      debug('Not enought funds!')
      throw new BalanceTooLow()
    }

    const changeAddress = await this._getChangeAddress()
    let transaction = this._newTx()

    const { txIns, total } = await this._collectInputsForAmount(amount)
    debug(total)

    transaction.txIns = txIns

    const unusedPubkey = await this.getUnusedPubkey()
    const multisigScript = serializePayToMultisigWithTimeLockScript([unusedPubkey.toString('hex'), toPublicKey], blocksLock)
    const p2sh = createPayToHash(multisigScript)

    debug(`P2SH script : ${multisigScript.toString('hex')}`)
    debug(`P2SH hash script : ${p2sh.hashScript.toString('hex')}`)
    const redeemScript = { script: multisigScript.toString('hex'), recipient: toPublicKey, pubkey: unusedPubkey.toString('hex') }

    this.saveRedeemScriptData(p2sh.hashScript.toString('hex'), redeemScript)

    transaction.txOuts[0] = {
      value: amount - fee,
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

    debug('Tx in counts : ', transaction.txIns.length)

    for (const txInIndex in transaction.txIns) {
      const { signature, publicKey } = await this._signTransaction(transaction, txInIndex)

      transaction = this._addP2KHSignature(transaction, signature, publicKey, txInIndex)
    }

    delete transaction.hashCodeType

    const rawTransaction = encodeRawTransaction(transaction)

    // TODO: Adding this to pending txs should be done once it has been successfully broadcasted
    if (transaction.txOuts[1]) {
      this.pendingTxOuts.set(doubleHash(rawTransaction).toString('hex'), transaction.txOuts[1])
    }

    // need to calculate the txid
    const txid = doubleHash(rawTransaction)
    // Calculate return payment

    // use raw transaction to create refund transaction
    const returnTx = this._newTx()
    returnTx.txIns.push({
      previousOutput: { hash: txid, index: 0 },
      signature: Buffer.from(redeemScript.script, 'hex'),
      sequence: 4294967294
    })

    const newAddress = await this.getAddress()
    const pkScript = serializePayToPubkeyHashScript(newAddress)
    returnTx.txOuts.push({
      value: amount - 2n * fee,
      pkScriptSize: pkScript.length,
      pkScript
    })

    const { signature } = await this._signTransaction(returnTx, '0', redeemScript)

    returnTx.txIns[0].signatureSize = CompactSize.fromSize(0)
    returnTx.txIns[0].signature = Buffer.alloc(0)

    const rawReturnTransaction = encodeRawTransaction(returnTx)

    return {
      address: pubkeyToAddress(p2sh.hashScript, this.settings.SCRIPT_BYTE, true),
      rawTransaction,
      rawReturnTransaction,
      returnTxSignature: signature,
      transaction,
      hashScript: p2sh.hashScript,
      redeemScript: multisigScript
    }
  }

  async createMicroPayment (amount, p2shAddress, fee) {
    debug(`sign micro transaction! ${amount} ${p2shAddress} ${fee}`)

    const changeAddress = await this._getChangeAddress()
    const transaction = this._newTx()

    const p2shTx = await this.getPaymentChannel(p2shAddress)
    const total = BigInt(p2shTx.txOuts[0].value)

    transaction.txIns.push({
      previousOutput: { hash: p2shTx.id, index: 0 },
      signature: Buffer.from(p2shTx.txOuts[0].pkScript.data),
      sequence: 4294967294
    })

    const hashScript = extractScriptHashFromP2SH(Buffer.from(p2shTx.txOuts[0].pkScript, 'hex'))

    const latestCommitment = await this.db.getCommitment(hashScript.toString('hex'))
    let precedentCommitmentAmount = 0n
    if (latestCommitment) {
      precedentCommitmentAmount = BigInt(latestCommitment.txOuts[0].value)
    }

    // Verify we have enought fund
    if (total < amount + precedentCommitmentAmount + fee) {
      debug(`Total available : ${total}, Precedent Commitment: ${precedentCommitmentAmount}`)
      throw new BalanceTooLow()
    }

    const redeemScript = await this.db.getRedeemScript(hashScript.toString('hex'))

    const to = pubkeyToAddress(Buffer.from(redeemScript.recipient, 'hex'), this.settings.NETWORK_BYTE)
    let pkScript = serializePayToPubkeyHashScript(to)

    transaction.txOuts[0] = {
      value: amount + precedentCommitmentAmount,
      pkScriptSize: pkScript.length,
      pkScript
    }

    // If we have some change that need to be sent back
    if (total > amount + fee) {
      pkScript = serializePayToPubkeyHashScript(changeAddress)
      transaction.txOuts[1] = {
        value: total - amount - fee,
        pkScriptSize: pkScript.length,
        pkScript
      }
    }

    // Micro payment transaction as always only 1 txin which is our p2sh tx
    const { signature } = await this._signTransaction(transaction, '0', redeemScript)

    transaction.txIns[0].signatureSize = CompactSize.fromSize(0)
    transaction.txIns[0].signature = Buffer.alloc(0)

    delete transaction.hashCodeType

    const commitmentTx = encodeRawTransaction(transaction)

    // Save latest commitment
    // TODO: only save if 200 from payment server
    await this.db.putCommitment(hashScript.toString('hex'), transaction)

    return { commitmentTx, signature, redeemScript: redeemScript.script }
  }

  async send (amount, to, fee) {
    debug(`send! ${amount} ${fee}`)

    const changeAddress = await this._getChangeAddress()
    let transaction = this._newTx()

    const balance = await this.getBalance()

    if (balance < amount) {
      throw new BalanceTooLow()
    }

    const { txIns, total } = await this._collectInputsForAmount(amount)

    transaction.txIns = txIns

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

    debug('Tx in counts : ', transaction.txIns.length)

    for (const txInIndex in transaction.txIns) {
      const { signature, publicKey } = await this._signTransaction(transaction, txInIndex)

      transaction = this._addP2KHSignature(transaction, signature, publicKey, txInIndex)
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

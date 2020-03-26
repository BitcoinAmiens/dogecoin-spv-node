const bip39 = require('bip39')
const bip32 = require('bip32')
const {prepareTransactionToSign, encodeRawTransaction} = require('./commands/tx')
const bs58check = require('bs58check')
const doubleHash = require('./utils/doubleHash')
const { getAddressFromScript } = require('./utils/script')
const CompactSize = require('./utils/compactSize')

const RIPEMD160 = require('ripemd160')
const crypto = require('crypto')
const secp256k1 = require('secp256k1')

const debug = require('debug')('wallet')

const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')
var level = require('level')

//const Transport = require('@ledgerhq/hw-transport-node-hid').default
//const AppBtc = require('@ledgerhq/hw-app-btc').default
const constants = require('./constants')
const pubkeyToAddress = require('./utils/pubkeyToAddress')

const SEED_FILE = path.join("data","seed.json")

// HD wallet for dogecoin
class Wallet extends EventEmitter {
  constructor () {
    super()

    this.addresses = []
    this.pubkeys = new Map()
    this.pubkeyHashes = new Map()
    this.unspentOutputs = level(__dirname + '/../data/wallet/unspent', {valueEncoding: 'json'})
    this.txs = level(__dirname + '/../data/wallet/tx', {valueEncoding: 'json'})

    // ONLY USE FOR REGTEST AND TESTNET !
    this._mnemonic = "neutral acoustic balance describe access pitch tourist skull recycle nation silent crawl"


    // Looking for seed file
    try {
      fs.accessSync(SEED_FILE)
      this._seed = this._readSeedFile()
    } catch (err) {
      this._createSeedFile()
    }

    // Need to generate the 20 addresses here
    for (let i = 0; i < 20; i++) {
      // We need 20 addresses for bloom filter to protect privacy and it is a standard
      this.generateAddress()
    }

    // Do we also need the change address ?
    // I don't think so we only need to follow the tx!
    // If it is a change address it will only be an output from a transaction
    // we will send
    /*for (let i = 0; i < 20; i++) {
      // We need 20 addresses for bloom filter to protect privacy and it is a standard
      console.log(this.generateChangeAddress())
    }*/
  }

  _createSeedFile () {
    var seed = this._getSeed()
    fs.writeFileSync(SEED_FILE, JSON.stringify({seed: seed.toString('hex')}))
  }

  _readSeedFile () {
    var data = fs.readFileSync(SEED_FILE)
    var jsonData = JSON.parse(data)
    return Buffer.from(jsonData.seed, 'hex')
  }

  _generateMnemonic () {
    if (this._mnemonic) {

      console.log("You already have a mnemonic registered")
      return false
    }
    this._mnemonic = bip39.generateMnemonic()
    return this._mnemonic
  }

  _getSeed () {
    if (!this._mnemonic) throw new Error('You need to generate a mnemonic first')
    this._seed = bip39.mnemonicToSeedSync(this._mnemonic)
    return this._seed
  }

  _getMasterPrivKey () {
    if (!this._seed) throw new Error('You need your seed first')
    const root = bip32.fromSeed(this._seed, constants.WALLET)
    return root.toBase58()
  }

  _pubkeyToPubkeyHash (pubkey) {
    let pubKeyHash = crypto.createHash('sha256').update(pubkey).digest()
    pubKeyHash = new RIPEMD160().update(pubKeyHash).digest()

    return pubKeyHash
  }

  _updatePubkeysState (index, publicKey, changeAddress=0) {
    this.pubkeys.set(publicKey.toString('hex'), {index, changeAddress})
    const pubKeyHash = this._pubkeyToPubkeyHash(publicKey)
    this.pubkeyHashes.set(pubKeyHash.toString('hex'), {publicKey, index, changeAddress})
  }

  _getNextIndex (changeAddress = false) {
    let index = 0
    this.pubkeys.forEach(function (value) {
      index += value.changeAddress
    })
    return changeAddress ? index : this.pubkeys.size - index
  }

  async getBalance () {
    let balance = 0
    return await new Promise((resolve, reject) => {
      this.unspentOutputs.createReadStream()
        .on('data', function (data) {
          balance += data.value.value
        })
        .on('error', function (err) { reject(err) })
        .on('end', function () { resolve(balance) })
    })
  }

  // TODO: NOT GOOD
  getPubKey () {
    const path = "m/44'/3'/0'/0/0"
    // Waste of computing power to regenerate root
    const root = bip32.fromSeed(this._seed, constants.WALLET)
    const child1 = root.derivePath(path)
    return child1.publicKey
  }

  // TODO: NOT GOOD
  getAddress () {
    const path = "m/44'/1'/0'/0/0"
    const root = bip32.fromSeed(this._seed, constants.WALLET)
    const child1 = root.derivePath(path)
    return pubkeyToAddress(child1.publicKey)
  }

  addTxToWallet (tx) {
    // Whatever happened we save it even if it is not yours
    // It will be needed for filter (keeps same filter as nodes)
    this.txs.put(tx.id, tx, (err) => {
      if (err) { throw err }
    })

    // Look for input which use our unspent output
    tx.txIns.forEach((txIn) => {
      let previousOutput = txIn.previousOutput.hash + txIn.previousOutput.index
      // If coinbase txIn we don't care
      if (txIn.previousOutput.hash === '0000000000000000000000000000000000000000000000000000000000000000') {
        return
      }

      // Should be hash and id ?
      this.unspentOutputs.get(previousOutput, (err, value) => {
        if (err && err.type !== 'NotFoundError') throw err
        if (err && err.type === 'NotFoundError') return

        if (value) {
          // remove the transaction from unspent transaction list
          this.unspentOutputs.del(previousOutput, (err) => {
            if (err) throw err

            this.emit('balance')
          })
        }
      })
    })


  // TODO: need to verify if address belongs to wallet
  // And we actually need txOuts records not txs stupid (:heart:)
  // Do we actually want to do that bit here ? Might be interesting to have it in the main app
  // because in the future we want to decouple spvnode and wallet.
  tx.txOuts.forEach((txOut, index) => {

    // We should have a switch here
    let firstByte = txOut.pkScript.slice(0, 1).toString('hex')
    let address

    switch (firstByte) {
      case '21':
        let pubkey = txOut.pkScript.slice(1, 34)
        address = pubkey.toString('hex')
        break

      case '76':
        let pubkeyHash = txOut.pkScript.slice(3, 23)
        address = pubkeyHash.toString('hex')
        break

      // P2SH !!!newTx.txOuts
      case 'a9':
        let redeemScriptHash = txOut.pkScript.slice(2, 22)
        address = redeemScriptHash.toString('hex')
        break

      default:
        debug('unknown script')
    }

    if (!this.pubkeyHashes.has(address)) {
      // Not in our wallet (false positive)
      return
    }

    let indexBuffer = Buffer.allocUnsafe(4)
    indexBuffer.writeInt32LE(index, 0)

    let output = tx.id + indexBuffer.toString('hex')

    debug(`New tx : ${tx}`)

    // Save full tx in 'txs'
    this.txs.put(output, tx, (err) => {
      if (err) throw err

      // save only the unspent output in 'unspent'
      this.unspentOutputs.put(output, {txid: tx.id, vout: tx.txOuts.indexOf(txOut), value: txOut.value}, (err) => {
        if (err) throw err

        debug('Register unspent tx')

        this.emit('balance')
      })
    })
  })
  }

  generateNewAddress (changeAddress = false) {
    const index = this._getNextIndex(changeAddress)
    const path = constants.PATH + (changeAddress ? '1':'0') + '/' + index
    const root = bip32.fromSeed(this._seed, constants.WALLET)
    const child = root.derivePath(path)
    let address = pubkeyToAddress(child.publicKey)
    this._updatePubkeysState(index, child.publicKey, changeAddress ? 1 : 0)
    //this.pubkeys.push(child.publicKey.toString('hex'))
    return address
  }

  generateAddress () {
    return this.generateNewAddress()
  }

  generateChangeAddress () {
    return this.generateNewAddress(true)
  }

  getPrivateKey (index) {
    const path = constants.PATH + '0' + '/' + index
    const root = bip32.fromSeed(this._seed, constants.WALLET)
    const child = root.derivePath(path)
    return child
  }

  async send (amount, to) {
    let changeAddress = this.generateChangeAddress()
    let transaction = {
      version: 1,
      txInCount: 0,
      txIns: [],
      txOutCount: 2,
      txOuts: [],
      locktime: 0,
      hashCodeType: 1
    }

    let total = 0

    let balance = await this.getBalance()

    if (balance < amount) {
      debug('Not enought funds!')
      return
    }

    let unspentOuputsIterator = this.unspentOutputs.iterator()
    let stop = false

    while (total < amount && !stop) {

      // TODO: clean! Have a proper function for that
      let value = await new Promise((resolve, reject) => {
        unspentOuputsIterator.next((err, key, value) => {
          if (err) { reject(err) }

          if (typeof value === "undefined" && typeof key === "undefined") {
            // We are at the end so over
            stop = true
            resolve()
            return
          }

          this.txs.get(value.txid)
            .then((data) => {
              console.log(value)
              console.log(data)

              transaction.txIns.push({
                previousOutput: { hash: value.txid, index: value.vout},
                // Temporary just so we can sign it (https://bitcoin.stackexchange.com/questions/32628/redeeming-a-raw-transaction-step-by-step-example-required/32695#32695)
                signature: Buffer.from(data.txOuts[value.vout].pkScript.data, 'hex'),
                sequence: 4294967294
              })

              transaction.txInCount = transaction.txIns.length

              resolve(value)
            })
        })
      })

      if (value) {
        total += value.value
      }
    }

    await new Promise(function (resolve, reject) {
      unspentOuputsIterator.end(function (err) {
        if (err) { reject(err) }

        resolve()
      })
    })

    console.log(transaction)

    // This need to be improved !
    let test = bs58check.decode(to).slice(1)
    let pkScript = Buffer.from('76a914'+ test.toString('hex') + '88ac', 'hex')

    transaction.txOuts[0] = {
      value: amount,
      pkScriptSize: pkScript.length,
      pkScript
    }

    // TODO: Changed address should be pick from database.... and not hardcoded
    test = bs58check.decode(changeAddress).slice(1)
    pkScript = Buffer.from('76a914'+ test.toString('hex') + '88ac', 'hex')

    if (total > amount) {
      transaction.txOuts[1] = {
        value: total - amount,
        pkScriptSize: pkScript.length,
        pkScript
      }
    }

    transaction.txOutCount = transaction.txOuts.length

    ////////////////////////////////////////////////////////////////

    console.log("Tx in counts : ",transaction.txInCount)

    for (let txInIndex = 0; txInIndex < transaction.txInCount; txInIndex++) {
      const rawUnsignedTransaction =  prepareTransactionToSign(transaction, txInIndex)
      const rawTransactionHash = doubleHash(rawUnsignedTransaction)

      console.log(txInIndex)

      // Which key ? Fuck
      const address = getAddressFromScript(transaction.txIns[txInIndex].signature)
      let index

      // We have pubkey hash
      // If public key compressed it should be 33 bytes (https://bitcoin.stackexchange.com/questions/2013/why-does-the-length-of-a-bitcoin-key-vary#2014)
      // TODO
      if (address.length === 20) {
        debug('PubKey Hash! Looking for index...')
        let value = this.pubkeyHashes.get(address.toString('hex'))
        index = value.index
      }

      const key = this.getPrivateKey(index)

      let pubKeyHash = crypto.createHash('sha256').update(key.publicKey).digest()
      pubKeyHash = new RIPEMD160().update(pubKeyHash).digest()

      const signature = secp256k1.sign(Buffer.from(rawTransactionHash, 'hex'), key.privateKey)

      const signatureDer = secp256k1.signatureExport(signature.signature)

      let signatureCompactSize = CompactSize.fromSize(signatureDer.length+1)
      let publicKeyCompactSize = CompactSize.fromSize(key.publicKey.length)

      let scriptSig = signatureCompactSize.toString('hex') + signatureDer.toString('hex') + '01' + publicKeyCompactSize.toString('hex') + key.publicKey.toString('hex')

      transaction.txIns[txInIndex].signatureSize = CompactSize.fromSize(Buffer.from(scriptSig).length, 'hex')
      transaction.txIns[txInIndex].signature = Buffer.from(scriptSig, 'hex')

      }

    delete transaction.hashCodeType

    let rawTransaction = encodeRawTransaction(transaction)

    return rawTransaction
  }

  createTransaction (inputs, associatedKeys, changePath, outputScriptHex) {

  }

  /*async connectToLedger () {
    const transport = await Transport.create()
    this.app = new AppBtc(transport)
  }

  async getAddressFromLedger () {
    const path = constants.PATH + '0' + '/' + this.addresses.length
    console.log(path)
    const result = await this.app.getWalletPublicKey(path)
    const address = result.bitcoinAddress
    this.addresses.push(address)
    return address
  }

  async createTransactionFromLedger (inputs, associatedKeys, changePath, outputScriptHex) {
    const tx = await this.app.createPaymentTransactionNew(inputs, associatedKeys, changePath, outputScriptHex)
    return tx
  }

  serializeTransactionOutputs (bufferData) {
    return this.app.serializeTransactionOutputs(bufferData)
  }

  splitTransaction (txHex) {
    return this.app.splitTransaction(txHex)
  }*/
}

module.exports = Wallet

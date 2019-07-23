const bip39 = require('bip39')
const bip32 = require('bip32')

const RIPEMD160 = require('ripemd160')
const crypto = require('crypto')

//const Transport = require('@ledgerhq/hw-transport-node-hid').default
//const AppBtc = require('@ledgerhq/hw-app-btc').default
const constants = require('./constants')
const pubkeyToAddress = require('./utils/pubkeyToAddress')

// HD wallet for dogecoin
class Wallet {
  constructor () {
    this.addresses = []
    this.pubkeys = new Map()
    this.pubkeyHashes = new Map()

    // ONLY USE FOR REGTEST AND TESTNET !
    this._mnemonic = "neutral acoustic balance describe access pitch tourist skull recycle nation silent crawl"
    this._seed
    this.app
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

  getPubKey () {
    const path = "m/44'/3'/0'/0/0"
    const root = bip32.fromSeed(this._seed, constants.WALLET)
    const child1 = root.derivePath(path)
    return child1.publicKey
  }

  getAddress () {
    const path = "m/44'/1'/0'/0/0"
    const root = bip32.fromSeed(this._seed, constants.WALLET)
    const child1 = root.derivePath(path)
    return pubkeyToAddress(child1.publicKey)
  }

  generateNewAddress () {
    const index = this.pubkeys.size
    const path = constants.PATH + '0' + '/' + index
    const root = bip32.fromSeed(this._seed, constants.WALLET)
    const child = root.derivePath(path)
    let address = pubkeyToAddress(child.publicKey)
    this.pubkeys.set(child.publicKey.toString('hex'), index)
    const pubKeyHash = this._pubkeyToPubkeyHash(child.publicKey)
    this.pubkeyHashes.set(pubKeyHash.toString('hex'), {publicKey: child.publicKey, index})
    //this.pubkeys.push(child.publicKey.toString('hex'))
    return address
  }

  getPrivateKey (index) {
    const path = constants.PATH + '0' + '/' + index
    const root = bip32.fromSeed(this._seed, constants.WALLET)
    const child = root.derivePath(path)
    return child
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

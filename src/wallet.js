const bip39 = require('bip39')

// HD wallet for dogecoin
class Wallet {
  constructor () {
    this.addresses = []
    this._mnemonic
    this._seed
  }

  _generateMnemonic () {
    this._mnemonic = bip39.generateMnemonic()
    return this._mnemonic
  }

  _getSeed () {
    if (!this._mnemonic) throw new Error('You need to generate a mnemonic first')
    this._seed = bip39.mnemonicToSeed(this._mnemonic)
    return this._seed
  }

  getAddress () {

  }


}

module.exports = Wallet

const Wallet = require('../../src/wallet')

// Create Wallet
const wallet = new Wallet()

console.log(wallet)

// Get mnemonic
console.log(wallet._generateMnemonic())

// Get mnemonic
console.log(wallet._getSeed())

const bs58check = require('bs58check')
const RIPEMD160 = require('ripemd160')
const crypto = require('crypto')

function pubkeyToAddress (pubkey) {
  let pubKeyHash = crypto.createHash('sha256').update(pubkey).digest()

  let temp = new RIPEMD160().update(pubKeyHash).digest()

  // TODO: Testnet parameter
  let networkByte = new Buffer.from('71', 'hex')

  temp = Buffer.concat([networkByte, temp])

  return bs58check.encode(temp)
}

module.exports = pubkeyToAddress

const bs58check = require('bs58check')
const RIPEMD160 = require('ripemd160')
const crypto = require('crypto')

function pubkeyToAddress (pubkey, magicBytes, hash=false, redeemScriptHash=false) {
  let pubKeyHash = pubkey

  if (!hash) {
    pubKeyHash = crypto.createHash('sha256').update(pubkey).digest()
    pubKeyHash = new RIPEMD160().update(pubKeyHash).digest()
  }

  // TODO: Testnet parameter
  let newtorkBytes = new Buffer.from(magicBytes, 'hex')

  if (redeemScriptHash) {
    networkByte = new Buffer.from('c4', 'hex')
  }

  let temp = Buffer.concat([networkByte, pubKeyHash])

  return bs58check.encode(temp)
}



module.exports = pubkeyToAddress

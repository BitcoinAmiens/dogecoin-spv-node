const bs58check = require('bs58check')
const RIPEMD160 = require('ripemd160')
const crypto = require('crypto')

const CompactSize = require('../utils/compactSize')

function pubkeyToPubkeyHash (pubkey) {
  let pubKeyHash = crypto.createHash('sha256').update(pubkey).digest()
  pubKeyHash = new RIPEMD160().update(pubKeyHash).digest()
  return pubKeyHash
}

function pubkeyToAddress (pubkey, networkByte, hash = false, redeemScriptHash = false) {
  let pubKeyHash = pubkey

  if (!hash) {
    pubKeyHash = pubkeyToPubkeyHash(pubkey)
  }

  networkByte = Buffer.from(networkByte, 'hex')

  if (redeemScriptHash) {
    networkByte = Buffer.from('c4', 'hex')
  }

  const temp = Buffer.concat([networkByte, pubKeyHash])

  return bs58check.encode(temp)
}

// Encode the raw transaction so it can be sign (so without signature)
// We need to remove the original script of all the input which are not going to be signed
// https://bitcoin.stackexchange.com/questions/41209/how-to-sign-a-transaction-with-multiple-inputs
function prepareTransactionToSign (transaction, vint) {
  const txInCount = CompactSize.fromSize(transaction.txInCount)
  const txOutCount = CompactSize.fromSize(transaction.txOutCount)
  const buffer = Buffer.alloc(4 + 1 + (32 + 4 + 1 + 25 + 4) + (transaction.txInCount - 1) * (32 + 4 + 1 + 4) + 1 + transaction.txOutCount * (8 + 1 + 25) + 4 + 4)
  let offset = 0

  buffer.writeUInt32LE(transaction.version, offset)
  offset += 4

  txInCount.copy(buffer, offset)
  offset += txInCount.length

  for (let txInIndex = 0; txInIndex < transaction.txInCount; txInIndex++) {
    Buffer.from(transaction.txIns[txInIndex].previousOutput.hash, 'hex').copy(buffer, offset)
    offset += 32

    buffer.writeUInt32LE(transaction.txIns[txInIndex].previousOutput.index, offset)
    offset += 4

    if (txInIndex === vint) {
      const scriptSigSize = CompactSize.fromSize(transaction.txIns[txInIndex].signature.length)
      scriptSigSize.copy(buffer, offset)
      offset += scriptSigSize.length

      transaction.txIns[txInIndex].signature.copy(buffer, offset)
      offset += transaction.txIns[txInIndex].signature.length
    } else {
      const nullBuffer = Buffer.alloc(1)
      nullBuffer.copy(buffer, offset)
      offset += nullBuffer.length
    }

    buffer.writeUInt32LE(transaction.txIns[txInIndex].sequence, offset)
    offset += 4
  }

  txOutCount.copy(buffer, offset)

  offset += txOutCount.length

  for (let txOutIndex = 0; txOutIndex < transaction.txOutCount; txOutIndex++) {
    buffer.writeBigInt64LE(transaction.txOuts[txOutIndex].value, offset)
    offset += 8

    const pkScriptSize = CompactSize.fromSize(transaction.txOuts[txOutIndex].pkScriptSize)

    pkScriptSize.copy(buffer, offset)
    offset += pkScriptSize.length

    transaction.txOuts[txOutIndex].pkScript.copy(buffer, offset)
    offset += transaction.txOuts[txOutIndex].pkScriptSize
  }

  buffer.writeUInt32LE(transaction.locktime, offset)
  offset += 4

  buffer.writeUInt32LE(transaction.hashCodeType, offset)

  return buffer
}

function indexToBufferInt32LE (index) {
  const indexBuffer = Buffer.allocUnsafe(4)
  indexBuffer.writeInt32LE(index, 0)

  return indexBuffer
}

function serializePayToPubkeyHashScript (address) {
  address = bs58check.decode(address).slice(1)
  return Buffer.from('76a914' + address.toString('hex') + '88ac', 'hex')
}

module.exports = {
  pubkeyToPubkeyHash,
  pubkeyToAddress,
  prepareTransactionToSign,
  indexToBufferInt32LE,
  serializePayToPubkeyHashScript
}

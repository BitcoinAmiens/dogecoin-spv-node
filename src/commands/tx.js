const CompactSize = require('../utils/compactSize')
const { readU64, write64 } = require('../utils/write64')
const doubleHash = require('../utils/doubleHash')

// TODO : Same code than for block !!!!
function decodeTxMessage (payload) {
  const tx = {}
  let offset = 0

  tx.id = doubleHash(payload).toString('hex')

  tx.version = payload.readUInt32LE(offset)
  offset += 4

  let compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  tx.txInCount = compactSize.size

  tx.txIns = []
  for (let i = 0; i < tx.txInCount; i++) {
    const txIn = {}

    txIn.previousOutput = {}

    txIn.previousOutput.hash = payload.slice(offset, offset + 32).toString('hex')
    offset += 32

    txIn.previousOutput.index = payload.slice(offset, offset + 4).toString('hex')
    offset += 4

    if (txIn.previousOutput.hash === '0000000000000000000000000000000000000000000000000000000000000000') {
      // Coinbase txIn !!!!!!!!
      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      txIn.script = payload.slice(offset, offset + compactSize.size).toString('hex')
      offset += compactSize.size

      txIn.sequence = payload.readUInt32LE(offset)
      offset += 4
    } else {
      // NOT Coinbase txIn !!!!!!!!
      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      txIn.signature = payload.slice(offset, offset + compactSize.size).toString('hex')
      offset += compactSize.size

      txIn.sequence = payload.readUInt32LE(offset)
      offset += 4
    }

    tx.txIns.push(txIn)
  }

  compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset
  tx.txOutCount = compactSize.size

  tx.txOuts = []
  for (let j = 0; j < tx.txOutCount; j++) {
    const txOut = {}

    txOut.value = readU64(payload, offset)
    offset += 8

    compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset

    txOut.pkScriptSize = compactSize.size

    txOut.pkScript = payload.slice(offset, offset + txOut.pkScriptSize)
    offset += compactSize.size

    tx.txOuts.push(txOut)
  }

  tx.locktime = payload.readUInt32LE(offset)
  offset += 4

  tx.size = offset

  return tx
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
    write64(buffer, transaction.txOuts[txOutIndex].value, offset)
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

function encodeRawTransaction (transaction) {
  const txInCount = CompactSize.fromSize(transaction.txInCount)
  const txOutCount = CompactSize.fromSize(transaction.txOutCount)
  let bufferSize = 4 + txInCount.length

  for (let txIn = 0; txIn < transaction.txInCount; txIn++) {
    bufferSize += 32 + 4 + transaction.txIns[txIn].signatureSize.length + transaction.txIns[txIn].signature.length + 4
  }

  bufferSize += txOutCount.length

  for (let txOut = 0; txOut < transaction.txOutCount; txOut++) {
    bufferSize += 8 + CompactSize.fromSize(transaction.txOuts[txOut].pkScriptSize).length + transaction.txOuts[txOut].pkScriptSize
  }

  bufferSize += 4

  const buffer = Buffer.alloc(bufferSize)
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

    const scriptSigSize = CompactSize.fromSize(transaction.txIns[txInIndex].signature.length)
    scriptSigSize.copy(buffer, offset)
    offset += scriptSigSize.length

    transaction.txIns[txInIndex].signature.copy(buffer, offset)
    offset += transaction.txIns[txInIndex].signature.length

    buffer.writeUInt32LE(transaction.txIns[txInIndex].sequence, offset)
    offset += 4
  }

  txOutCount.copy(buffer, offset)

  offset += txOutCount.length

  for (let txOutIndex = 0; txOutIndex < transaction.txOutCount; txOutIndex++) {
    write64(buffer, transaction.txOuts[txOutIndex].value, offset)
    offset += 8

    const pkScriptSize = CompactSize.fromSize(transaction.txOuts[txOutIndex].pkScriptSize)

    pkScriptSize.copy(buffer, offset)
    offset += pkScriptSize.length

    transaction.txOuts[txOutIndex].pkScript.copy(buffer, offset)
    offset += transaction.txOuts[txOutIndex].pkScriptSize
  }

  buffer.writeUInt32LE(transaction.locktime, offset)
  offset += 4

  return buffer
}

module.exports = { decodeTxMessage, prepareTransactionToSign, encodeRawTransaction }

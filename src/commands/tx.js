const CompactSize = require('../utils/compactSize')
const { readU64 } = require('../utils/write64')
var bs58check = require('bs58check')

// TODO : Same code than for block !!!!
function decodeTxMessage (payload) {
  var tx = {}
  let offset = 0

  tx.version = payload.readUInt32LE(offset)
  offset += 4

  var compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  tx.txInCount = compactSize.size

  tx.txIns = []
  for (var i = 0; i < tx.txInCount; i++) {
    txIn = {}

    txIn.previousOutput = {}

    txIn.previousOutput.hash = payload.slice(offset, offset + 32).toString('hex')
    offset += 32

    txIn.previousOutput.index = payload.slice(offset, offset + 4).toString('hex')
    offset += 4

    if (txIn.previousOutput.hash === '0000000000000000000000000000000000000000000000000000000000000000') {

      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      txIn.script = payload.slice(offset, offset + compactSize.size).toString('hex')
      offset += compactSize.size

      txIn.sequence = payload.readUInt32BE(offset)
      offset += 4
    }

    tx.txIns.push(txIn)
  }

  compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  tx.txOutCount = compactSize.size

  tx.txOuts = []
  for (var i = 0; i < tx.txOutCount; i++) {
    txOut = {}

    txOut.value = readU64(payload, offset)
    offset += 8

    compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset

    txOut.pkScriptSize = compactSize.size

    txOut.pkScript = payload.slice(offset, offset + txOut.pkScriptSize)
    offset += compactSize.size

    console.log(bs58check.encode(txOut.pkScript.slice(3, txOut.pkScript.length )))

    tx.txOuts.push(txOut)
  }

  tx.locktime = payload.readUInt32LE(offset)
  offset += 4

  return tx
}

module.exports = { decodeTxMessage }

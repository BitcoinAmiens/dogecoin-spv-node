const CompactSize = require('../utils/compactSize')
const { readU64 } = require('../utils/write64')

function decodeBlockMessage (payload) {
  var block = {}
  let offset = 0

  block.blockHeader = payload.slice(offset, offset + 80).toString('hex')
  offset += 80

  var compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  block.txnCount = compactSize.size

  block.txn = []
  for (var i = 0; i < block.txnCount; i++) {
    tx = {}
    tx.version = payload.readUInt32LE(offset)
    offset += 4

    var compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset

    tx.txInCount = compactSize.size

    var txInArray = []
    for (var j = 0; j < tx.txInCount; j++) {

      var txIn = {}

      // TODO: Need to properly get the outpoint
      txIn.previousOutput = payload.slice(offset, offset + 36).toString('hex')
      offset += 36

      var compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset


      txIn.signature = payload.slice(offset, offset + compactSize.size)
      offset += compactSize.size

      txIn.sequence = payload.slice(offset, offset + 4)
      offset += 4

      txInArray.push(txIn)
    }

    tx.txInArray = txInArray

    var compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset

    tx.txOutCount = compactSize.size

    var txOutArray = []
    for (var j = 0; j < tx.txOutCount; j++) {

      var txOut = {}

      txOut.value = readU64(payload, offset)
      offset += 8

      var compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      txOut.pkScriptSize = compactSize.size
      txOut.pkScript = payload.slice(offset, offset + txOut.pkScriptSize)

      txOutArray.push(txOut)
    }

    tx.txOutArray = txOutArray

    block.txn[i] = tx
  }

  block.lockTime = payload.readUInt32LE(offset)

  return block
}

module.exports = { decodeBlockMessage }

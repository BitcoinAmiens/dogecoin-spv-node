const CompactSize = require('../utils/compactSize')
const { readU64 } = require('../utils/write64')
var { decodeTxMessage } = require('./tx')

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
    let tx = decodeTxMessage(payload.slice(offset, payload.length))
    offset += tx.size

    block.txn[i] = tx
  }

  return block
}

module.exports = { decodeBlockMessage }

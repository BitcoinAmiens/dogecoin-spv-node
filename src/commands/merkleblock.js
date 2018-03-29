const CompactSize = require('../utils/compactSize')

function decodeMerkleblockMessage (payload) {
  var merkleblock = {}
  let offset = 0

  merkleblock.blockHeader = payload.slice(offset, offset + 80).toString('hex')
  offset += 80

  merkleblock.transactionCount = payload.readUInt32LE(offset)
  offset += 4

  var compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  merkleblock.hashCount = compactSize.size

  merkleblock.hashes = []
  for (var i = 0; i < merkleblock.hashCount; i++) {
    var hash = payload.slice(offset, offset + 32).toString('hex')
    offset += 32

    merkleblock.hashes.push(hash)
  }

  compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  merkleblock.flagBytes = compactSize.size
  merkleblock.flag = payload.slice(offset, offset + merkleblock.flagBytes).toString('hex')

  return merkleblock
}

module.exports = { decodeMerkleblockMessage }

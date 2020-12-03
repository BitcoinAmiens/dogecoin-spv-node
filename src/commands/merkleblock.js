const CompactSize = require('../utils/compactSize')

function decodeMerkleblockMessage (payload) {
  const merkleblock = {}
  let offset = 0
  let compactSize

  if (payload.slice(1, 4).toString('hex') === '016200') {
    // Merged mining block header

    // Normal header
    offset += 80

    // Version parent block
    offset += 4

    compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset

    // tx_in
    for (let j = 0; j < compactSize.size; j++) {
      offset += 36

      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset + compactSize.size + 4
    }

    // tx_out
    compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset

    for (let j = 0; j < compactSize.size; j++) {
      offset += 8

      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset + compactSize.size
    }

    // locktime + hash
    offset += 4 + 32

    // Coinbase Branch : Merkle branch
    compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset + compactSize.size * 32

    // branch side mask
    offset += 4

    // Blockchain Branch : Merkle branch
    compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset + compactSize.size * 32

    // branch side mask
    offset += 4

    // parentblock header
    offset += 80

    merkleblock.blockHeader = payload.slice(0, offset)
  } else {
    merkleblock.blockHeader = payload.slice(offset, offset + 80)
    offset += 80
  }

  merkleblock.transactionCount = payload.readUInt32LE(offset)
  offset += 4

  compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  merkleblock.hashCount = compactSize.size

  merkleblock.hashes = []
  for (let i = 0; i < merkleblock.hashCount; i++) {
    const hash = payload.slice(offset, offset + 32)
    offset += 32

    merkleblock.hashes.push(hash)
  }

  compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  merkleblock.flagBytes = compactSize.size
  merkleblock.flags = payload.slice(offset, offset + merkleblock.flagBytes)

  return merkleblock
}

module.exports = { decodeMerkleblockMessage }

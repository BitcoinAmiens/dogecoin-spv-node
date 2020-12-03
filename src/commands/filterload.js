const CompactSize = require('../utils/compactSize')

function encodeFilterLoad (filter) {
  const compactSizeBuffer = CompactSize.fromSize(filter.vData.length)
  const buffer = Buffer.alloc(9 + compactSizeBuffer.length + filter.vData.length)
  let offset = 0

  compactSizeBuffer.copy(buffer, offset)
  offset += compactSizeBuffer.length

  for (let i = 0; i < filter.vData.length; i++) {
    buffer.writeUInt8(filter.vData[i], offset)
    offset += 1
  }

  buffer.writeInt32LE(filter.nHashFuncs, offset)
  offset += 4

  buffer.writeInt32LE(filter.nTweak, offset)
  offset += 4

  buffer.writeUInt8(filter.nFlags, offset)

  return buffer
}

module.exports = { encodeFilterLoad }

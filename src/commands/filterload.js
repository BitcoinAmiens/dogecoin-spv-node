var CompactSize = require('../utils/compactSize')

function encodeFilterLoad (filter) {
  var compactSizeBuffer = CompactSize.fromSize(filter.vData.length)
  var buffer = Buffer.alloc(9 + compactSizeBuffer.length + filter.vData.length)
  var offset = 0

  compactSizeBuffer.copy(buffer, offset)
  offset += compactSizeBuffer.length

  for (var i = 0; i < filter.vData.length; i++) {
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

var CompactSize = require('../utils/compactSize')

function encodeFilterAdd (filterElement) {

  if (filterElement.length > 520) throw new Error('Element is too big. Should be less than 520 bytes.')

  var compactSizeBuffer = CompactSize.fromSize(filterElement.length)
  var buffer = Buffer.alloc(compactSizeBuffer.length + filterElement.length)
  var offset = 0

  compactSizeBuffer.copy(buffer, offset)
  offset += compactSizeBuffer.length

  filterElement.copy(buffer, offset)

  return buffer
}

module.exports = { encodeFilterAdd }

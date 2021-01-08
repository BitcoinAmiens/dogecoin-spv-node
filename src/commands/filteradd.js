const CompactSize = require('../utils/compactSize')

function encodeFilterAdd (filterElement) {
  if (filterElement.length > 520) throw new Error('Element is too big. Should be less than 520 bytes.')

  const compactSizeBuffer = CompactSize.fromSize(filterElement.length)
  const buffer = Buffer.alloc(compactSizeBuffer.length + filterElement.length)
  let offset = 0

  compactSizeBuffer.copy(buffer, offset)
  offset += compactSizeBuffer.length

  filterElement.copy(buffer, offset)

  return buffer
}

module.exports = { encodeFilterAdd }

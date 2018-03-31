const CompactSize = require('../utils/compactSize')
const {PROTOCOL_VERSION} = require('../constants')

// https://bitcoin.org/en/developer-reference#getblocks
// getHeaders is similar to getBlock
function encodeGetblocksMessage (blockHash) {
  // For the sake of the demo
  // But those need to be parameters
  var hashCount = 1

  const buffer = Buffer.alloc(4 + 32 + hashCount + hashCount * 32)
  let offset = 0

  // Encode version
  offset = buffer.writeInt32LE(PROTOCOL_VERSION, offset, true)

  // How many hashes we send
  var compactSizeBuffer = CompactSize.fromSize(hashCount)
  compactSizeBuffer.copy(buffer, offset)
  offset += compactSizeBuffer.length

  // We actually send one here but should be a loop
  const blockHashBuffer = Buffer.from(blockHash, 'hex')
  blockHashBuffer.copy(buffer, offset)
  offset += blockHashBuffer.length

  // Stop hash is full of zeroes which means send me MAX_LIMIT
  const stopHashBuffer = Buffer.alloc(32)
  stopHashBuffer.copy(buffer, offset)

  return buffer
}

module.exports = { encodeGetblocksMessage }

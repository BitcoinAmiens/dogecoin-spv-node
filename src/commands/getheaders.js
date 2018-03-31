const CompactSize = require('../utils/compactSize')
const { PROTOCOL_VERSION } = require('../constants')

// https://bitcoin.org/en/developer-reference#getblocks
// getHeaders is similar to getBlock
function encodeGetheadersMessage (blockHash) {
  // For the sake of the demo
  // But those need to be parameters
  var hashCount = 1

  // Testnet
  // var blockHash = 'bb0a78264637406b6360aad926284d544d7049f45189db5664f3c4d07350559e'

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

module.exports = { encodeGetheadersMessage }

const doubleHash = require('./doubleHash')

function decodeHeader (payload) {
  let offset = 0
  const header = {}

  header.version = payload.readInt32LE(offset)
  offset += 4

  header.previousHash = payload.slice(offset, offset + 32).toString('hex')
  offset += 32

  header.merklerootHash = payload.slice(offset, offset + 32).toString('hex')
  offset += 32

  header.time = payload.readUInt32LE(offset)
  offset += 4

  header.nBits = payload.slice(offset, offset + 4).toString('hex')
  offset += 4

  header.nonce = payload.readUInt32LE(offset)
  offset += 4

  header.hash = doubleHash(payload.slice(offset - 80, offset)).toString('hex')

  return header
}

module.exports = decodeHeader

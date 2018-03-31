const CompactSize = require('../utils/compactSize')

function decodeHeadersMessage (payload) {
  var headers = {}
  let offset = 0

  var compactSize = CompactSize.fromBuffer(payload, offset)

  headers.count = compactSize.size
  offset = compactSize.offset

  headers.headers = []

  for (var i = 0; i < headers.count; i++) {
    var header = {}

    header.version = payload.readInt32LE(offset)
    offset += 4

    var previousHash = payload.slice(offset, offset + 32)

    // console.log(previousHash.toString('hex'))

    header.previousHash = payload.slice(offset, offset + 32).toString('hex')
    offset += 32

    var merklerootHash = payload.slice(offset, offset + 32)

    var merklerootHashHex = ''
    for ( var j = 31; j >=0; j-- ) {
      merklerootHashHex += merklerootHash.slice(j, j+1).toString('hex')
    }
    header.merklerootHash = merklerootHashHex
    offset += 32

    header.time = payload.readUInt32LE(offset)
    offset += 4

    header.nBits = payload.readUInt32LE(offset)
    offset += 4

    header.nonce = payload.readUInt32LE(offset)
    offset += 4

    // Should be always 0x00
    // https://bitcoin.org/en/developer-reference#headers
    header.transactionCount = payload.readUInt8(offset)
    offset += 1

    headers.headers.push(header)
  }

  return headers
}

module.exports = { decodeHeadersMessage }

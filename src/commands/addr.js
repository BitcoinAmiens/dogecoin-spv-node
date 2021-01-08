const CompactSize = require('../utils/compactSize')
const decodeAddress = require('../utils/decodeAddress')

function decodeAddrMessage (data) {
  const addr = {}
  let offset = 0

  const compactSize = CompactSize.fromBuffer(data, offset)
  offset += compactSize.offset
  addr.count = compactSize.size

  addr.addresses = []
  for (let i = 0; i < addr.count; i++) {
    const time = data.readUInt32LE(offset)
    offset += 4

    const address = decodeAddress(data.slice(offset, offset + 26))
    offset += 26

    address.time = time
    addr.addresses.push(address)
  }
  return addr
}

module.exports = { decodeAddrMessage }

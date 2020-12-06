const binet = require('exp-net')

function decodeAddress (data) {
  const address = {}
  let offset = 0

  address.services = data.readUInt32LE(offset)
  // The last 4 bytes are not used
  offset += 8

  const host = data.slice(offset, offset + 16)
  address.host = binet.toString(host)
  offset += 16

  address.port = data.readUInt16BE(offset)
  offset += 2

  return address
}

module.exports = decodeAddress

const { write64, readI64, readU64 } = require('../utils/write64')
const CompactSize = require('../utils/compactSize')
const decodeAddress = require('../utils/decodeAddress')
const PROTOCOL_VERSION = require('../constants').PROTOCOL_VERSION

const NODE_PORT = 0

function getVersion (ip, port) {
  const version = {
    version: PROTOCOL_VERSION,
    services: 4,
    time: Date.now(),
    remote: {
      services: 1,
      host: ip,
      port: port
    },
    local: {
      services: 4,
      host: '127.0.0.1',
      port: NODE_PORT
    },
    agent: 0,
    nonce: 0,
    height: 0,
    relay: false
  }

  return version
}

function encodeVersionMessage (payload) {
  const buffer = Buffer.alloc(86)
  let offset = 0

  offset = buffer.writeInt32LE(payload.version, offset, true)
  offset = write64(buffer, payload.services, offset, false)
  offset = write64(buffer, payload.time, offset, false)
  offset = write64(buffer, payload.remote.services, offset, false)
  offset += 10
  buffer[offset++] = 0xff
  buffer[offset++] = 0xff
  let parts = payload.remote.host.split('.')
  for (let ch of parts) {
    ch = parseInt(ch, 10)
    offset = buffer.writeUInt8(ch, offset)
  }
  offset = buffer.writeUInt16BE(payload.remote.port, offset, true)
  offset = write64(buffer, payload.local.services, offset, false)
  offset += 10
  buffer[offset++] = 0xff
  buffer[offset++] = 0xff
  parts = payload.local.host.split('.')
  for (let ch of parts) {
    ch = parseInt(ch, 10)
    offset = buffer.writeUInt8(ch, offset)
  }
  offset = buffer.writeUInt16BE(payload.local.port, offset, true)
  offset = write64(buffer, payload.nonce, offset, false)
  offset = buffer.writeUInt8(0, offset)
  offset = buffer.writeInt32LE(payload.height, offset)
  offset = buffer.writeUInt8(payload.relay, offset)

  return buffer
}

function decodeVersionMessage (data) {
  const version = {}
  let offset = 0

  version.version = data.readUInt32LE(offset)
  offset += 4

  version.services = data.readUInt32LE(offset)
  // The last 4 bytes are not used
  offset += 8

  const timestamp = readI64(data, offset)
  version.timestamp = new Date(timestamp)
  offset += 8

  version.local = decodeAddress(data.slice(offset, offset + 26))
  offset += 26

  version.remote = decodeAddress(data.slice(offset, offset + 26))
  offset += 26

  const nonce = readU64(data, offset)
  version.nonce = nonce
  offset += 8

  const compactSize = CompactSize.fromBuffer(data, offset)

  offset += compactSize.offset
  const userAgentSize = compactSize.size

  const userAgent = data.slice(offset, offset + userAgentSize)

  version.agent = userAgent.toString()
  offset += userAgentSize

  version.height = data.readInt32LE(offset)
  offset += 4

  version.relay = data.readUInt8(offset)

  return version
}

module.exports = { encodeVersionMessage, decodeVersionMessage, getVersion }

const CompactSize = require('../utils/compactSize')
const decodeAddress = require('../utils/decodeAddress')
const PROTOCOL_VERSION = require('../constants').PROTOCOL_VERSION

const NODE_PORT = 0

function getVersion (ip, port) {
  const version = {
    version: PROTOCOL_VERSION,
    services: 4n,
    time: BigInt(Date.now()),
    remote: {
      services: 1n,
      host: ip,
      port: port
    },
    local: {
      services: 4n,
      host: '127.0.0.1',
      port: NODE_PORT
    },
    agent: 0,
    nonce: 0n,
    height: 0,
    relay: false
  }

  return version
}

function encodeVersionMessage (payload) {
  const buffer = Buffer.alloc(86)
  let offset = 0

  offset = buffer.writeInt32LE(payload.version, offset, true)
  offset = buffer.writeBigInt64LE(payload.services, offset)
  offset = buffer.writeBigInt64LE(payload.time, offset)
  offset = buffer.writeBigInt64LE(payload.remote.services, offset)

  offset += 10
  buffer[offset++] = 0xff
  buffer[offset++] = 0xff
  let parts = payload.remote.host.split('.')
  for (let ch of parts) {
    ch = parseInt(ch, 10)
    offset = buffer.writeUInt8(ch, offset)
  }
  offset = buffer.writeUInt16BE(payload.remote.port, offset, true)
  offset = buffer.writeBigInt64LE(payload.local.services, offset)
  offset += 10
  buffer[offset++] = 0xff
  buffer[offset++] = 0xff
  parts = payload.local.host.split('.')
  for (let ch of parts) {
    ch = parseInt(ch, 10)
    offset = buffer.writeUInt8(ch, offset)
  }
  offset = buffer.writeUInt16BE(payload.local.port, offset, true)
  offset = buffer.writeBigInt64LE(payload.nonce, offset)
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

  version.services = BigInt(data.readUInt32LE(offset))
  // The last 4 bytes are not used
  offset += 8

  const timestamp = data.readBigInt64LE(offset)
  version.timestamp = new Date(Number(timestamp))
  offset += 8

  version.local = decodeAddress(data.slice(offset, offset + 26))
  offset += 26

  version.remote = decodeAddress(data.slice(offset, offset + 26))
  offset += 26

  const nonce = data.readBigUInt64LE(offset)
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

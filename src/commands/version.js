const {write64, readI64, readU64} = require('../utils/write64')
const binet = require('exp-net')
const CompactSize = require('../utils/compactSize')

const NODE_IP = '163.172.182.246'
const NODE_PORT = 44556
const PROTOCOL_VERSION = 70004

function versionMessage () {
  const buffer = new Buffer.alloc(86)
  let offset = 0

  var payload = {
    version: PROTOCOL_VERSION,
    services: 4,
    time: Date.now(),
    remote : {
      services: 1,
      host: NODE_IP,
      port: NODE_PORT
    },
    local: {
      services: 4,
      host: '127.0.0.1',
      port: NODE_PORT
    },
    agent: 0,
    nonce: 0,
    height: 0,
    relay: true
  }

  offset = buffer.writeInt32LE(payload.version, offset, true)
  offset = write64(buffer, payload.services, offset, false)
  offset = write64(buffer, payload.time, offset, false)
  offset = write64(buffer, payload.remote.services, offset, false)
  offset += 10
  buffer[offset++] = 0xff
  buffer[offset++] = 0xff
  var parts = payload.remote.host.split('.')
  for (var ch of parts) {
    ch = parseInt(ch, 10)
    offset = buffer.writeUInt8(ch, offset)
  }
  offset = buffer.writeUInt16BE(payload.remote.port, offset, true)
  offset = write64(buffer, payload.local.services, offset, false)
  offset += 10
  buffer[offset++] = 0xff
  buffer[offset++] = 0xff
  parts = payload.local.host.split('.')
  for (ch of parts) {
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
  var version = {}
  let offset = 0

  version.version = data.readUInt32LE(offset)

  offset += 4

  version.services = data.readUInt32LE(offset)
  // The last 4 bytes are not used
  offset += 8

  var timestamp = readI64(data, offset)

  version.timestamp = new Date(timestamp)

  offset += 8

  version.remote = {}

  version.remote.services = data.readUInt32LE(offset)
  // The last 4 bytes are not used
  offset += 8

  var host = data.slice(offset, offset + 16)
  version.remote.host = binet.toString(host)
  offset += 16

  version.remote.port = data.readUInt16BE(offset)
  offset += 2

  version.local = {}

  version.local.services = data.readUInt32LE(offset)
  // The last 4 bytes are not used
  offset += 8

  var host = data.slice(offset, offset + 16)
  version.local.host = binet.toString(host)
  offset += 16

  version.local.port = data.readUInt16BE(offset)
  offset += 2

  var nonce = readU64(data, offset)
  version.nonce = nonce
  offset += 8

  var compactSize = CompactSize.fromBuffer(data, offset)

  offset += compactSize.offset
  var userAgentSize = compactSize.size

  var userAgent = data.slice(offset, offset + userAgentSize)

  version.agent = userAgent.toString()
  offset += userAgentSize

  version.height = data.readInt32LE(offset)
  offset += 4

  version.relay = data.readUInt8(offset)

  return version
}

module.exports = { versionMessage, decodeVersionMessage }

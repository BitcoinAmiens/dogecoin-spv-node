var crypto = require('crypto')
const MAGIC_BYTES = require('../constants').MAGIC_BYTES

function preparePacket (cmd, payload) {
  const msg = Buffer.alloc(24 + payload.length)
  let checksum

  // Magic value
  // testnet : 0xdcb7c1fc
  msg.writeUInt32LE(MAGIC_BYTES, 0, true)

  // Command
  msg.write(cmd, 4, 'ascii')

  for (let i = 4 + cmd.length; i < 16; i++) {
    msg[i] = 0
  }

  // Payload length
  msg.writeUInt32LE(payload.length, 16, true)

  // checksum = sha256(sha256(payload))
  checksum = crypto.createHash('sha256').update(payload).digest()
  checksum = crypto.createHash('sha256').update(checksum).digest()

  // Checksum only the 4 first digits
  checksum.copy(msg, 20, 0, 4)

  // copy payload
  payload.copy(msg, 24)

  return msg
}

function decodePacket (packet) {
  let packets = []
  let offset = 0

  console.log(packet)

  // Be sure we are on the same network and same protocol
  if (packet.readUInt32LE(offset) !== MAGIC_BYTES) {
    // If not send "reject" message ?
    return false
  }
  // Update the offset to the next payload parts
  offset += 4

  // Get the command
  var cmd = packet.toString('ascii', offset, 12).replace(/\0/g, '')

  offset += 12

  var length = packet.readUInt32LE(offset)

  offset += 4

  var checksum = packet.slice(offset, offset + 4)

  offset += 4

  var payload = packet.slice(offset, offset + length)

  var checksumToVerify = crypto.createHash('sha256').update(payload).digest()
  checksumToVerify = crypto.createHash('sha256').update(checksumToVerify).digest()

  if (!Buffer.compare(checksum, checksumToVerify.slice(0,4))) {
    return {cmd, payload, length}
  }

  return false
}

module.exports =  { preparePacket, decodePacket }

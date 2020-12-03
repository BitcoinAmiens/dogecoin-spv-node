const crypto = require('crypto')

function preparePacket (cmd, payload, magicBytes) {
  const msg = Buffer.alloc(24 + payload.length)
  let checksum

  // Magic Bytes
  msg.writeUInt32LE(magicBytes, 0, true)

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

function decodePacket (packet, magicBytesExpected) {
  let offset = 0

  if (packet.length < 4) {
    // console.log('Incorrect packet ' + packet.toString('hex'))
    return false
  }

  const magicBytes = packet.readUInt32LE(offset)

  // Be sure we are on the same network and same protocol
  // Do we need to do this verification here tho ?
  // TODO: move the verification outside of this function
  if (magicBytes !== magicBytesExpected) {
    // If not send "reject" message ?
    return false
  }
  // Update the offset to the next payload parts
  offset += 4

  // check size
  if (packet.length < offset + 12) {
    return false
  }

  // Get the command
  const cmd = packet.toString('ascii', offset, offset + 12).replace(/\0/g, '')
  offset += 12

  // check size
  if (packet.length < offset + 4) {
    return false
  }
  const length = packet.readUInt32LE(offset)
  offset += 4

  // check size
  if (packet.length < offset + 4) {
    return false
  }
  const checksum = packet.slice(offset, offset + 4)
  offset += 4

  // check size
  if (packet.length < offset + length) {
    return false
  }
  const payload = packet.slice(offset, offset + length)

  if (payload.length !== length) {
    return false
  }

  let checksumToVerify = crypto.createHash('sha256').update(payload).digest()
  checksumToVerify = crypto.createHash('sha256').update(checksumToVerify).digest()

  if (!Buffer.compare(checksum, checksumToVerify.slice(0, 4))) {
    return { cmd, payload, length }
  }

  return false
}

module.exports = { preparePacket, decodePacket }

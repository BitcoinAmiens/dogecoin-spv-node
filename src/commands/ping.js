function encodePingMessage (nonce) {
  const buffer = Buffer.alloc(8)

  buffer.writeBigUInt64LE(nonce)

  return buffer
}

module.exports = { encodePingMessage }

const { write64 } = require('../utils/write64')

function encodePingMessage (nonce) {
  const buffer = Buffer.alloc(8)

  write64(buffer, nonce, 0, false)

  return buffer
}

module.exports = { encodePingMessage }

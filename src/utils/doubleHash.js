const crypto = require('crypto')

function doubleHash (data) {
  let hash = crypto.createHash('sha256').update(data).digest()
  hash = crypto.createHash('sha256').update(hash).digest()

  return hash
}

module.exports = doubleHash

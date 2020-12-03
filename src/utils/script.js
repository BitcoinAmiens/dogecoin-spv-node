
function getAddressFromScript (script) {
  // We should have a switch here
  const firstByte = script.slice(0, 1).toString('hex')

  switch (firstByte) {
    case '21':
      // public key
      return script.slice(1, 34)
    case '76':
    // public key hash
      return script.slice(3, 23)
    case 'a9':
      // redem script hash
      return script.slice(2, 22)
    default:
      return Buffer.alloc()
  }
}

module.exports = { getAddressFromScript }

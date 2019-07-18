

function getAddressFromScript (script) {
  // We should have a switch here
  let firstByte = script.slice(0, 1).toString('hex')
  let address

  switch (firstByte) {
    case '21':
      let pubkey = script.slice(1, 34)
      //address = pubkeyToAddress(pubkey)
      return pubkey
    case '76':
      let pubkeyHash = script.slice(3, 23)
      //address = pubkeyToAddress(pubkeyHash, true)
      return pubkeyHash

    // P2SH !!!newTx.txOuts
    case 'a9':
      let redeemScriptHash = script.slice(2, 22)
      //address = pubkeyToAddress(redeemScriptHash, true, true)
      return redeemScriptHash

    default:
      console.log('unknown script')
      return new Buffer()
  }

}

module.exports = { getAddressFromScript }

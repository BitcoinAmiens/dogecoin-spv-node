const axios = require('axios')
const debug = require('debug')('paymentchannel')

/*
    TODO: should be a class PaymentChannel
    Properties:
    - url to the payment channel service
    - version
*/

async function getPublicKey (url) {
  debug('calling /api/v1/pubkey/new')
  const result = await axios.get(`${url}/api/v1/pubkey/new`)

  // TODO: handle error

  return result.data.pubkey
}

async function announce (url, redeemScript) {
  debug('calling /api/v1/announce')
  const result = await axios.post(`${url}/api/v1/announce`, { redeemScript })

  // TODO: handle error

  return result.data
}

async function payment (url, transaction, redeemScript, signature, ref) {
  debug('calling /api/v1/payment')
  const result = await axios.post(`${url}/api/v1/payment`, { transaction, redeemScript, signature, ref })

  // TODO: handle error

  return result.data
}

module.exports = {
  getPublicKey,
  announce,
  payment
}

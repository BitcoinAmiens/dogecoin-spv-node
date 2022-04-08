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

async function announce (url, redeemScript, transaction, signature) {
  debug('calling /api/v1/announce')

  if (typeof redeemScript !== 'string') {
    throw new Error('`redeemScript` argument should be a string.')
  }

  if (typeof transaction !== 'string') {
    throw new Error('`transaction` argument should be a string.')
  }

  if (typeof signature !== 'string') {
    throw new Error('`signature` argument should be a string.')
  }

  const result = await axios.post(`${url}/api/v1/announce`, { redeemScript, transaction, signature })

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

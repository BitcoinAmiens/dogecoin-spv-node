const axios = require('axios')
const debug = require('debug')('paymentchannel')
const bitcoinjs = require('bitcoinjs-lib')

/*
    TODO: should be a class PaymentChannel
    Properties:
    - url to the payment channel service
    - version
*/

async function getPublicKey (url) {
    const result = await axios.get(`${url}/api/v1/pubkey/new`)

    //TODO: handle error

    return result.data.pubkey
}

async function announce (url, redeemScript) {
    const result = await axios.post(`${url}/api/v1/announce`, { redeemScript })

    //TODO: handle error

    return result.data
}

async function payment (url, transaction, signature, ref) {
    const result = await axios.post(`${url}/api/v1/payment`, { transaction, signature, ref })

    //TODO: handle error

    return result.data
}

module.exports = {
    getPublicKey,
    announce,
    payment
}
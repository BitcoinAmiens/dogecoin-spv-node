const test = require('ava')
const { pubkeyToAddress } = require('../../src/wallet/utils')

const TESTNET_NETWORK_BYTE = '71'

/*
  pubkeyToAddress.js
*/
test('successfully convert public key to address', t => {
    const pubkey = Buffer.from('04ffd03de44a6e11b9917f3a29f9443283d9871c9d743ef30d5eddcd37094b64d1b3d8090496b53256786bf5c82932ec23c3b74d9f05a6f95a8b5529352656664b', 'hex')
    const result = pubkeyToAddress(pubkey, TESTNET_NETWORK_BYTE, false)
  
    t.is(result, 'noBEfr9wTGgs94CdGVXGYwsQghEwBsXw4K')
  })
  
  test('successfully convert public key hash to address', t => {
    const pubKeyHash = Buffer.from('0817fa995b26604c5ed08c160f0bc2141567ce72', 'hex')
    const result = pubkeyToAddress(pubKeyHash, TESTNET_NETWORK_BYTE, true)
  
    t.is(result, 'nUvxPtXWKwatQim1dDbjBc6vSSWKwDvYHn')
  })
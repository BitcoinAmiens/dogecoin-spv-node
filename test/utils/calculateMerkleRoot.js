const bmp = require('bitcoin-merkle-proof')
const crypto = require('crypto')

var txid = 'e83e02ff79b16a4f04fff5bbee72b07f6d30be7777878a3f75c2e469d89c0d4b'

var merkle = {
  blockHeader: '020000009e555073d0c4f36456db8951f449704d544d2826d9aa60636b40374626780abb3b2eff28528cee3259414186aa1cbe2230917c78c306445db7cfc960e41f596b0bfffa52ffff0f1e0001adcf',
  transactionCount: 17,
  hashCount: 6,
  hashes:
   [ 'e83e02ff79b16a4f04fff5bbee72b07f6d30be7777878a3f75c2e469d89c0d4b',
     '42105d3343b7463ebca881fc860f025f1d2bb9a2ddd93b9c236c00a3145d7886',
     'e504bcf0ee36299c1cbb6261c658389ff0ff7eda4d1d74ebfda71c2af46fee2f',
     'c064d7bd8314c0fe595106f2baa42196fe1b189ae04d8aadc64a3bc659715ec0',
     'e8049204cd6c7f9f58dca732d57192d464388e7cb0920bf4571684be4749544b',
     'd3f0bbca61ab1bd103c4aa4657454211f8176e3a9484159b833d5007c800b9e2' ],
  flagBytes: 2,
  flags: '3f00'
}

var data = {
  flags: [63, 0],
  hashes: [
    new Buffer('e83e02ff79b16a4f04fff5bbee72b07f6d30be7777878a3f75c2e469d89c0d4b', 'hex'),
    new Buffer('42105d3343b7463ebca881fc860f025f1d2bb9a2ddd93b9c236c00a3145d7886', 'hex'),
    new Buffer('e504bcf0ee36299c1cbb6261c658389ff0ff7eda4d1d74ebfda71c2af46fee2f', 'hex'),
    new Buffer('c064d7bd8314c0fe595106f2baa42196fe1b189ae04d8aadc64a3bc659715ec0', 'hex'),
    new Buffer('e8049204cd6c7f9f58dca732d57192d464388e7cb0920bf4571684be4749544b', 'hex'),
    new Buffer('d3f0bbca61ab1bd103c4aa4657454211f8176e3a9484159b833d5007c800b9e2', 'hex')
  ],
  numTransactions: 17,
  merkleRoot: new Buffer('371b944de2ec12e50f11af7b05175ca59fe5dad9b16870d8ec0a2cf613306ff3', 'hex').reverse()
}


var hash = crypto.createHash('sha256').update(Buffer.from(merkle.blockHeader, 'hex')).digest()
hash = crypto.createHash('sha256').update(hash).digest().toString('hex')

console.log(hash)

var result = bmp.verify(data)

console.log(result)

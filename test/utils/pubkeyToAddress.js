const pubkeyToAddress = require('../../src/utils/pubkeyToAddress')

var address = 'nUvxPtXWKwatQim1dDbjBc6vSSWKwDvYHn'
var pubKeyHash = Buffer.from('0817fa995b26604c5ed08c160f0bc2141567ce72', 'hex')

var result = pubkeyToAddress(pubKeyHash, true)

// Passed
console.log(result === address)

var pubkey = Buffer.from('04ffd03de44a6e11b9917f3a29f9443283d9871c9d743ef30d5eddcd37094b64d1b3d8090496b53256786bf5c82932ec23c3b74d9f05a6f95a8b5529352656664b', 'hex')

result = pubkeyToAddress(pubkey, false)

// Passed
console.log(result === 'noBEfr9wTGgs94CdGVXGYwsQghEwBsXw4K')

var pubkey = Buffer.from('03b629df55e75c122c972f117c9c0318efaa5e4801f807a2183c9995a668b0b2fd', 'hex')

result = pubkeyToAddress(pubkey, false)

console.log(result)

// Passed
console.log(result === 'nXoKWTPsRzSQDM6sTd2P2bc5gtgYB1xL1H')

var p2shScript = Buffer.from('a91401d4df05a673fc46698c4d2effdac931d760025287','hex')
var redeemScriptHash = p2shScript.slice(2, 22)
address = pubkeyToAddress(redeemScriptHash, true, true)
// Passed
console.log(address)

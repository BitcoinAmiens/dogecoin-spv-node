const test = require('ava')
const bitcoinjs = require('bitcoinjs-lib')
const bip65 = require('bip65')
const { 
  pubkeyToAddress,
  createPayToHash,
  serializePayToMultisigWithTimeLockScript,
  prepareTransactionToSign,
} = require('../../src/wallet/utils')
const { encodeRawTransaction } = require('../../src/commands/tx')
const doubleHash = require('../../src/utils/doubleHash')
const CompactSize = require('../../src/utils/compactSize')

const secp256k1 = require('secp256k1')

const TESTNET_NETWORK_BYTE = '71'

// Initialize Dogecoin testnet info
bitcoinjs.networks.dogecoin_testnet = {
  messagePrefix: '\x18Dogecoin Signed Message:\n',
  bech32: 'tdge',
  bip32: {
    public: 0x0432a9a8,
    private: 0x0432a243
  },
  pubKeyHash: 0x71,
  scriptHash: 0xc4,
  wif: 0xef,
}

const keyPairA = bitcoinjs.ECPair.fromPrivateKey(Buffer.from('3b187fd3a10960efe5753c9851c174c05bcdb30db22fd9deab981fe1f0ec7b00', 'hex'))  
const keyPairB = bitcoinjs.ECPair.fromPrivateKey(Buffer.from('5cdc1bf38cd77f6a0f130d50e6e37b1d1e3eb59b78f3fde6c1572f44e7f709ed', 'hex'))


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

test('successfully serialize a pay to multisig with time lock script', t => {
  const blocksLock = 500
  
  const multisigScript = serializePayToMultisigWithTimeLockScript([keyPairA.publicKey.toString('hex'), keyPairB.publicKey.toString('hex')], blocksLock)

  const locktime = Buffer.from(bip65.encode({ blocks: blocksLock }).toString(16), 'hex').reverse().toString('hex')
  
  const multisigScriptExecpected = bitcoinjs.script.fromASM("OP_IF " + 
      locktime + "00" + " OP_CHECKLOCKTIMEVERIFY OP_DROP " +
      keyPairA.publicKey.toString('hex') + " OP_CHECKSIGVERIFY OP_ELSE OP_2 OP_ENDIF " +
      keyPairA.publicKey.toString('hex') + " " + keyPairB.publicKey.toString('hex') + " OP_2 OP_CHECKMULTISIG")
    
  t.is(multisigScript.toString('hex'), multisigScriptExecpected.toString('hex'))
})

test('successfully create pay to hash script', t => {
  const script = Buffer.from('63021f00b1752102695c71925215f8a23d9880fc52811c77aac00a259876046c8ad92731d8c2c172ad6752682102695c71925215f8a23d9880fc52811c77aac00a259876046c8ad92731d8c2c17221033018856019108336a67b29f4cf9612b9b83953a92a5ef8472b6822f78d85047752ae', 'hex')

  const p2sh = bitcoinjs.payments.p2sh({
    redeem: { output: script },
    network: bitcoinjs.networks.dogecoin_regtest
  })

  const p2shScript = createPayToHash(script).script.toString('hex')

  const expectedp2shScript = bitcoinjs.script.fromASM('OP_HASH160 ' + p2sh.hash.toString('hex') + ' OP_EQUAL').toString('hex')

  t.is(p2shScript, expectedp2shScript)
})

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

test.skip('successfully create payment channel transaction', t => {
  const blocksLock = 500

  const multisigScript = serializePayToMultisigWithTimeLockScript([keyPairA.publicKey.toString('hex'), keyPairB.publicKey.toString('hex')], blocksLock)
  const p2sh = createPayToHash(multisigScript)

  const previousTx = '01000000015e1164684d2e6c5d58d9345485463fd76bb6f133632dc044d44a902f83f78b2d0000000049483045022100dabfe1032cf0d6509160932ee90dbc9f2ac03ac53791b52b384abcdd5e3517af02203b93a8374f1fd6ba9d8997ab3508c78e1054f00b909ac31ccea46adaf29964c301feffffff0200693504762d00001976a914694b47a9ae02c81f017796f82b414f722e9bb84888ac00d6117e030000001976a914f155d92633f0ba198d32ed95b65b4e0bcfd7ef1d88ac96000000'
  const index = 1

  const transaction = {
    version: 1,
    txInCount: 1,
    txIns: [{
      previousOutput: { hash: Buffer.from("68390a23aaa802839babc2fcfca831d5eddf752ecbdb2a13f900ee01612e0560", 'hex').reverse().toString('hex'), index },
      signature: Buffer.from("76a914f155d92633f0ba198d32ed95b65b4e0bcfd7ef1d88ac", 'hex'),
      sequence: 4294967294
    }],
    txOutCount: 1,
    txOuts: [{
      value: BigInt(100*100000000),
      pkScriptSize: p2sh.script.length,
      pkScript: p2sh.script 
    }],
    locktime: 0,
    hashCodeType: 1
  }

  const rawUnsignedTransaction = prepareTransactionToSign(transaction, index)
  const rawTransactionHash = doubleHash(rawUnsignedTransaction)

  const signature = secp256k1.ecdsaSign(Buffer.from(rawTransactionHash, 'hex'), keyPairA.privateKey)

  const signatureDer = Buffer.from(secp256k1.signatureExport(signature.signature))

  const signatureCompactSize = CompactSize.fromSize(signatureDer.length + 1)
  const publicKeyCompactSize = CompactSize.fromSize(keyPairA.publicKey.length)

  const scriptSig = signatureCompactSize.toString('hex') + signatureDer.toString('hex') + '01' + publicKeyCompactSize.toString('hex') + keyPairA.publicKey.toString('hex')

  transaction.txIns[0].signatureSize = CompactSize.fromSize(Buffer.from(scriptSig).length, 'hex')
  transaction.txIns[0].signature = Buffer.from(scriptSig, 'hex')

  const rawTransaction = encodeRawTransaction(transaction).toString('hex')

  const psbt = new bitcoinjs.Psbt()
  psbt.addInput({
    // if hash is string, txid, if hash is Buffer, is reversed compared to txid
    hash: "68390a23aaa802839babc2fcfca831d5eddf752ecbdb2a13f900ee01612e0560",
    index: index,
    // non-segwit inputs now require passing the whole previous tx as Buffer
    nonWitnessUtxo: Buffer.from(previousTx, 'hex')
  })

  psbt.addOutputs([{
    script: p2sh.script,
    value: 100*100000000
  }])

  psbt.signInput(0, keyPairA)
  psbt.finalizeAllInputs()

  const transactionMultisig = psbt.extractTransaction(true).toHex()

  t.is(transactionMultisig, rawTransaction)

})
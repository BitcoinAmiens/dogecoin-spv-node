const bs58check = require('bs58check')
const RIPEMD160 = require('ripemd160')
const crypto = require('crypto')
const bip65 = require('bip65')

const CompactSize = require('../utils/compactSize')
const { ScriptTypes } = require('./scripts')

function hashing (buf) {
  let hash = crypto.createHash('sha256').update(buf).digest()
  hash = new RIPEMD160().update(hash).digest()
  return hash
}

function pubkeyToPubkeyHash (pubkey) {
  return hashing(pubkey)
}

function pubkeyToAddress (pubkey, networkByte, hash = false) {
  let pubKeyHash = pubkey

  if (!hash) {
    pubKeyHash = pubkeyToPubkeyHash(pubkey)
  }

  networkByte = Buffer.from(networkByte, 'hex')

  const temp = Buffer.concat([networkByte, pubKeyHash])

  return bs58check.encode(temp)
}

// Encode the raw transaction so it can be sign (so without signature)
// We need to remove the original script of all the input which are not going to be signed
// https://bitcoin.stackexchange.com/questions/41209/how-to-sign-a-transaction-with-multiple-inputs
function prepareTransactionToSign (transaction, vint) {
  const txInCount = CompactSize.fromSize(transaction.txInCount)
  const txOutCount = CompactSize.fromSize(transaction.txOutCount)
  let bufSize = 4 + 1
  bufSize += 41 * transaction.txInCount + 25
  bufSize += 1
  for (let txout of transaction.txOuts) {
    bufSize += 9 + txout.pkScriptSize
  }
  bufSize += 8

  const buffer = Buffer.alloc(bufSize)
  let offset = 0

  buffer.writeUInt32LE(transaction.version, offset)
  offset += 4

  txInCount.copy(buffer, offset)
  offset += txInCount.length

  for (let txInIndex = 0; txInIndex < transaction.txInCount; txInIndex++) {
    Buffer.from(transaction.txIns[txInIndex].previousOutput.hash, 'hex').copy(buffer, offset)
    offset += 32

    buffer.writeUInt32LE(transaction.txIns[txInIndex].previousOutput.index, offset)
    offset += 4

    if (txInIndex === vint) {
      const scriptSigSize = CompactSize.fromSize(transaction.txIns[txInIndex].signature.length)
      scriptSigSize.copy(buffer, offset)
      offset += scriptSigSize.length

      transaction.txIns[txInIndex].signature.copy(buffer, offset)
      offset += transaction.txIns[txInIndex].signature.length
    } else {
      const nullBuffer = Buffer.alloc(1)
      nullBuffer.copy(buffer, offset)
      offset += nullBuffer.length
    }

    buffer.writeUInt32LE(transaction.txIns[txInIndex].sequence, offset)
    offset += 4
  }

  txOutCount.copy(buffer, offset)
  offset += txOutCount.length

  for (let txOutIndex = 0; txOutIndex < transaction.txOutCount; txOutIndex++) {
    buffer.writeBigInt64LE(transaction.txOuts[txOutIndex].value, offset)
    offset += 8

    const pkScriptSize = CompactSize.fromSize(transaction.txOuts[txOutIndex].pkScriptSize)

    pkScriptSize.copy(buffer, offset)
    offset += pkScriptSize.length

    transaction.txOuts[txOutIndex].pkScript.copy(buffer, offset)
    offset += transaction.txOuts[txOutIndex].pkScriptSize
  }

  buffer.writeUInt32LE(transaction.locktime, offset)
  offset += 4

  buffer.writeUInt32LE(transaction.hashCodeType, offset)

  return buffer
}

function indexToBufferInt32LE (index) {
  const indexBuffer = Buffer.allocUnsafe(4)
  indexBuffer.writeInt32LE(index, 0)

  return indexBuffer
}

function serializePayToPubkeyHashScript (address) {
  address = bs58check.decode(address).slice(1)
  return Buffer.from('76a914' + address.toString('hex') + '88ac', 'hex')
}

function serializePayToMultisigScript (publickeys) {
  // This is useless for now
  if (publickeys.length !== 2) {
    throw new Error('Only support 2 out of 2 multisig')
  }
  return Buffer.from('52' + publickeys[0] + publickeys[1] + '52ae', 'hex')
}

function serializePayToMultisigWithTimeLockScript (publickeys, blocksLock) {
  if (publickeys.length !== 2) {
    throw new Error('Only support 2 out of 2 multisig')
  }

  const locktime = Buffer.from(bip65.encode({ blocks: blocksLock }).toString(16), 'hex').reverse().toString('hex') + '00' // locktime value with sign byte (should end with 00)

  const locktimeSize = CompactSize.fromSize(Buffer.from(locktime, 'hex').length)

  return Buffer.from(
    '63' // OP_IF
    + locktimeSize.slice(0, 1).toString('hex') + locktime 
    + 'b1' // OP_CHECKLOCKTIMEVERIFY
    + '75' // OP_DROP
    + (publickeys[0].length / 2).toString(16) // length divide by two because hex string
    + publickeys[0] // client public key (mine)
    + 'ad' + '67' + '52' + '68' // OP_CHECKSIGVERIFY OP_ELSE OP_2 OP_ENDIF
    + (publickeys[0].length / 2).toString(16) + publickeys[0] + (publickeys[1].length / 2).toString(16) + publickeys[1] + '52ae',
    'hex')
}

function createPayToHash (script) {
  if (!Buffer.isBuffer(script)) {
    throw new Error('Script is expected to be a Buffer.')
  }

  let hashScript = hashing(script)

  return { script: Buffer.from('a9'+ hashScript.length.toString(16) + hashScript.toString('hex') +'87', 'hex'), hashScript }
}

function getPubkeyHashFromScript (script) {
  const firstByte = script.slice(0, 1).toString('hex')

  switch (firstByte) {
    case '21':
      // public key
      return pubkeyToPubkeyHash(script.slice(1, 34))
    case '76':
    // public key hash
      return script.slice(3, 23)
    case 'a9':
      // redem script hash
      return script.slice(2, 22)
    default:
      return null
  }
}

function extractPubkeyHashFromP2PK (script) {
  const firstByte = script.slice(0, 1).toString('hex')

  if ('21' !== firstByte) {
    throw new Error('Script is not pay-to-pubkey standard.')
  }

  return pubkeyToPubkeyHash(script.slice(1, 34))
}

function extractPubkeyHashFromP2PKH (script) {
  const firstByte = script.slice(0, 1).toString('hex')

  if ('76' !== firstByte) {
    throw new Error('Script is not pay-to-pubkey-hash standard.')
  }

  return script.slice(3, 23)
}

function extractScriptHashFromP2SH (script) {
  const firstByte = script.slice(0, 1).toString('hex')

  if ('a9' !== firstByte) {
    throw new Error('Script is not pay-to-script-hash standard.')
  }

  return script.slice(2, 22)
}

function getScriptType (script) {
  const firstByte = script.slice(0, 1).toString('hex')

  switch (firstByte) {
    case '21':
      return ScriptTypes.PAY_TO_PUBKEY
    case '76':
      return ScriptTypes.PAY_TO_PUBKEY_HASH
    case 'a9':
      return ScriptTypes.PAY_TO_SCRIPT_HASH
    default:
      return ScriptTypes.UNKNOWN
  }
}

module.exports = {
  pubkeyToPubkeyHash,
  pubkeyToAddress,
  prepareTransactionToSign,
  indexToBufferInt32LE,
  serializePayToPubkeyHashScript,
  serializePayToMultisigScript,
  getPubkeyHashFromScript,
  createPayToHash,
  serializePayToMultisigWithTimeLockScript,
  getScriptType,
  extractPubkeyHashFromP2PK,
  extractPubkeyHashFromP2PKH,
  extractScriptHashFromP2SH,
}

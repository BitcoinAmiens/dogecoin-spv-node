const CompactSize = require('../utils/compactSize')
const { readU64 } = require('../utils/write64')
const doubleHash = require('../utils/doubleHash')

function decodeHeadersMessage (payload) {
  var headers = {}
  let offset = 0

  var compactSize = CompactSize.fromBuffer(payload, offset)

  headers.count = compactSize.size
  offset = compactSize.offset

  headers.headers = []

  // console.log('Headers count : ' + headers.count + ', headers count bit : ' + payload.slice(0, 3).toString('hex'))

  for (var i = 0; i < headers.count; i++) {
    var header = {}

    header.version = payload.readInt32LE(offset)
    offset += 4

    var previousHash = payload.slice(offset, offset + 32)


    header.previousHash = payload.slice(offset, offset + 32).toString('hex')
    offset += 32

    if (header.previousHash === '0000000000000000000000000000000000000000000000000000000000000000') {
      throw Error('PREVIOUS HASH SHOULD NOT BE NULL')
    }

    header.merklerootHash = payload.slice(offset, offset + 32).toString('hex')
    offset += 32

    header.time = payload.readUInt32LE(offset)
    offset += 4

    header.nBits = payload.slice(offset, offset + 4).toString('hex')
    offset += 4

    header.nonce = payload.readUInt32LE(offset)
    offset += 4


    header.hash = doubleHash(payload.slice(offset - 80, offset)).toString('hex')

    // Should be always 0x00
    // https://bitcoin.org/en/developer-reference#headers
    header.transactionCount = payload.readUInt8(offset)
    offset += 1

    // We need to verify this rule I am not sure about that
    if (header.nonce === 0 && header.version >= 6422786) {
      // this is happening
      // https://en.bitcoin.it/wiki/Merged_mining_specification

      delete header.transactionCount


      // It was not the transaction headers that we got
      offset -= 1

      let parentBlock = {}

      parentBlock.version = payload.readInt32LE(offset)
      offset += 4

      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      parentBlock.txInCount = compactSize.size

      parentBlock.txIns = []

      for (let j=0; j< parentBlock.txInCount; j++) {
        let txIn = {}

        txIn.previousOutput = payload.slice(offset, offset + 36).toString('hex')
        offset += 36

        let compactSize = CompactSize.fromBuffer(payload, offset)
        offset += compactSize.offset

        txIn.scriptSize = compactSize.size

        txIn.script = payload.slice(offset, offset + compactSize.size).toString('hex')
        offset += compactSize.size

        txIn.sequence = payload.readUInt32LE(offset)
        offset += 4

        parentBlock.txIns.push(txIn)
      }

      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      parentBlock.txOutCount = compactSize.size

      parentBlock.txOuts = []

      for (let j=0; j< parentBlock.txOutCount; j++) {
        let txOut = {}

        txOut.value = readU64(payload, offset)
        offset += 8

        try {
          compactSize = CompactSize.fromBuffer(payload, offset)
          offset += compactSize.offset
        } catch (err) {
          throw err
        }

        txOut.pkScriptSize = compactSize.size

        txOut.pkScript = payload.slice(offset, offset + txOut.pkScriptSize).toString('hex')
        offset += compactSize.size

        parentBlock.txOuts.push(txOut)
      }

      parentBlock.locktime = payload.readUInt32LE(offset)
      offset += 4

      parentBlock.blockHash = payload.slice(offset, offset + 32).toString('hex')
      offset += 32

      let coinbaseBranch = {}

      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      coinbaseBranch.branchLength = compactSize.size

      coinbaseBranch.branchHashes = []

      for (let j=0; j < coinbaseBranch.branchLength; j++) {
        coinbaseBranch.branchHashes.push(payload.slice(offset, offset + 32).toString('hex'))
        offset += 32
      }

      coinbaseBranch.branchSideMask = payload.readInt32LE(offset)
      offset += 4

      parentBlock.coinbaseBranch = coinbaseBranch

      blockchainBranch = {}

      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      blockchainBranch.branchLength = compactSize.size

      blockchainBranch.branchHashes = []

      for (let j=0; j < blockchainBranch.branchLength; j++) {
        blockchainBranch.branchHashes.push(payload.slice(offset, offset + 32).toString('hex'))
        offset += 32
      }

      blockchainBranch.branchSideMask = payload.readInt32LE(offset)
      offset += 4

      parentBlock.blockchainBranch = blockchainBranch

      parentBlock.parentBlockHeader = payload.slice(offset, offset + 80).toString('hex')
      offset += 80

      header.parentBlock = parentBlock

      header.transactionCount = payload.readUInt8(offset)
      offset += 1
    }

    headers.headers.push(header)
  }

  return headers
}

module.exports = { decodeHeadersMessage }

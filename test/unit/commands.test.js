const test = require('ava')
const fs = require('fs')
const path = require('path')

const { decodeBlockMessage } = require('../../src/commands/block')
const { encodeFilterLoad } = require('../../src/commands/filterload')
const { encodeGetblocksMessage } = require('../../src/commands/getblocks')
const { encodeGetheadersMessage } = require('../../src/commands/getheaders')
const { decodeHeadersMessage } = require('../../src/commands/headers')
const { decodeInvMessage } = require('../../src/commands/inv')
const { decodeMerkleblockMessage } = require('../../src/commands/merkleblock')
const { decodeTxMessage } = require('../../src/commands/tx')
const { encodeVersionMessage, decodeVersionMessage } = require('../../src/commands/version')
const { encodePingMessage } = require('../../src/commands/ping')
const { decodeRejectMessage } = require('../../src/commands/reject')
const { preparePacket, decodePacket } = require('../../src/commands/packet')
const { decodeAddrMessage } = require('../../src/commands/addr')


const TEST_VECTORS_DIR = path.join('.', 'test', 'test_vectors')
const TESTNET_MAGIC_BYTES = 0xdcb7c1fc

/*
    Payloads encoding and decoding !
*/
test('successfully decode `block` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'block.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = decodeBlockMessage(Buffer.from(data.hex, 'hex'))
  
  t.is(result.blockHeader, data.value.blockHeader)
  t.is(result.txnCount, data.value.txnCount)
})

test('successfully encode `filterload` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'filterload.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
    
  let result = encodeFilterLoad(data.value)
    
  t.is(data.hex, result.toString('hex'))
})

test('successfully encode `getblocks` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'getblocks.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = encodeGetblocksMessage(data.value.blockHash, data.value.lastHash)
  
  t.is(data.hex, result.toString('hex'))
})

test('successfully encode `getheaders` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'getheaders.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = encodeGetheadersMessage(data.value.blockHash)
  
  t.is(data.hex, result.toString('hex'))
})

test('successfully decode `headers` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'headers.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = decodeHeadersMessage(Buffer.from(data.hex, 'hex'))

  t.deepEqual(data.value, result)
})

test('successfully decode `inv` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'inv.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = decodeInvMessage(Buffer.from(data.hex, 'hex'))

  t.deepEqual(data.value, result)
})

test('successfully decode `merkleblock` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'merkleblock.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = decodeMerkleblockMessage(Buffer.from(data.hex, 'hex'))

  t.is(JSON.stringify(data.value), JSON.stringify(result))
})

test('successfully encode `ping` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'ping.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = encodePingMessage(BigInt(data.value))

  t.is(data.hex, result.toString('hex'))
})

test('successfully decode `reject` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'reject.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = decodeRejectMessage(Buffer.from(data.hex, 'hex'))

  t.is(JSON.stringify(data.value), JSON.stringify(result))
})

test('successfully decode `tx` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'tx.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  // Convert string to BigInt
  // and buffer
  for (let i in data.value.txOuts) {
    data.value.txOuts[i].value = BigInt(data.value.txOuts[i].value)
    data.value.txOuts[i].pkScript = Buffer.from(data.value.txOuts[i].pkScript.data)
  }
  
  let result = decodeTxMessage(Buffer.from(data.hex, 'hex'))

  t.deepEqual(data.value, result)
})

test('successfully encode `version` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'version.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  // Convert string to BigInt
  data.value.services = BigInt(data.value.services)
  data.value.time = BigInt(data.value.time)
  data.value.remote.services = BigInt(data.value.remote.services)
  data.value.local.services = BigInt(data.value.local.services)
  data.value.nonce = BigInt(data.value.nonce)
  
  let result = encodeVersionMessage(data.value)

  t.is(data.hex, result.toString('hex'))
})

test('successfully decode `version` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'version.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = decodeVersionMessage(Buffer.from(data.hex, 'hex'))

  t.true('agent' in result)
  t.true('height' in result)
  t.true('local' in result)
  t.true('nonce' in result)
  t.true('relay' in result)
  t.true('remote' in result)
  t.true('services' in result)
  t.true('version' in result)

})

test('successfully decode `addr` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'addr.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = decodeAddrMessage(Buffer.from(data.hex, 'hex'))
  
  t.is(JSON.stringify(data.value), JSON.stringify(result))
})

/*
  Packets encoding and decoding !
*/
test('successfully encode packet', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'packet.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = preparePacket(data.value.cmd, Buffer.from(data.value.payload, 'hex'), TESTNET_MAGIC_BYTES)

  t.is(data.hex, result.toString('hex'))
})

test('successfully decode packet', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'packet.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = decodePacket(Buffer.from(data.hex, 'hex'), TESTNET_MAGIC_BYTES)

  t.is(data.value.cmd, result.cmd)
  t.is(data.value.lenght, result.lenght)
  t.is(data.value.payload, result.payload.toString('hex'))
})
const test = require('ava')
const fs = require('fs')
const path = require('path')

const { decodeBlockMessage } = require('../src/commands/block')
const { encodeFilterLoad } = require('../src/commands/filterload')
const { encodeGetblocksMessage } = require('../src/commands/getblocks')
const { encodeGetheadersMessage } = require('../src/commands/getheaders')
const { decodeHeadersMessage } = require('../src/commands/headers')
const { decodeInvMessage } = require('../src/commands/inv')
const { decodeMerkleblockMessage } = require('../src/commands/merkleblock')
const { decodeTxMessage } = require('../src/commands/tx')

const TEST_VECTORS_DIR = path.join('.', 'test', 'test_vectors')

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

test.todo('successfully encode `filteradd` payload')

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

test.todo('successfully encode `ping` payload')
test.todo('successfully decode `reject` payload')

test('successfully decode `tx` payload', t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'tx.json'), { encoding: 'utf-8' })
  data =  JSON.parse(data)
  
  let result = decodeTxMessage(Buffer.from(data.hex, 'hex'))

  t.is(JSON.stringify(data.value), JSON.stringify(result))
})
test.todo('successfully encode `version` payload')
test.todo('successfully decode `version` payload')

/*
  Packets encoding and decoding !
*/
test.todo('successfully encode packet')
test.todo('successfully decode packet')
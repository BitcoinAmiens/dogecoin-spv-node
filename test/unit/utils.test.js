const test = require('ava')

const CompactSize = require('../../src/utils/compactSize')
const doubleHash = require('../../src/utils/doubleHash')

/*
  compactSize.js
*/
test('instantiate CompactSize object from Buffer', t => {
  let c = CompactSize.fromBuffer(Buffer.from('01', 'hex'), 0)
  
  t.is(c.size, 1)
  t.is(c.offset, 1)
})

test('instantiate CompactSize object from Buffer (2)', t => {
  let c = CompactSize.fromBuffer(Buffer.from('fd0302', 'hex'), 0)
  
  t.is(c.size, 515)
  t.is(c.offset, 3)
})

test('instantiate CompactSize object from size', t => {
  let buf = CompactSize.fromSize(515)
  
  t.is(buf.toString('hex'), 'fd0302')
})

/*
  decodeHeader.js
  NOT CURRENTLY USED
*/
test.todo('successfully decode a header payload')

/*
  doubleHash.js
*/
test('successfully double hash data', t => {
  const headerHex = '010000000000000000000000000000000000000000000000000000000000000000000000696ad20e2dd4365c7459b4a4a5af743d5e92c6da3229e6532cd605f6533f2a5bdae5494dffff7f2002000000'
  const hash = doubleHash(Buffer.from(headerHex, 'hex'))
  
  t.is(hash.toString('hex'), 'a573e91c1772076c0d40f70e4408c83a31705f296ae6e7629d4adcb5a360213d')
})
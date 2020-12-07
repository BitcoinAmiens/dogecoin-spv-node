/*
  Generate test_vectors files
*/
const fs = require('fs')
const Peer = require('../../src/peer')
const { getVersion, encodeVersionMessage } = require('../../src/commands/version')
const { encodePingMessage } = require('../../src/commands/ping')
const { encodeFilterLoad } = require('../../src/commands/filterload')
const { preparePacket } = require('../../src/commands/packet')
const path = require('path')
const BloomFilter = require('bloom-filter')

const PATH_TEST_VECTORS_DIR = path.join('test', 'test_vectors')

const peer = new Peer('127.0.0.1', 18444)
var data

{
  console.log('\n#### Generate version.json ####')
  let version = getVersion('127.0.0.1', 18444)
  let payload = encodeVersionMessage(version)
  
  // Convert to string for stringify
  version.services = version.services.toString()
  version.time = version.time.toString()
  version.remote.services = version.remote.services.toString()
  version.local.services = version.local.services.toString()
  version.nonce = version.nonce.toString()

  data = {
    hex: payload.toString('hex'),
    value: version
  }
  //fs.writeFileSync(path.join(PATH_TEST_VECTORS_DIR, 'version.json'), JSON.stringify(data), { encoding: 'utf-8'})
  console.log('Done !\n')
}

{
  console.log('\n#### Generate ping.json ####')
  let nonce = 1n
  let payload = encodePingMessage(nonce)
  data = {
    hex: payload.toString('hex'),
    value: nonce.toString()
  }
  //fs.writeFileSync(path.join(PATH_TEST_VECTORS_DIR, 'ping.json'), JSON.stringify(data), { encoding: 'utf-8'})
  console.log('Done !\n')
}

{
  console.log('\n#### Generate filteradd.json ####')
  let addresses = ['f209dd7f1451468a67dc4f98d945d83be056a80d',
    '0c55e056b5602ffdb7ec0025f7f627b8aa438937',
    'f157f9fb0c247cd4fc6987e0d2562031ed1b6151',
    'dd7243e07933b7b0b09cae646ea3c44321f7c0e5',
    '10a7ba89807d1e1d0664a9de6652713cf38a5d9d',
    'b2f90e3ecbe527d22410bf3f0d9b84997849ad24',
    'f9acda55d86adce868d45b1b627ec540f0cd8392',
    '2ed6fdaa1e33e53c8f1c2ffcaa53c9875ef5c280',
    '390bc5574e6b7c3fe6f51406ba540a53c930aa3d',
    '9fe37caeb15726f90e0fbff943bb22ccdcb267a3',
    '95b72f803402f429ecea47181808feb5d7a235af',
    '7997ab62e60a2c864cce27b35ad2dbdc8503245b',
    'ad18cf3f3362059160192ec5356ca563a82c18e9',
    'c71900bfc548da92405ce6ecc603cddf6482f358',
    '40425c9c06105422b8b68e7878db6fdcf06a6228',
    '0dcefd36016ed0e43640e913860245db1564c703',
    'b1db7a657e6331b04f83b93322725ea826f6e04e',
    '1ce3f90776f3c891aa85f4323ed85ae9a1da57ee',
    '7a9bb2ec7a2add1d709259f7a14813880e9342d1',
    '380e7e17bdce96a3f356a46e60051c0161ec466c',
    '0ed1884ab0193d74f5f8a7f674808f7365ceeba6',
    'e0ea23c147b694af4d9cbde2863199aa335114c8',
    '9b4279413e483bbf2b8d6ec7ab7b368b6d81b148',
    '5acc94c54a52fbc1afc9d89153bb170f98c0dabf',
    '2b0b099b20301ad29390d708b9cd7cc51d5601f5',
    '17a2984745b4b3c0bad46b3cf4b4f304ff2fb6d7',
    '968ce5c1f088983690dfc9bfec745cccc1ec9b73',
    '9840a250630ace37a7018630c3ae4369d349141e',
    'f0dd5f2df75215e220c9d4c2861713c1b5b139c6',
    '9662d490c992226fbd57726cd872e0eb7cc8d687',
    'b0ce21d64a772f44e515d82c84f61b6f3ea7a3a0',
    '6e0d0bf8b19afad746bff94485733de6e6b94ac6',
    '56acb5630c2644368b98f377f43421550f08c8ea',
    '6c2a185e71ffd070c90b59611c8db3ab445db85a',
    'd84ffc9d4479dfc5ffbb0c4f27ab80e11f513589',
    '7bb18a9663a3596ff16737c9b42b775236797c77',
    '80a73ecc1636cabb942fed2289184fb97e409b02',
    'd84660469a5b84afba7e24aab97bea5386794397',
    '0dba50b39444e2780b326bbe9a8696500f7ab0fe',
    'f781e5e5d531c990ab8f5964141ed32bc391bb94'
  ]
  let filter = BloomFilter.create(addresses.length, 0.001)
  for (var address of addresses) {
    let bufferAddress = Buffer.from(address, 'hex')
    filter.insert(bufferAddress)
  }

  filter.nFlags = 1
  
  const filterElement = filter.toObject()
  
  let payload = encodeFilterLoad(filterElement)
  data = {
    hex: payload.toString('hex'),
    value: filterElement
  }
  //fs.writeFileSync(path.join(PATH_TEST_VECTORS_DIR, 'filterload.json'), JSON.stringify(data), { encoding: 'utf-8'})
  console.log('Done !\n')
}

{
  console.log('\n#### Generate packet.json ####')
  let nonce = 1n
  let payload = encodePingMessage(nonce)
  let packet = preparePacket('ping', payload, 0xdcb7c1fc)
  data = {
    hex: packet.toString('hex'),
    value: {
      cmd: 'ping',
      payload: payload.toString('hex'),
      length: payload.length
    }
  }
  //fs.writeFileSync(path.join(PATH_TEST_VECTORS_DIR, 'packet.json'), JSON.stringify(data), { encoding: 'utf-8'})
  console.log('Done !\n')
}
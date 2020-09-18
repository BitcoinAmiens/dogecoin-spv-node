/*
  Generate test_vectors files
*/
const fs = require('fs')
const Peer = require('../../src/peer')
const {getVersion, encodeVersionMessage} = require('../../src/commands/version')
const path = require('path')

const PATH_TEST_VECTORS_DIR = path.join('test', 'test_vectors')


const peer = new Peer('127.0.0.1', 18444)
var data

console.log('\n#### Generate version.json ####')

let version = getVersion()
let payload = encodeVersionMessage(version)
data = {
  hex: payload.toString('hex'),
  value: version
}
fs.writeFileSync(path.join(PATH_TEST_VECTORS_DIR, 'version.json'), JSON.stringify(data), { encoding: 'utf-8'})
console.log('Done !\n')
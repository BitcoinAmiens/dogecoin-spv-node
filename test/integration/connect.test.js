const test = require('ava')
const path = require('path')
const fs = require('fs')

const SPVNode = require('../../src/spvnode')
const networks = require('../../src/network')
const { getSettings } = require('../../src/settings')

const TEST_VECTORS_DIR = path.join('.', 'test', 'test_vectors')

test.before(t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'pubkeyshash.json'), { encoding: 'utf-8' })
  let pubkeyshash =  JSON.parse(data)
  
  // setup wallet files
  let settings = getSettings(networks.REGTEST)
  var spvnode = new SPVNode(pubkeyshash, settings)

  if (!fs.existsSync(settings.DATA_FOLDER)) {
    fs.mkdirSync(settings.DATA_FOLDER, {recursive: true})
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'spvnode'))
  }
  
  t.context = { spvnode, settings }
  
})

test('should connect to regtest node', async t => {
  
  let spvnode = t.context.spvnode
  let settings =  t.context.settings
  
  await spvnode.addPeer(settings.NODE_IP, settings.DEFAULT_PORT)

  t.pass()
})

test('should send ersion message to regtest node', t => {
  t.pass()
})
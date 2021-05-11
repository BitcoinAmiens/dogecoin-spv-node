const test = require('ava')
const path = require('path')
const fs = require('fs')
const Docker = require('dockerode')

const SPVNode = require('../../src/spvnode')
const networks = require('../../src/network')
const { getSettings } = require('../../src/settings')
const { create } = require('bloom-filter')

const TEST_VECTORS_DIR = path.join('.', 'test', 'test_vectors')

test.before(async t => {
  let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'pubkeyshash.json'), { encoding: 'utf-8' })
  let pubkeyshash =  JSON.parse(data)

  // setup files
  let settings = getSettings(networks.REGTEST)

  // Test data folder
  settings.DATA_FOLDER = path.join(__dirname, 'data')

  if (!fs.existsSync(settings.DATA_FOLDER)) {
    fs.mkdirSync(settings.DATA_FOLDER, {recursive: true})
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'spvnode'))
  }

  var spvnode = new SPVNode(pubkeyshash, settings)

  // Start Dogecoin docker node
  const docker = new Docker()
  
  const container = await docker.createContainer({
    Image: 'dogecoind',
    name: 'dogecoind_regtest',
    PortBindings: {['18444/tcp']: [{ HostIp: '0.0.0.0', HostPort: '18444' }]},
    NetworkMode: 'host'
  })

  t.log('container created')

  await container.start({})

  t.log('container started')

  // Wait 5 seconds
  // Needed otherwise we try to connect when node is not ready
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  t.context = { spvnode, settings, container }
})

test.after.always(async t => {
  t.log('Tests done')
  // Clean after
  fs.rmSync(path.join(__dirname, 'data'), {recursive: true})
  
  const container = t.context.container

  await container.stop()
  await container.remove()
})

test.serial('should connect to regtest node', async t => {
  let spvnode = t.context.spvnode
  let settings =  t.context.settings

  t.log(`Connecting peer to ${settings.NODE_IP}:${settings.DEFAULT_PORT}`)

  await spvnode.addPeer(settings.NODE_IP, settings.DEFAULT_PORT)

  t.log('Peer connected')

  t.pass()
})

test.todo('should send version message to regtest node')
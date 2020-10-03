const net = require('net')
const packet = require('./src/commands/packet')
const version = require('./src/commands/version')

var socket = new net.Socket()

socket.connect(18444, '127.0.0.1', function (res) {
  console.log('Connection made')
  let versionObj = version.getVersion('127.0.0.1', 18444)
  let message = version.encodeVersionMessage(versionObj)
  let versionPacket = packet.preparePacket('version', message)
  
  this.on('data', (data) => {
    console.log(data)
  })
  
  this.write(versionPacket)
})
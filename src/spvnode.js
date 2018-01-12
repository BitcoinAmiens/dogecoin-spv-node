var net = require('net')
var packet = require('./commands/packet')
var version = require('./commands/version')

const NODE_IP = '163.172.182.246'
const NODE_PORT = 44556

class SPVNode {
  constructor () {
    this.socket = new net.Socket()

    this.socket.on('data', this._onData)
    this.socket.on('close', this._onClose)
  }

  connect () {
    this.socket.connect(NODE_PORT, NODE_IP, function () {
      console.log('Connect')
      var message = version.versionMessage()
      const versionPacket = packet.preparePacket('version', message)
      this.write(versionPacket)
    })
  }

  _onData (data) {
    var decodedResponse = packet.decodePacket(data)

    switch (decodedResponse.cmd) {
      case 'version':
        console.log('version command received')
        const versionMessage = version.decodeVersionMessage(decodedResponse.payload)
        console.log(versionMessage)
        break
      case 'verack':
        console.log('verack command received')
        break
      default:
        console.log('Meh')
    }
  }

  _onClose (response) {
    console.log('Closing: ' + response)
  }
}

module.exports = SPVNode

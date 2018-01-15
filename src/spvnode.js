var Peer = require('./peer')

const NODE_IP = '192.168.50.4'
const NODE_PORT = 18444

class SPVNode {
  constructor () {
    this.peers = []
  }

  start () {
    var peer = new Peer(NODE_IP, NODE_PORT)
    this.peers.push(peer)
    peer.connect().then(() => {
      //peer.sendFilterLoad()
      console.log('OK')
    })
    .catch((error) => {
      console.log(error)
    })
  }
}

module.exports = SPVNode

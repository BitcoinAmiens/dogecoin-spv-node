var Peer = require('./peer')

const NODE_IP = '163.172.182.246'
const NODE_PORT = 44556

class SPVNode {
  constructor () {
    this.peers = []
  }

  start () {
    var peer = new Peer(NODE_IP, NODE_PORT)
    this.peers.push(peer)
    peer.connect().then(() => {
      peer.sendFilterLoad()
    })
    .catch((error) => {
      console.log(error)
    })
  }
}

module.exports = SPVNode

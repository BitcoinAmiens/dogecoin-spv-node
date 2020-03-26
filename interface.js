const constants = require('./src/constants')

// Interface
class Interface {

  numberOfLines = 0
  cursorPosition = 0
  lock = false

  constructor () {
    process.stdout.write(this.format())
  }

  // Update interface
  update (data) {

    // FIXME: the lastest data are going to be printed only when unlock
    if (this.lock) { return }

    this.lock = true

    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines-1), () => {
      process.stdout.write(this.format(
        data.height,
        data.bestHeight,
        data.hash,
        data.peers.length,
        data.tips,
        data.merkleHeight,
        data.balance
      ))

      // Unlock interface
      this.lock = false
    })
  }

  format (height=0, bestHeight=0, hash=null, numberOfPeers=0, tips=new Map(), merkleHeight=0, balance=0) {
    const tipsArray = this._formatTipsMap(tips)

    const report = process.resourceUsage()

    const layout = `
================ Process Usage Report ================

    fsRead: ${report.fsRead}  fsWrite: ${report.fsWrite}

================ SPV node ============================

    Height headers: ${height}/${bestHeight}
    Hash: ${hash}
    Peers: ${numberOfPeers}
    Tips: ${JSON.stringify(tipsArray)}
    Merkle Height: ${merkleHeight}/${bestHeight}

================ Wallet =============================

    Balance: ${balance/constants.SATOSHIS} Ð
`
    this.numberOfLines = layout.split('\n').length
    return layout
  }

  _formatTipsMap (tips) {
    const iterator = tips.keys()
    const tipsArray = []

    let tip = iterator.next()

    while (!tip.done) {
      tipsArray.push(tip.value)
      tip = iterator.next()
    }

    return tipsArray
  }

}

module.exports = Interface;

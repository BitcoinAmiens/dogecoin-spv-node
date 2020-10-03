const EventEmitter = require('events')
const constants = require('../../constants')
const debug = require('debug')('mainScreen')

class MainScreen extends EventEmitter {
  numberOfLines = 0
  cursorPosition = 0
  lock = false
  
  constructor (args) {
    super()
    
    if (typeof args.store !== 'object') {
      throw new Error("You need to define a 'store' object.")
    }
    
    this.store = args.store

    this.store.on('changed', () => {
      this.update()
    })  
  }
  
  _unlock () {
    this.lock = false
    this.emit('unlock')
  }
  
  format (height=0, bestHeight=0, hash=null, numberOfPeers=0, tips=new Map(), merkleHeight=0, balance=0) {
    const report = process.resourceUsage()
    const rss = Math.floor(process.memoryUsage().rss/(1000*1000))

    // TODO: seperate in sublayout

    const layout = `
================ Process Usage Report ================

    fsRead: ${report.fsRead}  fsWrite: ${report.fsWrite}
    Memory usage: ${rss} MB

================ SPV node ============================

    Height headers: ${height}/${bestHeight}
    Hash: ${hash}
    Peers: ${numberOfPeers}
    Tips: ${JSON.stringify([...tips.keys()])}
    Merkle Height: ${merkleHeight}/${bestHeight}

================ Wallet =============================

    Balance: ${balance/constants.SATOSHIS} Ð

================ Menu ===============================

    1. Generate a new address
    2. Send dogecoins
    3. Quit
`
    this.numberOfLines = layout.split('\n').length

    return layout
  }
  
  // Update interface
  update () {
    if (this.lock) { return }
    //if (this.window !== WINDOWS.INDEX) { return }

    this.lock = true

    //  TODO: properly get position of each value and only update it instead of the all screen
    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines-1), () => {
      process.stdout.write(this.format(
        this.store.height,
        this.store.bestHeight,
        this.store.hash,
        this.store.getNumPeers(),
        this.store.tips,
        this.store.merkleHeight,
        this.store.balance
      ))

      // Unlock interface
      this._unlock()
    })
  }
  
}

module.exports = MainScreen

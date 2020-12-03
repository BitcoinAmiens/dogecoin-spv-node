const Screen = require('./screen')
const KEYS = require('../keys')
const debug = require('debug')('mainScreen')
const SATOSHIS = require('../../constants').SATOSHIS

class MainScreen extends Screen {
  constructor (args) {
    super()

    debug('Initiating main screen')

    if (typeof args.store !== 'object' ||
      typeof args.displayNewAddressScreen !== 'function' ||
      typeof args.displaySendDogeScreen !== 'function' ||
      typeof args.stop !== 'function'
    ) {
      throw new Error("You need to define a 'store' object.")
    }

    this.store = args.store
    this.displayNewAddressScreen = args.displayNewAddressScreen
    this.displaySendDogeScreen = args.displaySendDogeScreen
    this.stop = args.stop

    this.store.on('changed', this._handleChangedEvent.bind(this))
  }

  _handleChangedEvent () {
    this.update()
  }

  _unlock () {
    this.lock = false
    this.emit('unlock')
  }

  keyPressed (key) {
    switch (key) {
      case KEYS.NUM_KEY_1:
        this.store.removeListener('changed', this._handleChangedEvent)
        this.displayNewAddressScreen()
        break
      case KEYS.NUM_KEY_2:
        this.store.removeListener('changed', this._handleChangedEvent)
        this.displaySendDogeScreen()
        break
      case KEYS.NUM_KEY_3:
        this.stop()
        break
    }
  }

  format (height = 0, bestHeight = 0, hash = null, numberOfPeers = 0, tips = new Map(), merkleHeight = 0, balance = 0) {
    const report = process.resourceUsage()
    const rss = Math.floor(process.memoryUsage().rss / (1000 * 1000))

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

    Balance: ${balance / SATOSHIS} Ð

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

    this.lock = true

    //  TODO: properly get position of each value and only update it instead of the all screen
    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines - 1), () => {
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

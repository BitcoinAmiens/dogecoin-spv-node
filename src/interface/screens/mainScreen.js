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
      typeof args.displayPaymentChannelScreen !== 'function' ||
      typeof args.displayMicroPaymentScreen !== 'function' ||
      typeof args.stop !== 'function'
    ) {
      throw new Error("You need to define a 'store' object.")
    }

    this.store = args.store
    this.displayNewAddressScreen = args.displayNewAddressScreen
    this.displaySendDogeScreen = args.displaySendDogeScreen
    this.displayPaymentChannelScreen = args.displayPaymentChannelScreen
    this.displayMicroPaymentScreen = args.displayMicroPaymentScreen
    this.stop = args.stop

    this._handleChangedEvent = this._handleChangedEvent.bind(this)

    this.store.on('changed', this._handleChangedEvent)
  }

  _handleChangedEvent () {
    debug('Changed!')
    this.update()
  }

  _unlock () {
    this.lock = false
    this.emit('unlock')
  }

  keyPressed (key) {
    switch (key) {
      case KEYS.NUM_KEY_0:
        this.stop()
        break
      case KEYS.NUM_KEY_1:
        this.store.removeListener('changed', this._handleChangedEvent)
        this.displayNewAddressScreen()
        break
      case KEYS.NUM_KEY_2:
        this.store.removeListener('changed', this._handleChangedEvent)
        this.displaySendDogeScreen()
        break
      case KEYS.NUM_KEY_3:
        this.store.removeListener('changed', this._handleChangedEvent)
        this.displayPaymentChannelScreen()
        break
      case KEYS.NUM_KEY_4:
        this.store.removeListener('changed', this._handleChangedEvent)
        this.displayMicroPaymentScreen()
        break
    }
  }

  format (height = 0, bestHeight = 0, hash = null, numberOfPeers = 0, tips = new Map(), merkleHeight = 0, balance = 0n, paymentChannels = []) {
    // TODO: seperate in sublayout

    let paymentChannelsSection = '    NONE'
    if (paymentChannels.length > 0) {
      paymentChannelsSection = ''
      for (let pc of paymentChannels) {
        paymentChannelsSection += `    ${pc.address} ---> ${pc.balance / SATOSHIS} Ð                  \n`
      }
      // space padding
      paymentChannelsSection += '                                         '
    }

    // WARNING!!! NEED TO PAD WITH SPACES
    const layout = `
================ SPV node ============================

    Height headers: ${height}/${bestHeight}
    Hash: ${hash}
    Peers: ${numberOfPeers}
    Tips: ${JSON.stringify([...tips.keys()])}
    Merkle Height: ${merkleHeight}/${bestHeight}

================ Wallet =============================

    Balance: ${balance / SATOSHIS} Ð                 

================ Payment Channels ===================
                                                     
${paymentChannelsSection}                        
                                                     
================ Menu ===============================
                                                     
    1. Generate a new address                        
    2. Send dogecoins                                
    3. Create payment channel                        
    ${paymentChannelsSection.length > 0 ? '4. Make a payment on payment channel': null}
                                                     
    0. Quit                                          
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
        this.store.balance,
        this.store.paymentChannels
      ))

      // Unlock interface
      this._unlock()
    })
  }
}

module.exports = MainScreen

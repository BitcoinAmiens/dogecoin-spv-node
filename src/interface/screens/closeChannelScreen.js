const Screen = require('./screen')
const debug = require('debug')('closeChannelScreen')
const KEYS = require('../keys')

/*
  Close payment channel screen.
*/
class CloseChannelScreen extends Screen {
  constructor (args) {
    super()
    debug('Closing a payment channel')

    if (typeof args.address !== 'string') {
      throw new Error('No Payment Channel address.')
    }

    if (typeof args.closeChannel !== 'function') {
      throw new Error('Missing "closeChannel" function.')
    }

    if (typeof args.paymentChannelUrl !== 'string') {
      throw new Error('"paymentChannelUrl" must be a string.')
    }

    if (typeof args.displayMainScreen !== 'function') {
      throw new Error('Missing "displayMainScreen" function.')
    }

    if (typeof args.store !== 'object') {
      throw new Error('Missing "store" object.')
    }

    this.address = args.address
    this.closeChannel = args.closeChannel
    this.displayMainScreen = args.displayMainScreen
    this.paymentChannelUrl = args.paymentChannelUrl
    this.store = args.store

    this.update()

    this.store.on('rejected', () => {
      process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines - 1), () => {
        this.update(this.store.rejectMessage)
      })
    })
  }

  keyPressed (key) {
    switch (key) {
      case KEYS.ENTER:
        this.closePaymentChannel()
        return false
      default:
        return true
    }
  }

  async closePaymentChannel () {
    const ok = await this.closeChannel(this.address, this.paymentChannelUrl)
    if (ok) {
      process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines - 1), () => {
        this.update('', 'Closing request for payment channel sent')
      })
    }
  }

  update (rejectMessage = '', successMessage = '') {
    const layout = `
================ CLOSE PAYMENT CHANNEL ================
  ${rejectMessage || successMessage}

  Payment channel address: ${this.address}

  Press "Enter" to close the payment channel
  Press "Return" to return to main screen
`
    this.numberOfLines = layout.split('\n').length

    process.stdout.write(layout)
  }
}

module.exports = CloseChannelScreen

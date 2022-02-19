const Screen = require('./screen')
const debug = require('debug')('paymentChannelScreen')
const KEYS = require('../keys')
const { SATOSHIS } = require('../../constants')

// const HOST = 'https://paymentchannel.shibe.technology'
const HOST = 'http://localhost:5000'

/*
  Micro Payment Screen
*/
class MicroPaymentScreen extends Screen {
  constructor (args) {
    super()

    debug('Making a payment throught a payment channel')

    if (typeof args.address !== 'string') {
      throw new Error('No Payment Channel address.')
    }

    if (typeof args.createMicroPayment !== 'function') {
      throw new Error('Missing "createMicroPayment" function.')
    }

    if (typeof args.displayMainScreen !== 'function') {
      throw new Error('Missing "displayMainScreen" function.')
    }

    this.address = args.address
    this.createMicroPayment = args.createMicroPayment
    this.displayMainScreen = args.displayMainScreen

    this.update()
  }

  keyPressed (key) {
    switch (key) {
      case KEYS.ENTER:
        this.sendPaymentChannel()
        return false
      default:
        return true
    }
  }

  async sendPaymentChannel () {
    this.displayMainScreen()
    await this.createMicroPayment(2n * SATOSHIS, this.address, HOST)
  }

  update () {
    const layout = `
================ MICRO PAYMENT ================

  Amount: 2 Ð
  Payment channel address: ${this.address}

  Press "Enter" to make payment
  Press "Return" to return to main screen
`
    this.numberOfLines = layout.split('\n').length

    process.stdout.write(layout)
  }
}

module.exports = MicroPaymentScreen

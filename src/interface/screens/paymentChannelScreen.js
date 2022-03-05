const Screen = require('./screen')
const debug = require('debug')('paymentChannelScreen')
const KEYS = require('../keys')
const { SATOSHIS } = require('../../constants')

/*
  Initiate Payment Channel Screen
*/
class PaymentChannelScreen extends Screen {
  constructor (args) {
    super()

    debug('Initiating new payment channel')

    this.initiatePaymentChannel = args.initiatePaymentChannel
    this.paymentChannelUrl = args.paymentChannelUrl
    this.update()
  }

  keyPressed (key) {
    switch (key) {
      case KEYS.ENTER:
        this.startPaymentChannel()
        return false
      default:
        return true
    }
  }

  async startPaymentChannel () {
    this.p2shAddress = await this.initiatePaymentChannel(BigInt(100) * SATOSHIS, this.paymentChannelUrl, 500)
    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines - 1), () => {
      this.update()
    })
  }

  update () {
    const p2shline = this.p2shAddress
      ? `P2SH address : ${this.p2shAddress}                                                             `
      : `Press "Enter" to create a payment channel with ${this.paymentChannelUrl}                       `

    const layout = `
================ PAYMENT CHANNEL ================

  ${p2shline}  

  Press "Return" to return to main screen
`
    this.numberOfLines = layout.split('\n').length

    process.stdout.write(layout)
  }
}

module.exports = PaymentChannelScreen

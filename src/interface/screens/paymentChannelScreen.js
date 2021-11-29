const Screen = require('./screen')
const debug = require('debug')('paymentChannelScreen')
const KEYS = require('../keys')
const { SATOSHIS } = require('../../constants')

const BOB_PUBLIC_KEY = '033018856019108336a67b29f4cf9612b9b83953a92a5ef8472b6822f78d850477'
const HOST = 'http://127.0.0.1:5000'

/*
  Initiate Payment Channel Screen
*/
class PaymentChannelScreen extends Screen {
  constructor(args) {
    super()

    debug('Initiating new payment channel')

    this.initiatePaymentChannel = args.initiatePaymentChannel
    this.update()
  }

  keyPressed(key) {
    switch (key) {
      case KEYS.ENTER:
        this.startPaymentChannel()
        return false
      default:
        return true
    }
  }

  async startPaymentChannel () {
    this.p2shAddress = await this.initiatePaymentChannel(BigInt(100) * SATOSHIS, BOB_PUBLIC_KEY, 500)
    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines - 1), () => {
      this.update()
    })
  }

  update() {
    const p2shline = this.p2shAddress ? `P2SH address : ${this.p2shAddress}` : `Press "Enter" to create a payment channel with ${HOST}`

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

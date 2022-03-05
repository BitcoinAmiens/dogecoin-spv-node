const KEYS = require('./keys')
const terminalStyle = require('./terminalStyle')
const EventEmitter = require('events')
const debug = require('debug')('interface')

const {
  MainScreen,
  NewAddressScreen,
  SendDogeScreen,
  MnemonicScreen,
  PaymentChannelScreen,
  MicroPaymentScreen,
  DummyScreen
} = require('./screens/')

// Interface
class Interface extends EventEmitter {
  constructor (args) {
    super()

    debug('Initiating interface')

    // Keep this and fail early
    if (
      typeof args.getAddress !== 'function' ||
      typeof args.sendTransaction !== 'function' ||
      typeof args.initiatePaymentChannel !== 'function' ||
      typeof args.createMicroPayment !== 'function' ||
      typeof args.store !== 'object' ||
      typeof args.paymentChannelServices !== 'object'
    ) {
      throw new Error("You need to define 'getAddress' function, 'sendTransaction' function, 'initiatePaymentChannel' function, 'createMicroPayment' function and a 'store' object.")
    }

    this.getAddress = args.getAddress
    this.sendTransaction = args.sendTransaction
    this.initiatePaymentChannel = args.initiatePaymentChannel
    this.createMicroPayment = args.createMicroPayment
    this.store = args.store
    this.paymentChannelServices = args.paymentChannelServices

    // dummy screen to avoid trouble
    this.screen = new DummyScreen()
    this.isShuttingDown = false

    this._init()

    // Catch keys pressed
    process.stdin.on('data', (key) => {
      if (this.screen.keyPressed(key)) {
        switch (key) {
          case KEYS.CTRL_C:
            this.stop()
            break
          case KEYS.RETURN:
            this.displayMainScreen()
            break
        }
      }
    })
  }

  _init () {
    // Remove cursor
    process.stdout.write(terminalStyle.NO_CURSOR)
    process.stdout.write('\x1b]0;Dogecoin SPV node wallet\x07')

    // without this, we would only get streams once enter is pressed
    process.stdin.setRawMode(true)

    // resume stdin in the parent process (node app won't quit all by itself
    // unless an error or process.exit() happens)
    process.stdin.resume()

    // Could be usefull to get unicode but I am not sured
    process.stdin.setEncoding('utf-8')
  }

  stop () {
    // Need to have screen unlock (so no update)
    this.isShuttingDown = true

    if (this.screen.lock) {
      this.screen.on('unlock', this._quit.bind(this))
    } else {
      this.screen.lock = true
      this._quit()
    }
  }

  _quit () {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines - 1), () => {
      process.stdout.write(`${terminalStyle.CLEAR}${terminalStyle.SHOW_CURSOR}`)
      // clean screen then quit
      this.emit('quit')
    })
  }

  showMnemonicScreen (mnemonic) {
    this.displayMnemonicScreen(mnemonic)
  }

  showMainScreen () {
    this.displayMainScreen()
  }

  displayMnemonicScreen (mnemonic) {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines - 1), () => {
      process.stdout.write(terminalStyle.CLEAR)

      // Update screen
      this.screen = new MnemonicScreen(mnemonic)
    })
  }

  displaySendDogeScreen () {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines - 1), () => {
      process.stdout.write(terminalStyle.CLEAR)

      // Update screen
      this.screen = new SendDogeScreen({ sendTransaction: this.sendTransaction, store: this.store })
    })
  }

  displayNewAddressScreen () {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines - 1), async () => {
      process.stdout.write(terminalStyle.CLEAR)

      // Update screen
      const address = await this.getAddress()
      this.screen = new NewAddressScreen({ address })
    })
  }

  displayPaymentChannelScreen () {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines - 1), async () => {
      process.stdout.write(terminalStyle.CLEAR)

      // Update screen
      this.screen = new PaymentChannelScreen({ initiatePaymentChannel: this.initiatePaymentChannel, paymentChannelUrl: this.paymentChannelServices[0] })
    })
  }

  displayMicroPaymentScreen () {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines - 1), async () => {
      process.stdout.write(terminalStyle.CLEAR)

      // Update screen
      this.screen = new MicroPaymentScreen({
        createMicroPayment: this.createMicroPayment,
        address: this.store.paymentChannels[0].address,
        displayMainScreen: this.displayMainScreen.bind(this),
        paymentChannelServices: this.paymentChannelServices[0]
      })
    })
  }

  displayMainScreen () {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines - 1), () => {
      process.stdout.write(terminalStyle.CLEAR)
      this.screen = new MainScreen({
        store: this.store,
        displayNewAddressScreen: this.displayNewAddressScreen.bind(this),
        displaySendDogeScreen: this.displaySendDogeScreen.bind(this),
        displayPaymentChannelScreen: this.displayPaymentChannelScreen.bind(this),
        displayMicroPaymentScreen: this.displayMicroPaymentScreen.bind(this),
        stop: this.stop.bind(this)
      })
      // TODO: This ugly
      process.stdout.write(this.screen.format(
        this.store.height,
        this.store.bestHeight,
        this.store.hash,
        this.store.getNumPeers(),
        this.store.tips,
        this.store.merkleHeight,
        this.store.balance,
        this.store.paymentChannels
      ))
    })
  }
}

module.exports = Interface

const constants = require('../constants')
const KEYS = require('./keys')
const terminalStyle = require('./terminalStyle')
const EventEmitter = require('events')
const debug = require('debug')('interface')
const MainScreen = require('./screens/mainScreen')


// TODO: rename to screen and instead of INDEX call it MAIN
const WINDOWS = {
  INDEX: 0,
  GENERATE_ADDRESS: 1,
  SEND_DOGECOINS: 2
}

const TO_ADDRESS = 'n3p9T8GtBwC6DSK1neCuE1XPs7ftroRx63'
// We send two dogecoins
const AMOUNT = 2*constants.SATOSHIS

const MENU_PREFIX = `${terminalStyle.WHITE_BACKGROUND}${terminalStyle.BLACK}${terminalStyle.BOLD}`
const MENU_SUFFIX = terminalStyle.RESET


// Interface
class Interface extends EventEmitter {

  numberOfLines = 0
  cursorPosition = 0
  lock = false
  screen = null
  window = WINDOWS.INDEX

  // FIXME
  menuSelection = {
    '0': '',
    '1': '',
    '2': '',
    'currentPosition': 0
  }

  isShuttingDown = false

  constructor (args) {
    super()

    if (typeof args.getAddress !== 'function' || typeof args.sendTransaction !== 'function' || typeof args.store !== 'object') {
      throw new Error("You need to define 'getAddress' function, 'sendTransaction' function and a 'store' object.")
    }

    this.getAddress = args.getAddress
    this.sendTransaction = args.sendTransaction
    this.store = args.store

    this.screen = new MainScreen({store: args.store})
    this._init()

    this.store.on('rejected', () => {
      if (this.window === WINDOWS.SEND_DOGECOINS) {
        if (this.store.rejectMessage.message === 'tx') {
          let rejectMsg = `${this.store.rejectMessage.reason} (CODE ${this.store.rejectMessage.code})`
          this._displaySendDogecoinsWindow(rejectMsg)
        }
      }
    })

    // Catch keys pressed
    process.stdin.on('data', (key) => {

      switch (key) {
        case KEYS.CTRL_C:
          this._stop()
          break
        case KEYS.NUM_KEY_1:
          this.window = WINDOWS.GENERATE_ADDRESS
          this._displayGenerateAddressWindow()
          break
        case KEYS.NUM_KEY_2:
          this.window = WINDOWS.SEND_DOGECOINS
          this._displaySendDogecoinsWindow()
          break
        case KEYS.NUM_KEY_3:
          this._stop()
          break
        case KEYS.RETURN:
          if (this.window == WINDOWS.INDEX) { break }
          this.window = WINDOWS.INDEX
          process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines-1), () => {
            process.stdout.write(terminalStyle.CLEAR)
            process.stdout.write(this.screen.format(
              this.store.height,
              this.store.bestHeight,
              this.store.hash,
              this.store.getNumPeers(),
              this.store.tips,
              this.store.merkleHeight,
              this.store.balance
            ))
          })
          break
          
          
      }

      if (this.window === WINDOWS.SEND_DOGECOINS) {
        this._evaluateSendDogecoinWindowKeys(key)
      }

    })
  }

  _init () {
    // Remove cursor
    process.stdout.write(terminalStyle.NO_CURSOR)
    process.stdout.write('\x1b]0;Dogecoin SPV node wallet\x07')

    process.stdout.write(this.screen.format())

    // without this, we would only get streams once enter is pressed
    process.stdin.setRawMode(true)

    // resume stdin in the parent process (node app won't quit all by itself
    // unless an error or process.exit() happens)
    process.stdin.resume()

    // Could be usefull to get unicode but I am not sured
    process.stdin.setEncoding('utf-8')
  }

  _stop () {
    // Need to have screen unlock (so no update)
    this.isShuttingDown = true

    if (this.screen.lock) {
      this.screen.on('unlock', this._quit)
    } else {
      this.screen.lock = true
      this._quit()
    }
  }

  _quit () {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines-1), () => {
      process.stdout.write(`${terminalStyle.CLEAR}${terminalStyle.SHOW_CURSOR}`)
      // clean screen then quit
      this.emit('quit')
    })
  }

  _evaluateSendDogecoinWindowKeys (key) {
    switch (key) {
      case KEYS.ENTER:
        this.sendTransaction(AMOUNT, TO_ADDRESS)
        break
      default:
        return
    }
  }

  _displaySendDogecoinsWindow (rejectMessage = '') {
    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines-1), () => {
      process.stdout.write(terminalStyle.CLEAR)

      const layout = `
================ SEND DOGECOINS ================
    ${rejectMessage}

    Current balance: ${this.store.balance/constants.SATOSHIS} Ð

    Amount: ${AMOUNT/constants.SATOSHIS} Ð
    To: ${TO_ADDRESS}


    Press "Enter" to send
    Press "Return" to return to main screen
`
      this.numberOfLines = layout.split('\n').length

      process.stdout.write(layout)
    })
  }

  _displayGenerateAddressWindow () {
    let address = this.getAddress()

    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines-1), () => {
      process.stdout.write(terminalStyle.CLEAR)

      const layout = `
================ NEW ADDRESS DOGECOIN ================

    Your address :
    ${address}

    Press "Return" to return to main screen
`
      this.numberOfLines = layout.split('\n').length

      process.stdout.write(layout)
    })
  }

}

module.exports = Interface;

const constants = require('../constants')
const KEYS = require('./keys')
const terminalStyle = require('./terminalStyle')
const EventEmitter = require('events')
const debug = require('debug')('interface')

const {
  MainScreen,
  NewAddressScreen,
  SendDogeScreen,
  MnemonicScreen,
  DummyScreen
} = require('./screens/')

// Interface
class Interface extends EventEmitter {

  screen = null
  isShuttingDown = false

  constructor (args) {
    super()

    // Keep this and fail early
    if (
      typeof args.getAddress !== 'function' ||
      typeof args.sendTransaction !== 'function' ||
      typeof args.store !== 'object'
    ) {
      throw new Error("You need to define 'getAddress' function, 'sendTransaction' function and a 'store' object.")
    }

    this.getAddress = args.getAddress
    this.sendTransaction = args.sendTransaction
    this.store = args.store
    
    // dummy screen to avoid trouble
    this.screen = new DummyScreen()
    
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

  stop = () => {
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
  
  showMnemonicScreen (mnemonic) {
    this.displayMnemonicScreen(mnemonic)
  }
  
  showMainScreen () {
    this.displayMainScreen()
  }
  
  displayMnemonicScreen = (mnemonic) => {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines-1), () => {
      process.stdout.write(terminalStyle.CLEAR)

      // Update screen
      this.screen = new MnemonicScreen(mnemonic)
    })
  }

  displaySendDogeScreen = () => {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines-1), () => {
      process.stdout.write(terminalStyle.CLEAR)

      // Update screen
      this.screen = new SendDogeScreen({sendTransaction: this.sendTransaction, store: this.store})
    })
  }

  displayNewAddressScreen = () => {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines-1), () => {
      process.stdout.write(terminalStyle.CLEAR)
      
      // Update screen
      this.screen = new NewAddressScreen({getAddress: this.getAddress})
    })
  }

  displayMainScreen = () => {
    process.stdout.moveCursor(this.screen.cursorPosition, -(this.screen.numberOfLines-1), () => {
      process.stdout.write(terminalStyle.CLEAR)
      this.screen = new MainScreen({
        store: this.store,
        displayNewAddressScreen: this.displayNewAddressScreen,
        displaySendDogeScreen: this.displaySendDogeScreen,
        stop: this.stop
      })
      // TODO: This ugly
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
  }

}

module.exports = Interface

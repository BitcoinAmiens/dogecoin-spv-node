const constants = require('../constants')
const KEYS = require('./keys')
const terminalStyle = require('./terminalStyle')
const EventEmitter = require('events')
const debug = require('debug')('interface')

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

    this._init()

    this.store.on('changed', () => {
      this.update()
    })
    
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

        // FIXME: the delay can be annoying so we let this down for now
        /*case KEYS.UP:
          this._updateMenuSelection(-1)
          break
        case KEYS.DOWN:
          this._updateMenuSelection(1)
          break*/
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
            process.stdout.write(this.format(
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

    process.stdout.write(this.format())

    // without this, we would only get streams once enter is pressed
    process.stdin.setRawMode(true)

    // resume stdin in the parent process (node app won't quit all by itself
    // unless an error or process.exit() happens)
    process.stdin.resume()

    // Could be usefull to get unicode but I am not sured
    process.stdin.setEncoding('utf-8')
  }

  _unlock () {
    this.lock = false
    this.emit('unlock')
  }

  _stop () {
    // Need to have screen unlock (so no update)
    this.isShuttingDown = true

    if (this.lock) {
      this.on('unlock', this._quit)
    } else {
      this.lock = true
      this._quit()
    }
  }

  _quit () {
    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines-1), () => {
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


  // FIXME: the delay can be annoying so we let this down for now
  _updateMenuSelection (direction) {

    // get current position
    let newPosition = (this.menuSelection['currentPosition'] + direction) % 3

    if (newPosition < 0) {
      newPosition = 2
    }

    console.log("NEW POSITION : " + newPosition)

    // clean
    // FIXME
    this.menuSelection['0'] = ''
    this.menuSelection['1'] = ''
    this.menuSelection['2'] = ''

    this.menuSelection['currentPosition'] = newPosition
    this.menuSelection[newPosition] = MENU_PREFIX

  }

  // Update interface
  update () {
    if (this.lock) { return }
    if (this.window !== WINDOWS.INDEX) { return }

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

    1. ${this.menuSelection['0']}Generate a new address${MENU_SUFFIX}
    2. ${this.menuSelection['1']}Send dogecoins${MENU_SUFFIX}
    3. ${this.menuSelection['2']}Quit${MENU_SUFFIX}
`
    this.numberOfLines = layout.split('\n').length

    return layout
  }

}

module.exports = Interface;

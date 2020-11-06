const EventEmitter = require('events')
const constants = require('../../constants')
const KEYS = require('../keys')
const debug = require('debug')('sendDogeScreen')

const TO_ADDRESS = 'n3p9T8GtBwC6DSK1neCuE1XPs7ftroRx63'
// We send two dogecoins
const AMOUNT = 2*constants.SATOSHIS

class SendDogeScreen extends EventEmitter {
  numberOfLines = 0
  cursorPosition = 0
  lock = false
  
  constructor (args) {
    super()
    
    if (typeof args.sendTransaction !== 'function'|| typeof args.store !== 'object') {
      throw new Error("You need to define a 'sendTransaction' function and a 'store' object.")
    }
    
    this.sendTransaction = args.sendTransaction
    this.store = args.store
    
    this.update()
    
    // TODO: `rejected` event should throw error message instead of retrieving it from store
    this.store.on('rejected', () => {
      if (this.store.rejectMessage.message === 'tx') {
        let rejectMsg = `${this.store.rejectMessage.reason} (CODE ${this.store.rejectMessage.code})`
        process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines-1), () => {
          this.update(rejectMsg)
        })
      }
    })
    
    // Catch keys pressed
    process.stdin.on('data', (key) => {
      
      switch (key) {
        case KEYS.ENTER:
          this.sendTransaction(AMOUNT, TO_ADDRESS)
          break
        default:
          return
      }
    })
  }
  
  update (rejectMessage = '') {
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
  }
}

module.exports = SendDogeScreen

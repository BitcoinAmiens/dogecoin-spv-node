const Screen = require('./screen')
const constants = require('../../constants')
const KEYS = require('../keys')
const debug = require('debug')('sendDogeScreen')
const terminalStyle = require('../terminalStyle')
const clipboardy = require('clipboardy')

const InputFields = {
  None: 0,
  AmountField: 1,
  AddressField: 2, 
}

class SendDogeScreen extends Screen {
  //toAddress = 'n3p9T8GtBwC6DSK1neCuE1XPs7ftroRx63'
  address = '__________________'
  amount = '0'
  selected = InputFields.None
  
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
  }
  
  keyPressed (key) {
    let selected
    
    switch (key) {
      case KEYS.UP:
        selected = this.selected-1<0 ? 2 : this.selected-1
        this.setSelected(selected)
        break
      case KEYS.DOWN:
        selected = this.selected+1>2 ? 0 : this.selected+1
        this.setSelected(selected)
        break
      case KEYS.CTRL_V:
        this.pasteAddress()
        break
      case KEYS.ENTER:
        this.sendTransaction(this.amount, this.address)
        break
      default:
        return this.modifyInputsField(key)
    }
  }
  
  // TODO: create an abstract input class for this
  modifyInputsField (key) {
    switch (this.selected) {
      case InputFields.AmountField:
        let amount = this.amount
        if (key === KEYS.RETURN && this.amount.length > 0) {
          amount = this.amount.slice(0,-1)
        } else {
          if (key in ['\u0030', '\u0031', '\u0032', '\u0033', '\u0034', '\u0035', '\u0036', '\u0037', '\u0038', '\u0039']) {
            // If not a number someone is drunk
            if (this.amount === '_') {
              amount = key
            } else {
              amount = this.amount + key
            }
          }
        }
        
        if (amount.length === 0) { amount = '_'}
        
        debug(amount)
        this.setAmount(amount)
        return false
      case InputFields.AddressField:
        return false
      default:
        return true
    }
  }
  
  setSelected (newValue) {
    this.selected = newValue
        
    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines-1), () => {
      this.update()
    })
  }
  
  setAddress (newAddress) {
    this.address = newAddress

    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines-1), () => {
      this.update()
    })
  }
  
  setAmount (newAmount) {
    this.amount = newAmount
  
    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines-1), () => {
      this.update()
    })
  }
  
  update (rejectMessage = '') {
    debug("UPDATE")
    const layout = `
================ SEND DOGECOINS ================
  ${rejectMessage}

  Current balance: ${this.store.balance/constants.SATOSHIS} Ð                   

  Amount: ${this.renderAmountField()} Ð                                         
  To: ${this.renderToField()}

  TIP: Do CTRL+V to copy address in the 'To' field.

  Press "Enter" to send
  Press "Return" to return to main screen
`
    this.numberOfLines = layout.split('\n').length
    
    process.stdout.write(layout)
  }
  
  renderToField () {
    if (this.selected === InputFields.AddressField) {
      return `${terminalStyle.WHITE_BACKGROUND}${terminalStyle.BLACK}${terminalStyle.BOLD}${this.address}${terminalStyle.RESET}`
    }
    return this.address
  }
  
  renderAmountField () {
    if (this.selected === InputFields.AmountField) {
      return `${terminalStyle.WHITE_BACKGROUND}${terminalStyle.BLACK}${terminalStyle.BOLD}${this.amount}${terminalStyle.RESET}`
    }
    
    return this.amount
  }
  
  pasteAddress () {
    const address = clipboardy.readSync()
    // TODO: Verify address is valid
    this.setAddress(address)
  }
  
}

module.exports = SendDogeScreen

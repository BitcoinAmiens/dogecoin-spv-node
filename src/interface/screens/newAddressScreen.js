const EventEmitter = require('events')

class NewAddressScreen extends EventEmitter {
  numberOfLines = 0
  cursorPosition = 0
  lock = false
  
  constructor (args) {
    super()
    
    if (typeof args.getAddress !== 'function') {
      throw new Error("You need to define a 'getAddress' function.")
    }
    
    this.address = args.getAddress()

    this.update()
  }
  
  update () {
    const layout = `
================ NEW ADDRESS DOGECOIN ================

  Your address :
  ${this.address}

  Press "Return" to return to main screen
`
    this.numberOfLines = layout.split('\n').length

    process.stdout.write(layout)
  }
  
  
}

module.exports = NewAddressScreen

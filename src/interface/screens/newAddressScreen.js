const Screen = require('./screen')
const debug = require('debug')('newAddressScreen')

class NewAddressScreen extends Screen {
  constructor (args) {
    super()
    
    if (typeof args.getAddress !== 'function') {
      throw new Error("You need to define a 'getAddress' function.")
    }
    
    this.address = args.getAddress()

    this.update()
  }
  
  keyPressed (key) {
    debug(key)
    return
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

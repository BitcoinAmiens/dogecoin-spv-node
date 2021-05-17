const Screen = require('./screen')
const debug = require('debug')('newAddressScreen')

class NewAddressScreen extends Screen {
  constructor (args) {
    super()

    debug('Initiating new adddress screen')

    if (typeof args.address !== 'string') {
      throw new Error('No address.')
    }

    this.address = args.address

    this.update()
  }

  keyPressed (key) {
    return true
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

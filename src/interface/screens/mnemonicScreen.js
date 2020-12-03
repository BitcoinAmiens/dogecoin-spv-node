const Screen = require('./screen')
const debug = require('debug')('mnemonicScreen')
const KEYS = require('../keys')

class MnemonicScreen extends Screen {
  constructor (mnemonic) {
    super()

    if (typeof mnemonic !== 'string') {
      throw new Error('Missing `mnemonic` string argument.')
    }

    debug('Mnemonic Screen !')

    this.mnemonic = mnemonic
    this.continue = false

    this.update()
  }

  keyPressed (key) {
    switch (key) {
      case KEYS.ENTER:
        this.continue = true
        return false
      case KEYS.RETURN:
        // Overide default behavior
        return false
      default:
        return true
    }
  }

  update () {
    // TODO: don't cut word when showing message (making had to read)
    const layout = `
================ MNEMONIC ================

  !!! Important !!!
  This will be shown it to you only once. Please save the following 12 words somewhere safe for backup!

  Mnemonic :
  ${this.mnemonic}

  Press "Enter" to continue
`
    this.numberOfLines = layout.split('\n').length

    process.stdout.write(layout)
  }
}

module.exports = MnemonicScreen

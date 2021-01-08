const EventEmitter = require('events')

/*
  Abstract class to help define a screen.
*/
class Screen extends EventEmitter {
  constructor () {
    super()

    this.numberOfLines = 0
    this.cursorPosition = 0
    this.lock = false
  }

  keyPressed (key) {
    throw new TypeError('`keyPressed` function has to be defined.')
  }

  update () {
    throw new TypeError('`update` function has to be defined.')
  }
}

module.exports = Screen

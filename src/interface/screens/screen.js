const EventEmitter = require('events')

/* 
  Abstract class to help define a screen.
*/
class Screen extends EventEmitter{
  numberOfLines = 0
  cursorPosition = 0
  lock = false
  
  constructor () {
    super()
  }
  
  keyPressed (key) {
    throw new TypeError("`keyPressed` function has to be defined.")
  }
  
  update () {
    throw new TypeError("`update` function has to be defined.")
  }
  
}

module.exports = Screen
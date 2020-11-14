const EventEmitter = require('events')
const Screen = require('./screen')

/* 
  Dummy Screen... Doesn't show anything.
*/
class DummyScreen extends Screen {
  constructor () {
    super()
  }
  
  keyPressed (key) {
    return true
  }
  
  update () {
  }
  
}

module.exports = DummyScreen
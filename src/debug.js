var debug = require('debug')
const fs = require('fs')
const { Console } = require('console')

function setupLog () {
  // TODO: get from settings file
  const output = fs.createWriteStream('./stdout.log')
  const errorOutput = fs.createWriteStream('./stderr.log')

  console = new Console({ stdout: output, stderr: errorOutput })

  // Special need stuff for debug
  debug.log = console.log.bind(console)
}

module.exports = { setupLog }

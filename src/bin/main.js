#!/usr/bin/env node
const meow = require('meow')
const app = require('../app')
const networks = require('../network')

const cli = meow(`
    !!! Important !!!
    This is a beta version. It only support regtest and testnet network.
  
    Usage
      $ dogecoin-spv <command>
      
    Commands
      start          Start the spv node

    Options
      --regtest, -r  Start in regtest mode

    Examples
      $ dogecoin-spv start --regtest
      
`, {
    flags: {
        regtest: {
            type: 'boolean',
            alias: 'r'
        }
    }
})

if (cli.input[0] !== 'start') {
  cli.showHelp()
}

var network = networks.TESTNET

if (cli.flags.regtest) {
  network = networks.REGTEST
}

app({network})
  .catch(function (err) {
    console.error(err)
  })

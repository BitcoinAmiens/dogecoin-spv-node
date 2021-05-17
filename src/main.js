const app = require('./app')
const debug = require('debug')('main')

const network = process.env.NETWORK
const dev = process.env.DEV

app({ network, dev })
  .catch(function (err) {
    debug(err)
  })

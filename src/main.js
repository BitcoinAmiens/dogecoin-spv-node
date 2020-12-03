const app = require('./app')
const debug = require('debug')('main')

const network = process.env.NETWORK

app({ network, dev: true })
  .catch(function (err) {
    debug(err)
  })

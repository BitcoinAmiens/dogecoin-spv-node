const app = require('./app')
const debug = require('debug')('main')

const network = process.env.NETWORK

app({network})
  .catch(function (err) {
    debug(err)
  })

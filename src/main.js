const app = require('./app')

app()
  .catch(function (err) {
    debug(err)
  })

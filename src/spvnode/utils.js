const dns = require('dns')

function getDnsSeed (host) {
  return new Promise(function (resolve) {
    dns.resolve(host, 'A', (err, result) => {
      if (err) {
        // Ignore if it fails
        resolve([])
        return
      }

      resolve(result)
    })
  })
}

module.exports = {
  getDnsSeed
}

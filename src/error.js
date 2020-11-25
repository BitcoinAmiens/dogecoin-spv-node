
class OSNotSupported extends Error {
  constructor(platform) {
    super(`Platform ${platform} not supported.`)
    this.name = 'OSNotSupported'
  }
}

module.exports = {
  OSNotSupported
}
const level = require('level')
const path = require('path')

class SPVNodeDB {
  constructor (settings) {
    this.settings = settings

    this.headers = level(path.join(settings.DATA_FOLDER, 'spvnode', 'headers'), { valueEncoding: 'json' })
    this.merkles = level(path.join(settings.DATA_FOLDER, 'spvnode', 'merkles'), { valueEncoding: 'json' })
    this.tips = level(path.join(settings.DATA_FOLDER, 'spvnode', 'tips'), { valueEncoding: 'json' })
  }

  async getTips () {
    const tips = new Map()
    await new Promise((resolve, reject) => {
      this.tips.createReadStream()
        .on('data', (data) => {
          tips.set(data.key, data.value)
        })
        .on('error', function (err) { reject(err) })
        .on('end', function () { resolve() })
    })
    return tips
  }

  getHeight () {
    return this.headers.get('height')
      .catch((err) => {
        if (err && err.type === 'NotFoundError') {
          return { height: 0, hash: this.settings.GENESIS_BLOCK_HASH }
        }
        throw err
      })
  }

  getMerkleHeight () {
    return this.merkles.get('height')
      .catch((err) => {
        if (err && err.type === 'NotFoundError') {
          return { height: 0, hash: this.settings.GENESIS_BLOCK_HASH }
        }
        throw err
      })
  }

  putMerklesHeight (height, hash) {
    return this.merkles.put('height', { height, hash })
  }

  putHeight (height, hash) {
    return this.headers.put('height', { height, hash })
  }

  putTips (tips) {
    const promise = new Promise((resolve, reject) => {
      const ops = []
      tips.forEach((value, key) => {
        ops.push({
          type: 'put',
          key,
          value
        })
      })

      this.tips.clear(() => {
        this.tips.batch(ops, (err) => {
          if (err) throw err
          resolve()
        })
      })
    })
    return promise
  }

  getHeader (hash) {
    return this.headers.get(hash)
      .catch((err) => {
        if (err && err.type === 'NotFoundError') {
          return null
        }
        throw err
      })
  }

  putHeader (header) {
    return this.headers.put(header.hash, header)
  }

  batchHeaders (ops) {
    return this.headers.batch(ops)
  }
}

module.exports = SPVNodeDB

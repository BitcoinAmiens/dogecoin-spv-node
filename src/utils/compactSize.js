// REVIEW: Should it be a class or just functions ?
class CompactSize {
  constructor (size, offset) {
    this.size = size
    this.offset = offset
  }

  static fromBuffer (data, offset) {
    const firstByte = data.slice(offset, offset + 1)

    if (firstByte.size < 1) {
      throw new Error('Cannot read first byte because too small')
    }

    this.offset = offset + 1

    switch (firstByte.toString('hex')) {
      case 'fd':
        this.size = data.readUInt16LE(this.offset)
        this.offset += 2
        break
      case 'fe':
        this.size = data.readUInt32LE(this.offset)
        this.offset += 4
        break
      case 'ff':
        this.size = data.readBigUInt64LE(this.offset)
        this.offset += 8
        break
      default:
        this.size = firstByte.readUInt8(0)
    }

    this.offset = this.offset - offset

    return new this(this.size, this.offset)
  }

  static fromSize (size) {
    let buffer
    let sizeByte

    if (size <= 252) {
      buffer = Buffer.alloc(1)
      buffer.writeUInt8(size, 0)
    } else if (size <= 65535) {
      buffer = Buffer.alloc(3)
      sizeByte = Buffer.from('fd', 'hex')
      sizeByte.copy(buffer)
      buffer.writeUInt16LE(size, 1)
    } else if (size <= 4294967295) {
      buffer = Buffer.alloc(5)
      sizeByte = Buffer.from('fe', 'hex')
      sizeByte.copy(buffer)
      buffer.writeUInt32LE(size, 1)
    } else if (size <= 18446744073709552000) {
      buffer = Buffer.alloc(9)
      sizeByte = Buffer.from('ff', 'hex')
      sizeByte.copy(buffer)
      buffer.writeBigInt64LE(size, 1)
    }
    return buffer
  }
}

module.exports = CompactSize

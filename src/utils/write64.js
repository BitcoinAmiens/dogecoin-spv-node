function write64 (dst, num, off, be) {
  let neg = false

  if (num < 0) {
    num = -num
    neg = true
  }

  let hi = (num * (1 / 0x100000000)) | 0
  let lo = num | 0

  if (neg) {
    if (lo === 0) {
      hi = (~hi + 1) | 0
    } else {
      hi = ~hi
      lo = ~lo + 1
    }
  }

  if (be) {
    off = dst.writeInt32BE(hi, off, true)
    off = dst.writeInt32BE(lo, off, true)
  } else {
    off = dst.writeInt32LE(lo, off, true)
    off = dst.writeInt32LE(hi, off, true)
  }

  return off
}

module.exports = write64

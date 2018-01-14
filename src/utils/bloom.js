const BYTES_MAX = 36000
const FUNCS_MAX = 50

const nFlags = 0

const n = 1
const p = 0.0001

var nFilterBytes = Math.floor(Math.min((-1 / Math.log(2)**2 * n * Math.log(p)) / 8, BYTES_MAX))
var nHashFuncs = Math.floor(Math.min(nFilterBytes * 8 / n * Math.log(2), FUNCS_MAX))

console.log(nFilterBytes)
console.log(nHashFuncs)

var vData = Buffer.alloc(nFilterBytes)

console.log(vData)

const data = require('./data')
const data2 = require('./data2')
const data3 = require('./data3')
const headers = require('../../src/commands/headers')

var payload = Buffer.from(data.payload, 'hex')

var result = headers.decodeHeadersMessage(payload)

// passed
// console.log(result)

payload = Buffer.from(data2.payload, 'hex')

result = headers.decodeHeadersMessage(payload)

// passed
// console.log(result)

payload = Buffer.from(data3.payload, 'hex')

result = headers.decodeHeadersMessage(payload)

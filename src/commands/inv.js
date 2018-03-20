const CompactSize = require('../utils/compactSize')

function decodeInvMessage (data) {
  var invMessage = {}

  var compactSize = CompactSize.fromBuffer(data, 0)

  var count = compactSize.size
  var offset = compactSize.offset

  console.log(count)

  var inventories = []
  for (var i = 0; i < count; i++) {
    var type = data.slice(offset, offset + 4)
    offset += 4
    var inventory = {}

    // Get inventory type (https://en.bitcoin.it/wiki/Protocol_documentation#Inventory_Vectors)
    switch (type.toString('hex')) {
      case '00000000':
        console.log('ERROR')
        break
      case '01000000':
        // console.log('MSG_TX')
        inventory.type = 'MSG_TX'
        break
      case '02000000':
        // console.log('MSG_BLOCK')
        inventory.type = 'MSG_BLOCK'
        break
      case '03000000':
        // console.log('MSG_FILTERED_BLOCK')
        inventory.type = 'MSG_FILTERED_BLOCK'
        break
      case '04000000':
        // console.log('MSG_CMPCT_BLOCK')
        inventory.type = 'MSG_CMPCT_BLOCK'
        break
      default:
        console.log('Error : Unknown type')
    }

    var hashBuffer = data.slice(offset, offset + 32)

    inventory.hash = hashBuffer.toString('hex')
    offset += 32

    inventories.push(inventory)
  }

  invMessage.count = count
  invMessage.inventory = inventories

  return invMessage
}

function encodeInvMessage (data) {
  var compactSizeBuffer = CompactSize.fromSize(data.count)
  const buffer = new Buffer.alloc(36 * data.count + compactSizeBuffer.length)
  let offset = 0

  compactSizeBuffer.copy(buffer, offset)
  offset += compactSizeBuffer.length

  for (var i = 0; i < data.count; i++) {
    // We want MSG_FILTERED_BLOCK so the code is 3
    buffer.writeUInt32LE(3, offset)
    offset += 4

    const blockHashBuffer = Buffer.from(data.inventory[i].hash, 'hex')
    blockHashBuffer.copy(buffer, offset)
    offset += blockHashBuffer.length
  }

  return buffer
}

module.exports = { decodeInvMessage, encodeInvMessage }

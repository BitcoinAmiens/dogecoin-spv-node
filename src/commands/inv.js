const CompactSize = require('../utils/compactSize')

function decodeInvMessage (data) {
  const invMessage = {}

  const compactSize = CompactSize.fromBuffer(data, 0)

  const count = compactSize.size
  let offset = compactSize.offset

  const inventories = []
  for (let i = 0; i < count; i++) {
    const type = data.slice(offset, offset + 4)
    offset += 4

    const inventory = {}

    // Get inventory type (https://en.bitcoin.it/wiki/Protocol_documentation#Inventory_Vectors)
    switch (type.toString('hex')) {
      case '00000000':
        break
      case '01000000':
        inventory.type = 'MSG_TX'
        break
      case '02000000':
        inventory.type = 'MSG_BLOCK'
        break
      case '03000000':
        inventory.type = 'MSG_FILTERED_BLOCK'
        break
      case '04000000':
        inventory.type = 'MSG_CMPCT_BLOCK'
        break
      default:
        return
    }

    const hashBuffer = data.slice(offset, offset + 32)

    inventory.hash = hashBuffer.toString('hex')
    offset += 32

    inventories.push(inventory)
  }

  invMessage.count = count
  invMessage.inventory = inventories

  return invMessage
}

function encodeInvMessage (data, msgType) {
  const compactSizeBuffer = CompactSize.fromSize(data.count)
  const buffer = Buffer.alloc(36 * data.count + compactSizeBuffer.length)
  let offset = 0

  compactSizeBuffer.copy(buffer, offset)
  offset += compactSizeBuffer.length

  // Now we want block
  for (let i = 0; i < data.count; i++) {
    // We want MSG_FILTERED_BLOCK so the code is 3
    // If it is 2 we want MSG_BLOCK because we had a new block
    buffer.writeUInt32LE(msgType, offset)
    offset += 4

    const blockHashBuffer = Buffer.from(data.inventory[i].hash, 'hex')
    blockHashBuffer.copy(buffer, offset)
    offset += blockHashBuffer.length
  }

  return buffer
}

module.exports = { decodeInvMessage, encodeInvMessage }

const CompactSize = require('../utils/compactSize')

function decodeInvMessage (data) {
  var invMessage = {}

  var compactSize = CompactSize.fromBuffer(data, 0)

  var count = compactSize.size
  var offset = compactSize.offset

  var inventories = []
  for (var i = 0; i < count; i++) {
    var type = data.slice(offset, offset + 4)
    var inventory = {}

    // Get inventory type (https://en.bitcoin.it/wiki/Protocol_documentation#Inventory_Vectors)
    switch (type.toString('hex')) {
      case '00000000':
        console.log('ERROR')
        break
      case '01000000':
        console.log('MSG_TX')
        break
      case '02000000':
        console.log('MSG_BLOCK')
        break
      case '03000000':
        console.log('MSG_FILTERED_BLOCK')
        break
      case '04000000':
        console.log('MSG_CMPCT_BLOCK')
        break
      default:
        console.log('Error : Unknown type')
    }
  }

  invMessage.count = count

  return invMessage
}

module.exports = { decodeInvMessage }

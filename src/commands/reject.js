const CompactSize = require('../utils/compactSize')

function decodeRejectMessage (payload) {
  const rejectMessage = {}
  let offset = 0

  let compactSize = CompactSize.fromBuffer(payload, offset)

  rejectMessage.messageLength = compactSize.size
  offset = compactSize.offset

  const message = payload.slice(offset, offset + rejectMessage.messageLength)

  rejectMessage.message = message.toString()
  offset += rejectMessage.messageLength

  rejectMessage.code = payload.slice(offset, offset + 1).toString('hex')
  offset += 1

  compactSize = CompactSize.fromBuffer(payload, offset)

  rejectMessage.reasonLength = compactSize.size
  offset += compactSize.offset

  const reason = payload.slice(offset, offset + rejectMessage.reasonLength)

  rejectMessage.reason = reason.toString()
  offset += rejectMessage.reasonLength

  if (payload.length - offset > 0) {
    rejectMessage.extraData = payload.slice(offset, payload.length).toString('hex')
  }

  return rejectMessage
}

module.exports = { decodeRejectMessage }

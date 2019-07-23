const Wallet = require('../../src/wallet')
const { decodeTxMessage } = require('../../src/commands/tx')
const {write64} = require('../../src/utils/write64')
const tx = require('./tx')

const RIPEMD160 = require('ripemd160')
const crypto = require('crypto')

async function main () {
  // Create Wallet
  const wallet = new Wallet()

  // Get mnemonic
  //console.log(wallet._generateMnemonic())

  // Get mnemonic
  //console.log(wallet._getSeed())

  // connect to ledgerhq
  await wallet.connectToLedger()

  const address = await wallet.getAddress()

  console.log(address)

  var inputs = []

  let decodedTX = decodeTxMessage(Buffer.from(tx.data.tx_hex, 'hex'))

  // console.log(decodedTX)

  let transaction = wallet.splitTransaction(tx.data.tx_hex)

  /*transaction = {
    outputs: [
      {
        amount: Buffer.from('00e8764817000000', 'hex'),
        script: Buffer.from('76a91464b771bb1b4f4990f27686bef1832794fe67637888ac', 'hex')
      }
    ]
  }
  console.log(transaction)

  const outputScript = wallet.serializeTransactionOutputs(transaction)*/

  const outputScript = Buffer.from('0100e87648170000001976a91464b771bb1b4f4990f27686bef1832794fe67637888ac', 'hex')

  console.log(outputScript.toString('hex'))

  console.log(transaction)

  inputs.push([transaction, 0])

  var result = await wallet.createTransaction(inputs, ["44'/3'/0'/0/0"], "44'/3'/0'/0/0", outputScript.toString('hex'))
    .then((result) => {
      console.log(result)
    })
    .catch((err) => {
      console.log(err)
    })

    let pubKeyHash = crypto.createHash('sha256').update(address.publicKey).digest()
    pubKeyHash = new RIPEMD160().update(pubKeyHash).digest()

    console.log(pubKeyHash.toString('hex'))
}

main()

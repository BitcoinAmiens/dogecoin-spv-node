
var SPVNode = require('./src/spvnode')
const constants = require('./src/constants')
var Wallet = require('./src/wallet')
const RIPEMD160 = require('ripemd160')
const crypto = require('crypto')
const bs58check = require('bs58check')
const {prepareTransactionToSign, encodeRawTransaction} = require('./src/commands/tx')
const doubleHash = require('./src/utils/doubleHash')
const bip32 = require('bip32')
const secp256k1 = require('secp256k1')
const fs = require('fs')
const CompactSize = require('./src/utils/compactSize')
const { getAddressFromScript } = require('./src/utils/script')
const debug = require('debug')('main')

const NODE_IP = '192.168.50.4'

function sendTransaction (spvnode, wallet) {
  let amount = 2000 * constants.SATOSHIS
  let address = 'n3p9T8GtBwC6DSK1neCuE1XPs7ftroRx63'
  let changeAddress = 'n3X4XzsdnxitMsTmj8r3HMM84eCHuAJyMq'
  let indexToRedeem = 0
  let transactionsToRedeem = []
  let transaction = {
    version: 1,
    txInCount: 1,
    txIns: [],
    txOutCount: 2,
    txOuts: [],
    locktime: 0,
    hashCodeType: 1
  }

  let total = 0
  spvnode.unspentTxs.createReadStream()
    .on('data', function (data) {
      if (total < amount) {
        transactionsToRedeem.push(data.value)
        total += data.value.value
      }
    })
    .on('end', function () {
      let promises = []

      if (total < amount) {
        throw new Error('Not enought funds')
      }

      // Update txInCount value
      transaction.txInCount = transactionsToRedeem.length

      // Add every txIn we want to use
      transactionsToRedeem.forEach((txToRedeem, index) => {
        let promise = spvnode.txs.get(txToRedeem.txid)
          .then((value) => {
            transaction.txIns[index] = {
              previousOutput: { hash: txToRedeem.txid, index: txToRedeem.vout},
              // Temporary just so we can sign it (https://bitcoin.stackexchange.com/questions/32628/redeeming-a-raw-transaction-step-by-step-example-required/32695#32695)
              signature: Buffer.from(value.txOuts[txToRedeem.vout].pkScript.data, 'hex'),
              sequence: 4294967294
            }
          })
        promises.push(promise)
      })

      Promise.all(promises)
        .then(() => {

          let test = bs58check.decode(address).slice(1)
          let pkScript = Buffer.from('76a914'+ test.toString('hex') + '88ac', 'hex')

          transaction.txOuts[0] = {
            value: amount,
            pkScriptSize: pkScript.length,
            pkScript
          }

          test = bs58check.decode(changeAddress).slice(1)
          pkScript = Buffer.from('76a914'+ test.toString('hex') + '88ac', 'hex')

          if (total > amount) {
            transaction.txOuts[1] = {
              value: total - amount,
              pkScriptSize: pkScript.length,
              pkScript
            }
          }

          transaction.txOutCount = transaction.txOuts.length

          ////////////////////////////////////////////////////////////////

          for (let txInIndex = 0; txInIndex < transaction.txInCount; txInIndex++) {
            const rawUnsignedTransaction =  prepareTransactionToSign(transaction, txInIndex)
            const rawTransactionHash = doubleHash(rawUnsignedTransaction)

            // Which key ? Fuck
            const address = getAddressFromScript(transaction.txIns[txInIndex].signature)
            console.log(address)
            console.log(address.length)
            let index

            // We have pubkey hash
            // If public key compressed it should be 33 bytes (https://bitcoin.stackexchange.com/questions/2013/why-does-the-length-of-a-bitcoin-key-vary#2014)
            // TODO
            if (address.length === 20) {
              debug('PubKey Hash! Looking for index...')
              let value = wallet.pubkeyHashes.get(address.toString('hex'))
              index = value.index
            }
            
            const key = wallet.getPrivateKey(index)

            console.log(transaction.txIns[txInIndex].signature)
            let pubKeyHash = crypto.createHash('sha256').update(key.publicKey).digest()
            pubKeyHash = new RIPEMD160().update(pubKeyHash).digest()
            console.log(pubKeyHash)

            const signature = secp256k1.sign(Buffer.from(rawTransactionHash, 'hex'), key.privateKey)

            const signatureDer = secp256k1.signatureExport(signature.signature)

            let signatureCompactSize = CompactSize.fromSize(signatureDer.length+1)
            let publicKeyCompactSize = CompactSize.fromSize(key.publicKey.length)

            let scriptSig = signatureCompactSize.toString('hex') + signatureDer.toString('hex') + '01' + publicKeyCompactSize.toString('hex') + key.publicKey.toString('hex')

            transaction.txIns[txInIndex].signatureSize = CompactSize.fromSize(Buffer.from(scriptSig).length, 'hex')
            transaction.txIns[txInIndex].signature = Buffer.from(scriptSig, 'hex')

          }

          /*

          let rawUnsignedTransaction0 = prepareTransactionToSign(transaction, 0)
          let rawTransactionHash0 = doubleHash(rawUnsignedTransaction0)

          let rawUnsignedTransaction1 = prepareTransactionToSign(transaction, 1)
          let rawTransactionHash1 = doubleHash(rawUnsignedTransaction1)


          // Sign first txIn !!!!
          let key = wallet.getPrivateKey(1)

          const signature = secp256k1.sign(Buffer.from(rawTransactionHash0, 'hex'), key.privateKey)

          const signatureDer = secp256k1.signatureExport(signature.signature)

          let signatureCompactSize = CompactSize.fromSize(signatureDer.length+1)
          let publicKeyCompactSize = CompactSize.fromSize(key.publicKey.length)

          let scriptSig = signatureCompactSize.toString('hex') + signatureDer.toString('hex') + '01' + publicKeyCompactSize.toString('hex') + key.publicKey.toString('hex')

          console.log(transaction.txIns[0].signature)
          let pubKeyHash = crypto.createHash('sha256').update(key.publicKey).digest()
          pubKeyHash = new RIPEMD160().update(pubKeyHash).digest()
          console.log(pubKeyHash)

          transaction.txIns[0].signatureSize = CompactSize.fromSize(Buffer.from(scriptSig).length, 'hex')
          transaction.txIns[0].signature = Buffer.from(scriptSig, 'hex')

          if (transactionsToRedeem.length >= 2) {
            // Sign second txIn !!!!
            let key2 = wallet.getPrivateKey(0)
            const signature2 = secp256k1.sign(Buffer.from(rawTransactionHash1, 'hex'), key2.privateKey)

            const signatureDer2 = secp256k1.signatureExport(signature2.signature)

            let signature2CompactSize = CompactSize.fromSize(signatureDer2.length+1)
            let publicKey2CompactSize = CompactSize.fromSize(key2.publicKey.length)

            let scriptSig2 = signature2CompactSize.toString('hex') + signatureDer2.toString('hex') + '01' + publicKey2CompactSize.toString('hex') + key2.publicKey.toString('hex')

            transaction.txIns[1].signatureSize = CompactSize.fromSize(Buffer.from(scriptSig2).length, 'hex')
            transaction.txIns[1].signature = Buffer.from(scriptSig2, 'hex')
          }

          */

          delete transaction.hashCodeType

          let rawTransaction = encodeRawTransaction(transaction)

          console.log(rawTransaction.toString('hex'))

          spvnode.sendRawTransaction(rawTransaction)

        })
    })


  /*spvnode.txs.get('780ef87537e7406bf3dfca591a6cd81e2cbcb1805bf50c350d662cfb1547c3ac', (err, value) => {

      let txId = Buffer.from('780ef87537e7406bf3dfca591a6cd81e2cbcb1805bf50c350d662cfb1547c3ac', 'hex')
      let invHash = ''
      for (let i=0; i < txId.length; i++) {
        invHash = txId.slice(i, i+1).toString('hex') + invHash
      }

      transaction.txIns[0] = {
        previousOutput: { hash: '780ef87537e7406bf3dfca591a6cd81e2cbcb1805bf50c350d662cfb1547c3ac', index: indexToRedeem},
        // Temporary just so we can sign it (https://bitcoin.stackexchange.com/questions/32628/redeeming-a-raw-transaction-step-by-step-example-required/32695#32695)
        signature: Buffer.from(value.txOuts[indexToRedeem].pkScript.data, 'hex'),
        sequence: 4294967294
      }

      let test = bs58check.decode(address).slice(1)
      let pkScript = Buffer.from('76a914'+ test.toString('hex') + '88ac', 'hex')

      transaction.txOuts[0] = {
        value: amount,
        pkScriptSize: pkScript.length,
        pkScript
      }

      test = bs58check.decode(changeAddress).slice(1)
      pkScript = Buffer.from('76a914'+ test.toString('hex') + '88ac', 'hex')

      transaction.txOuts[1] = {
        value: value.txOuts[0].value - amount,
        pkScriptSize: pkScript.length,
        pkScript
      }

      transaction.locktime = 0
      transaction.hashCodeType = 1

      let rawUnsignedTransaction = prepareTransactionToSign(transaction)

      console.log(rawUnsignedTransaction.toString('hex'))


      let rawTransactionHash = doubleHash(rawUnsignedTransaction)

      console.log(rawTransactionHash.toString('hex'))

      let inv = ''
      for (let i=0; i < rawTransactionHash.length; i++) {
        inv = rawTransactionHash.slice(i, i+1).toString('hex') + inv
      }

      let key = wallet.getPrivateKey(0)
      const signature = secp256k1.sign(Buffer.from(rawTransactionHash, 'hex'), key.privateKey)

      const signatureDer = secp256k1.signatureExport(signature.signature)

      let signatureCompactSize = CompactSize.fromSize(signatureDer.length+1)
      let publicKeyCompactSize = CompactSize.fromSize(key.publicKey.length)

      let scriptSig = signatureCompactSize.toString('hex') + signatureDer.toString('hex') + '01' + publicKeyCompactSize.toString('hex') + key.publicKey.toString('hex')

      transaction.txIns[0].signatureSize = CompactSize.fromSize(Buffer.from(scriptSig).length, 'hex')
      transaction.txIns[0].signature = Buffer.from(scriptSig, 'hex')

      delete transaction.hashCodeType

      let rawTransaction = encodeRawTransaction(transaction)

      console.log(rawTransaction.toString('hex'))

    })*/
}


function main () {
  var wallet = new Wallet()

  // Create data folder
  if (!fs.existsSync(constants.DATA_FOLDER)) {
    fs.mkdirSync(constants.DATA_FOLDER)
  }

  // Get mnemonic
  console.log(wallet._generateMnemonic())

  // Get mnemonic
  console.log(wallet._getSeed())

  console.log(wallet._getMasterPrivKey())

  for (let i = 0; i < 20; i++) {
    // We need 20 addresses for bloom filter to protect privacy
    console.log(wallet.generateNewAddress())
  }

  let pubkeyHashes = []

  wallet.pubkeyHashes.forEach(function (value, key) {
    pubkeyHashes.push(key.toString('hex'))
  })

  var spvnode = new SPVNode(pubkeyHashes)

  spvnode.on('balanceUpdated', function (newBalance) {
    console.log('New Balance :', newBalance/constants.SATOSHIS)
    console.log('Total txs :', spvnode.totalTxs)
    console.log('Total spent :', spvnode.totalSpent/constants.SATOSHIS)
  })

  spvnode.on('synchronized', function () {
    console.log('Our node is synchronized')
    console.log('It actually is not, you might be missing merkle block and tx message')
    console.log('Total Balance :', (spvnode.balance-spvnode.totalSpent)/constants.SATOSHIS)
    setTimeout(() => {
      sendTransaction(spvnode, wallet)
    }, 5000)
  })

  spvnode.addPeer(NODE_IP, constants.DEFAULT_PORT)
    .then(() => {
      spvnode.synchronize()
    })

  /*spvnode.start()
    .then((result) => {
      spvnode.synchronize()
    })
    .catch(function (err) {
      console.log(err)
    })*/
}

main()

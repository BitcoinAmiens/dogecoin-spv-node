const SPVNode = require('../../src/spvnode')

var spvnode = new SPVNode()

var txs = [
  { id: '0ebef2b6610a60a67d3cf402910c8bbcce2484f3880660d4524fe64d228b6525',
  version: 1,
  txInCount: 1,
  txIns:
   [ { previousOutput:{
     hash: '3a541a89598bf18f8c91e215f5d34a6a3593406a50ff19b06d973ce974cd2b0e',
     index: '01000000'
   },
       signature: '00483045022100f3bacb52149dd35c0557cf7fef7b1a1b2cf6b873cd3e159339358c5dcbaaf9e10220024aec076bf759a059767ebb1e5b91b255da3baf3ba752547c0b778febf6a65001473044022020de5e98a14137eca5fd8f5b0319d63d67cceca02a11d3ff2499b4ad1873d82302202a42ac2bbb31fdcc7cc7207e979fb309484e85c7cc54a2b58a88e9555bee738e01475221020176c0969ea1da546e3e17ed27adb3bc5ca60db55ab82f589d71a106ae420d1a2103140d4277d956af24cfd93ae6dce19cafeeaaec74a4c6dafdf9bb09452bf9d83452ae',
       sequence: 4294967295 } ],
  txOutCount: 2,
  txOuts:
   [ { value: 200000000,
       pkScriptSize: 23,
       pkScript: Buffer.from('a914e4cfb997068492b2d4d046562172348fdf2db8d987', 'hex')},
     { value: 23126000000,
       pkScriptSize: 23,
       pkScript: Buffer.from('a9147f3960cf2d103962e0d84b8408f7b75cba13369887', 'hex')} ],
  locktime: 0 },
  { id: '3a541a89598bf18f8c91e215f5d34a6a3593406a50ff19b06d973ce974cd2b0e',
  version: 1,
  txInCount: 1,
  txIns:
   [ { previousOutput: { hash: '0000000000000000000000000000000000000000000000000000000000000000', index: 'ffffff'},
       signature: '00463043021f012e0d2145e5169e69c1f23fd52e1bfc421c6ed32be8a8c7522b4c120d3c0c022042246fb1cfe55b3f669c75dbcd1a311a84e9a1ee5c81fed77282945db50e9a67014730440220766e2260111c119e5f9933c74706c9f71e0a4399430f17b0fb0013814bbaaf5802201e7126df38fa8e277ee4982bfdaeb49890c91d8156f8adb1b58ff15d783ab26a01475221020176c0969ea1da546e3e17ed27adb3bc5ca60db55ab82f589d71a106ae420d1a2103140d4277d956af24cfd93ae6dce19cafeeaaec74a4c6dafdf9bb09452bf9d83452ae',
       sequence: 4294967295 } ],
  txOutCount: 2,
  txOuts:
   [ { value: 200000000,
       pkScriptSize: 23,
       pkScript: Buffer.from('a914e4cfb997068492b2d4d046562172348fdf2db8d987', 'hex')},
     { value: 23426000000,
       pkScriptSize: 23,
       pkScript: Buffer.from('a9147f3960cf2d103962e0d84b8408f7b75cba13369887', 'hex')} ],
  locktime: 0 }]

spvnode.updateTxs(txs[0])
spvnode.updateTxs(txs[1])

console.log(spvnode.balance)

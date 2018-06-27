var SPVNode = require('./src/spvnode')
const constants = require('./src/constants')

const NODE_IP = '127.0.0.1'
const NODE_PORT = 44556

function main () {
  var spvnode = new SPVNode()

  spvnode.on('balanceUpdated', function (newBalance) {
    console.log('New Balance :', newBalance/constants.SATOSHIS)
    console.log('Total txs :', spvnode.totalTxs)
    console.log('Total spent :', spvnode.totalSpent/constants.SATOSHIS)
  })

  spvnode.on('synchronized', function () {
    console.log('Our node is synchronized')
    console.log('Total Balance :', (spvnode.balance-spvnode.totalSpent)/constants.SATOSHIS)
  })

  spvnode.start()
    .then((result) => {
      spvnode.synchronize()
    })
    .catch(function (err) {
      console.log(err)
    })

}

main()

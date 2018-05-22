var SPVNode = require('./src/spvnode')

const NODE_IP = '127.0.0.1'
const NODE_PORT = 44556

function main () {
  var spvnode = new SPVNode()

  spvnode.start()
    .then((result) => {
      spvnode.synchronize()
    })
    .catch(function (err) {
      console.log(err)
    })

}

main()

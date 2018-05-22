var wallets = {
  regtest: {
    ADDRESSES: ['nZHyJJFsAndFzTEL7ijcAc98W8UU52uByD']
  },
  testnet: {
    ADDRESSES: ['nXoKWTPsRzSQDM6sTd2P2bc5gtgYB1xL1H', 'ndJDvHL5VW2mTFNvUcZqTBxUfVoY3Mf2Qb']
  }
}

var wallet = wallets.regtest

if (process.env.NETWORK === 'testnet') {
  wallet = wallets.testnet
}

module.exports = wallet

var wallets = {
  regtest: {
    ADDRESSES: ['nZHyJJFsAndFzTEL7ijcAc98W8UU52uByD']
  },
  testnet: {
    ADDRESSES: ['2NE74u1DgPH8h9GTmcxRxFfshL8jdnWm4UY'],
    //ADDRESSES: ['nXoKWTPsRzSQDM6sTd2P2bc5gtgYB1xL1H', 'ndJDvHL5VW2mTFNvUcZqTBxUfVoY3Mf2Qb', '2MsQug2PDbor2ndqYu9MxMij3MZFZ3EkGk9'],
    PUBKEYS: []
  }
}

var wallet = wallets.regtest

if (process.env.NETWORK === 'testnet') {
  wallet = wallets.testnet
}

module.exports = wallet

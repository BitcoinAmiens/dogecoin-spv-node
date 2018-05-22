var settings = {
  regtest: {
    PROTOCOL_VERSION: 70004,
    MAGIC_BYTES: 0xdab5bffa, //  0xdcb7c1fc
    SATOSHIS: 100000000,
    GENESIS_BLOCK_HASH: '3d2160a3b5dc4a9d62e7e66a295f70313ac808440ef7400d6c0772171ce973a5',
    DEFAULT_PORT: 18444
  },
  testnet: {
    PROTOCOL_VERSION: 70004,
    MAGIC_BYTES: 0xdcb7c1fc,
    SATOSHIS: 100000000,
    GENESIS_BLOCK_HASH: 'bb0a78264637406b6360aad926284d544d7049f45189db5664f3c4d07350559e',
    DNS_SEED: ['testseed.jrn.me.uk', 'testnets.chain.so', 'senatorwhiskers.com'],
    DEFAULT_PORT: 44556
  }
}

var constants = settings.regtest

if (process.env.NETWORK === 'testnet') {
  constants = settings.testnet
}

module.exports = constants

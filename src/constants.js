const constants = {
  regtest: {
    DATA_SUBFOLDER: 'regtest',
    MAGIC_BYTES: 0xdab5bffa,
    SATOSHIS: 100000000,
    GENESIS_BLOCK_HASH: '3d2160a3b5dc4a9d62e7e66a295f70313ac808440ef7400d6c0772171ce973a5',
    PREVIOUS_HEADER: 'a573e91c1772076c0d40f70e4408c83a31705f296ae6e7629d4adcb5a360213d',
    // Keep this empty. No DNS seed for regtest.
    DNS_SEED: [],
    NODE_IP: '127.0.0.1',
    DEFAULT_PORT: 18444,
    NETWORK_BYTE: '6f',
    PATH: '44\'/1\'/0\'/',
    WALLET: {
      wif: 0xEF,
      bip32: {
          public: 0x043587CF,
          private: 0x04358394,
      }
    }
  },
  testnet: {
    DATA_SUBFOLDER: 'testnet',
    MAGIC_BYTES: 0xdcb7c1fc,
    SATOSHIS: 100000000,
    GENESIS_BLOCK_HASH: 'bb0a78264637406b6360aad926284d544d7049f45189db5664f3c4d07350559e',
    PREVIOUS_HEADER: '9e555073d0c4f36456db8951f449704d544d2826d9aa60636b40374626780abb',
    DNS_SEED: ['testseed.jrn.me.uk', 'testnets.chain.so', 'senatorwhiskers.com'],
    DEFAULT_PORT: 44556,
    NETWORK_BYTE: '71',
    PATH: '44\'/1\'/0\'/',
    WALLET: {
      wif: 0xF1,
      bip32: {
          public: 0x043587CF,
          private: 0x04358394,
      }
    }
  },
  mainnet: {
    DATA_SUBFOLDER: '.',
    MAGIC_BYTES: 0xc0c0c0c0,
    SATOSHIS: 100000000,
    GENESIS_BLOCK_HASH: 'NO',
    PREVIOUS_HEADER: 'NO',
    DNS_SEED: [],
    DEFAULT_PORT: 22556,
    NETWORK_BYTE: '1e',
    PATH: '44\'/3\'/0\'/',
    WALLET: {
      wif: 0x9E,
      bip32: {
          public: 0x02FACAFD,
          private: 0x02FAC398,
      }
    }
  }
}

module.exports = {
  constants,
  SATOSHIS: 100000000,
  PROTOCOL_VERSION: 70004
}

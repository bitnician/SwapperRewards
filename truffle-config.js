const HDWalletProvider = require('@truffle/hdwallet-provider');
require('ts-node').register({
  files: true,
});
require('dotenv').config();
const infuraProjectId = process.env.INFURA_PROJECT_ID;
const dev_mnemonic = process.env.DEV_MNEMONIC;
const prod_mnemonic = process.env.PROD_MNEMONIC;
module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
    },
    ganache: {
      host: '127.0.0.1',
      port: 8545,
      network_id: 4777,
    },
    ropsten: {
      provider: () => new HDWalletProvider(dev_mnemonic, `https://ropsten.infura.io/v3/${infuraProjectId}`),
      network_id: 3,
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    rinkeby: {
      provider: () =>
        new HDWalletProvider({
          mnemonic: dev_mnemonic,
          providerOrUrl: `https://rinkeby.infura.io/v3/${infuraProjectId}`,
          chainId: 4,
        }),
      network_id: 4,
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    bsctestnet: {
      provider: () => new HDWalletProvider(dev_mnemonic, `https://data-seed-prebsc-1-s1.binance.org:8545`),
      network_id: 97,
      gas: 5500000,
      confirmations: 10,
      timeoutBlocks: 200,
      skipDryRun: true,
      networkCheckTimeout: 10000000,
    },
    mainnet: {
      provider: () => new HDWalletProvider(prod_mnemonic, `https://mainnet.infura.io/v3/` + infuraProjectId),
      gas: 5000000,
      confirmations: 2,
      network_id: 1,
      skipDryRun: false,
    },
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: '0.6.12', // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        evmVersion: 'istanbul',
      },
    },
  },
  plugins: ['truffle-contract-size'],
  db: {
    enabled: false,
  },
};

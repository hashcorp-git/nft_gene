const HDWalletProvider = require("truffle-hdwallet-provider-klaytn");
const NETWORK_ID = "1001";
const GASLIMIT = "8500000";
const URL = "https://api.baobab.klaytn.net:8651";
const PRIVATE_KEY = "0x4d2b1e8478b299b90b592e85ecc7b289ebf33b9a5aef601b8891360e1082ec99";

module.exports = {
  networks: {
    // 가상시뮬레이터 가나슈
    ganache: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
    },

    baobab: {
      provider: () => new HDWalletProvider(PRIVATE_KEY, URL),
      network_id: NETWORK_ID,
      gas: GASLIMIT,
      gasPrice: null,
    },
  },

  // Specify the version of compiler, we use 0.5.6
  compilers: {
    solc: {
      version: "0.5.6",
    },
  },
};

require("@nomiclabs/hardhat-waffle");
require('@nomiclabs/hardhat-ethers');
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config();

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const UNISWAP_ROUTER_ADDR = process.env.UNISWAP_ROUTER_ADDR;

if (!INFURA_PROJECT_ID || !DEPLOYER_PRIVATE_KEY || !ETHERSCAN_API_KEY) {
  console.error("Please set INFURA_PROJECT_ID, DEPLOYER_PRIVATE_KEY and ETHERSCAN_API_KEY.");
  return
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.0",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1500
      }
    }
  },
  defaultNetwork: "localhost",
  networks: {
    localhost: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
      network_id: "*",
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
      network_id: "*",
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: ETHERSCAN_API_KEY,
  },
};


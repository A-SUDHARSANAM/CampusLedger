require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../backend/.env" });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    // Local Hardhat node — run: npx hardhat node
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Polygon Mumbai testnet (free, no real money needed)
    mumbai: {
      url: process.env.POLYGON_RPC_URL || "https://rpc-mumbai.maticvigil.com",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
  paths: {
    sources:   "./contracts",
    artifacts: "./artifacts",
  },
};

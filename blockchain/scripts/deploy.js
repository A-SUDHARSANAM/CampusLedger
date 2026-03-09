// scripts/deploy.js
// Run: npx hardhat run scripts/deploy.js --network localhost
//       npx hardhat run scripts/deploy.js --network mumbai

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const Contract = await ethers.getContractFactory("CampusLedger");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("CampusLedger deployed to:", address);

  // Write address to a JSON file so the backend can pick it up
  const out = {
    address,
    deployedAt: new Date().toISOString(),
    network: hre.network.name,
  };
  const outPath = path.join(__dirname, "..", "deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Address saved to blockchain/deployed.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

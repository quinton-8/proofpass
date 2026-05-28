const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=========================================");
  console.log(`Deploying ProofPass contract...`);
  console.log(`Deployer Address: ${deployer.address}`);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} MATIC`);
  console.log("=========================================");

  // 1. Deploy the ProofPass smart contract
  const ProofPass = await ethers.getContractFactory("ProofPass");
  const proofPass = await ProofPass.deploy();

  await proofPass.waitForDeployment();
  const contractAddress = await proofPass.getAddress();

  console.log(`ProofPass deployed successfully!`);
  console.log(`Contract Address: ${contractAddress}`);
  console.log("=========================================");

  // 2. Export deployment metadata (address & ABI)
  const deployData = {
    address: contractAddress,
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  const outputDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write deployment addresses
  fs.writeFileSync(
    path.join(outputDir, `${hre.network.name}.json`),
    JSON.stringify(deployData, null, 2)
  );
  console.log(`Saved deployment info to: deployments/${hre.network.name}.json`);

  // Write contract ABI details to a helper JSON for Go backend / React frontend imports
  const contractArtifact = artifacts.readArtifactSync("ProofPass");
  fs.writeFileSync(
    path.join(outputDir, "ProofPassABI.json"),
    JSON.stringify(contractArtifact.abi, null, 2)
  );
  console.log(`Saved contract ABI to: deployments/ProofPassABI.json`);
  console.log("=========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

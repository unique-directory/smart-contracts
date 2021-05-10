// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const deployUnique = require("./util");

const hre = require("hardhat");

const verificationPromises = [];

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  await hre.run('compile');

  await deployUnique(hre.ethers, verificationPromises, console.log);

  // Wait for all verification promises to finish
  console.log("[-] Verifying all contracts in EtherScan...");
  await Promise.allSettled(verificationPromises.map(fn => fn()));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

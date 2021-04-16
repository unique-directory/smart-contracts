// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const web3 = require("web3");

async function deployContract(contractClass, contractArguments) {
  const instance = await contractClass.deploy.apply(contractClass, contractArguments);
  await instance.deployed();
  console.log(` - deployed contract to:`, instance.address);

  if (!hre.hardhatArguments.network || hre.hardhatArguments.network === 'localhost') {
    console.log(" - skipping verification on localhost.");
    return instance;
  }

  console.log(" - waiting for 5 confirmations...");
  await instance.deployTransaction.wait(5);

  console.log(" - verifying contract in EtherScan...");
  await hre.run("verify:verify", {
    address: instance.address,
    constructorArguments: contractArguments,
  });

  console.log(" - contract is verified.");
  return instance;
}

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  await hre.run('compile');

  const [
    deployer
  ] = await hre.ethers.getSigners();
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const Vault = await hre.ethers.getContractFactory("Vault");
  const Core = await hre.ethers.getContractFactory("Core");

  const exp = hre.ethers.BigNumber.from("10").pow(18);
  const initialUniquettePrice = hre.ethers.BigNumber.from("1").mul(exp); // ETH
  const submissionPrize = hre.ethers.BigNumber.from("5000").mul(exp); // UNQ

  console.log("[-] Deploying Treasury...");
  const treasury = await deployContract(Treasury, [
    deployer.address // initiator
  ]);

  console.log("[-] Deploying Vault...");
  const vault = await deployContract(Vault, [
    deployer.address // releaser
  ]);

  console.log("[-] Deploying Core...");
  const core = await deployContract(Core, [
    "ipfs://",
    process.env.FUNGIBLE_TOKEN_METADATA_HASH,
    vault.address,    // vault
    treasury.address, // treasury
    deployer.address, // approver
    deployer.address, // marketer
    [
      web3.utils.toWei('1'), // initialUniquettePrice: 1 ETH
      5000,        // originalAuthorShare: 50%
      500,         // protocolFee: 5%
      web3.utils.toWei('5000'), // submissionPrize: 5000 UNQ
      1,           // currentMetadataVersion
      1,           // minMetadataVersion
      1000,        // maxPriceIncrease: 10%
    ]
  ]);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

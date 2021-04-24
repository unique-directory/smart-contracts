// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const web3 = require("web3");

const verificationPromises = [];

async function deployContract(contractClass, contractArguments) {
  const instance = await contractClass.deploy.apply(contractClass, contractArguments);
  await instance.deployed();
  console.log(` - deployed contract to:`, instance.address);

  if (!hre.hardhatArguments.network || hre.hardhatArguments.network === 'localhost') {
    console.log(" - skipping verification on localhost.");
    return instance;
  }

  // Asynchronously try to verify the contract
  verificationPromises.push((async () => {
    console.log(" - waiting for 5 confirmations...");
    await instance.deployTransaction.wait(5);

    console.log(" - verifying contract in EtherScan...");
    await hre.run("verify:verify", {
      address: instance.address,
      constructorArguments: contractArguments,
    });
  }));

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
    deployer,
    fakeDAO // TODO replace with a real DAO deployment
  ] = await hre.ethers.getSigners();
  const Token = await hre.ethers.getContractFactory("Token");
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const Marketer = await hre.ethers.getContractFactory("Marketer");
  const Vault = await hre.ethers.getContractFactory("Vault");
  const Directory = await hre.ethers.getContractFactory("Directory");

  console.log("[-] Deploying Token...");
  const token = await deployContract(Token, [
    "Unique Directory Governance Tokens",
    "UNQ",
  ]);

  console.log("[-] Deploying Treasury...");
  const treasury = await deployContract(Treasury, [
    process.env.UNISWAP_ROUTER_ADDR
  ]);

  console.log("[-] Deploying Marketer...");
  const marketer = await deployContract(Marketer, []);

  console.log("[-] Deploying Vault...");
  const vault = await deployContract(Vault, []);

  console.log("[-] Deploying Directory...");
  const directory = await deployContract(Directory, [
    "Unique Directory NFT Uniquettes",
    "UQT",
    "ipfs://",
    token.address,
    vault.address,
    treasury.address,
    marketer.address,
    [
      web3.utils.toWei('1'), // initialUniquettePrice: 1 ETH
      5000,        // originalAuthorShare: 50%
      500,         // protocolFee: 5%
      web3.utils.toWei('5000'), // submissionPrize: 5000 UNQ
      web3.utils.toWei('0.1'), // submissionCollateral: 0.1 ETH
      7890000,     // firstSaleDeadline: 90 days
      1,           // currentMetadataVersion
      1,           // minMetadataVersion
      1000,        // maxPriceIncrease: 10%
    ]
  ]);

  console.log("[-] Configuring Token...");
  await token.grantRole(web3.utils.soliditySha3('MINTER_ROLE'), directory.address);

  console.log("[-] Configuring Treasury...");
  await treasury.setTokenAddress(token.address);

  console.log("[-] Configuring Marketer...");
  await treasury.setDirectoryAddress(directory.address);

  // Wait for all verification promises to finish
  console.log("[-] Verifying all contracts in EtherScan...");
  await Promise.allSettled(verificationPromises);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

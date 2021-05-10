const web3 = require("web3");
const hre = require("hardhat");

async function deployContract(contractClass, contractArguments, verificationPromises, log) {
  const instance = await contractClass.deploy.apply(contractClass, contractArguments);
  await instance.deployed();

  log(` - deployed ${contractClass} contract to:`, instance.address);

  if (
    !hre.hardhatArguments ||
    !hre.hardhatArguments.network ||
    hre.hardhatArguments.network === 'localhost'
  ) {
    log(" - skipping verification on localhost.");
    return instance;
  }

  // Asynchronously try to verify the contract
  verificationPromises.push((async () => {
    await instance.deployTransaction.wait(5);
    await hre.run("verify:verify", {
      address: instance.address,
      constructorArguments: contractArguments,
    });
  }));

  return instance;
}

module.exports = async function deployUnique(ethers, verificationPromises, log = () => {}) {
  const Token = await ethers.getContractFactory("Token");
  const Treasury = await ethers.getContractFactory("Treasury");
  const Marketer = await ethers.getContractFactory("Marketer");
  const Vault = await ethers.getContractFactory("Vault");
  const Directory = await ethers.getContractFactory("Directory");

  log("[-] Deploying Token...");
  const token = await deployContract(Token, [
    "Unique Directory Governance Tokens",
    "UNQ",
  ], verificationPromises, log);

  log("[-] Deploying Treasury...");
  const treasury = await deployContract(Treasury, [
    process.env.UNISWAP_ROUTER_ADDR
  ], verificationPromises, log);

  log("[-] Deploying Marketer...");
  const marketer = await deployContract(Marketer, [], verificationPromises, log);

  log("[-] Deploying Vault...");
  const vault = await deployContract(Vault, [], verificationPromises, log);

  log("[-] Deploying Directory...");
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
      web3.utils.toWei('0.1'), // submissionCollateral: 0.1 ETH
      7890000,     // firstSaleDeadline: 90 days
      1,           // currentMetadataVersion
      1,           // minMetadataVersion
      1000,        // maxPriceIncrease: 10%
    ]
  ], verificationPromises, log);

  log("[-] Configuring Token...");
  await token.grantRole(web3.utils.soliditySha3('MINTER_ROLE'), directory.address);

  log("[-] Configuring Treasury...");
  await treasury.setTokenAddress(token.address);

  log("[-] Configuring Marketer...");
  await marketer.setDirectoryAddress(directory.address);

  log("[-] Configuring Vault...");
  await vault.setDirectoryAddress(directory.address);

  return {
    token,
    directory,
    treasury,
    vault,
    marketer,
  };
};

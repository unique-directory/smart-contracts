const web3 = require('web3');
const hre = require('hardhat');

async function deployContract(contractClass, contractArguments) {
  const instance = await contractClass.deploy.apply(contractClass);
  await instance.deployed();
  await instance.initialize.call(instance, ...contractArguments);

  return instance;
}

async function deployUniqueForTests() {
  const Token = await ethers.getContractFactory('Token');
  const Treasury = await ethers.getContractFactory('Treasury');
  const Marketer = await ethers.getContractFactory('Marketer');
  const Vault = await ethers.getContractFactory('Vault');
  const Directory = await ethers.getContractFactory('Directory');

  const token = await deployContract(Token, [
    'Unique Directory Governance Tokens',
    'UNQ',
  ]);

  const treasury = await deployContract(Treasury, [
    process.env.UNISWAP_ROUTER_ADDR,
  ]);

  const marketer = await deployContract(Marketer, []);
  const vault = await deployContract(Vault, []);
  const directory = await deployContract(Directory, [
    'Unique Directory NFT Uniquettes',
    'UQT',
    'ipfs://',
    token.address,
    vault.address,
    treasury.address,
    marketer.address,
    [
      web3.utils.toWei('1'), // initialUniquettePrice: 1 ETH
      0, // originalAuthorShare: 0%
      500, // protocolFee: 5%
      web3.utils.toWei('0.1'), // submissionCollateral: 0.1 ETH
      7890000, // firstSaleDeadline: 90 days
      1, // currentMetadataVersion
      1, // minMetadataVersion
      1000, // maxPriceIncrease: 10%
    ],
  ]);

  await token.grantRole(
    web3.utils.soliditySha3('MINTER_ROLE'),
    directory.address
  );
  await treasury.setTokenAddress(token.address);
  await marketer.setDirectoryAddress(directory.address);
  await vault.setDirectoryAddress(directory.address);

  return {
    token,
    directory,
    treasury,
    vault,
    marketer,
  };
}

module.exports = {
  deployUniqueForTests,
};

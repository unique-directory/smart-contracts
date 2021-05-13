const web3 = require('web3');

const {deployUpgradableContract} = require('../hardhat.util');

module.exports = async ({getNamedAccounts, deployments}) => {
  const {deployer, governor} = await getNamedAccounts();

  const token = await deployments.get('Token');
  const vault = await deployments.get('Vault');
  const treasury = await deployments.get('Treasury');
  const marketer = await deployments.get('Marketer');

  const contractArguments = [
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
  ];

  await deployUpgradableContract(deployments, deployer, governor, 'Directory', contractArguments);
};

module.exports.tags = ['Directory'];
module.exports.dependencies = ['Marketer', 'Token', 'Treasury', 'Vault'];

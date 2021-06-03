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
    500, // protocolFee: 5%
    1, // minMetadataVersion
    1, // currentMetadataVersion
    1000, // maxAppreciation: 10%
    web3.utils.toWei('0.1') // submissionDeposit: 0.1 ETH
  ];

  await deployUpgradableContract(deployments, deployer, governor, 'Directory', contractArguments);
};

module.exports.tags = ['Directory'];
module.exports.dependencies = ['Marketer', 'Token', 'Treasury', 'Vault'];

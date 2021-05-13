const hre = require('hardhat');

module.exports = async ({getNamedAccounts, deployments}) => {
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy('Token', {
    from: deployer,
    args: ['Unique Directory Governance Tokens', 'UNQ'],
    log: true,
    proxy: {
      owner: deployer,
      proxyContract: 'OpenZeppelinTransparentProxy',
    }
  });
};

module.exports.tags = ['Token'];

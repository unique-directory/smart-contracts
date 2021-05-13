const hre = require('hardhat');

module.exports = async ({getNamedAccounts, deployments}) => {
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy('Treasury', {
    from: deployer,
    args: [
      process.env.UNISWAP_ROUTER_ADDR
    ],
    log: true,
    proxy: {
      owner: deployer,
      proxyContract: 'OpenZeppelinTransparentProxy',
    }
  });
};

module.exports.tags = ['Token'];

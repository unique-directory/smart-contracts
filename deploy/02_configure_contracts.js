const web3 = require('web3');

module.exports = async ({getNamedAccounts, deployments}) => {
  const {deployer} = await getNamedAccounts();

  const token = await deployments.get('Token');
  const directory = await deployments.get('Directory');

  await deployments.execute(
    'Token',
    {from: deployer},
    'grantRole',
    web3.utils.soliditySha3('MINTER_ROLE'),
    directory.address
  );
  await deployments.execute(
    'Treasury',
    {from: deployer},
    'setTokenAddress',
    token.address
  );
  await deployments.execute(
    'Marketer',
    {from: deployer},
    'setDirectoryAddress',
    directory.address
  );
  await deployments.execute(
    'Vault',
    {from: deployer},
    'setDirectoryAddress',
    directory.address
  );
};

module.exports.tags = ['configure'];
module.exports.dependencies = [
  'Directory',
  'Marketer',
  'Token',
  'Treasury',
  'Vault',
];

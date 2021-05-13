const hre = require('hardhat');

module.exports = async ({deployments}) => {
  if (
    !hre.hardhatArguments ||
    !hre.hardhatArguments.network ||
    hre.hardhatArguments.network === 'hardhat' ||
    hre.hardhatArguments.network.substr(0, 4) === 'bsc_'
  ) {
    console.log(` - skipping verification on ${hre.hardhatArguments.network}.`);
    return;
  }

  const token = await deployments.get('Token');
  const vault = await deployments.get('Vault');
  const treasury = await deployments.get('Treasury');
  const marketer = await deployments.get('Marketer');
  const directory = await deployments.get('Directory');

  for (const contract of [token, vault, treasury, marketer, directory]) {
    try {
      await hre.run('verify:verify', {
        address: contract.implementation,
      });
    } catch (err) {
      if (!err.toString().includes('already verified')) {
        throw err;
      }
    }
  }
};

module.exports.tags = ['etherscan-verify'];
module.exports.dependencies = [
  'Directory',
  'Marketer',
  'Token',
  'Treasury',
  'Vault',
];

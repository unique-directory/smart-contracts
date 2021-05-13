const hre = require('hardhat');

module.exports = async ({deployments}) => {
  if (
    !hre.hardhatArguments ||
    !hre.hardhatArguments.network ||
    hre.hardhatArguments.network === 'hardhat'
  ) {
    console.log(' - skipping verification on hardhat.');
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

module.exports.tags = ['Directory'];
module.exports.dependencies = ['Marketer', 'Token', 'Treasury', 'Vault'];

const hre = require("hardhat");
const web3 = require("web3");
const csvtojson = require('csvtojson');
const _ = require('lodash');

if (!process.env.HARDHAT_NETWORK) {
  throw new Error('Must provide HARDHAT_NETWORK env');
}

if (!process.env.INPUT_FILE) {
  throw new Error('Must provide INPUT_FILE env');
}

async function main() {
  const { deployer } = await hre.getNamedAccounts();

  const hashes = _.flattenDeep(await csvtojson({ noheader: true, ignoreEmpty: true }).fromFile(process.env.INPUT_FILE));

  console.log(`Approving ${hashes.length} submissions...`);

  const batchSize = parseInt(process.env.BATCH_SIZE);

  for (let i = 0;  i < hashes.length; i += batchSize) {
    const chunked = hashes.slice(i, i + batchSize).map(h => h.field1);

    const rewards = Array(chunked.length).fill(
      web3.utils.toWei('100')
    );

    try {
      console.log(`Trying to approve: ${chunked.length}`);
      console.log(`- Hashes: ${chunked.join(', ')}`);
      await hre.deployments.execute(
        'Directory',
        {from: deployer},
        'submissionApproveBulk',
        chunked,
        rewards,
      );
    } catch (err) {
      console.log(`Failed: ${err}`);
    }
  }

  console.log(`Finished!`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

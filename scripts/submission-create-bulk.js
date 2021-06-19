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

if (!process.env.BATCH_SIZE) {
  throw new Error('Must provide BATCH_SIZE env');
}

if (!process.env.PRICE_IN_ETH) {
  throw new Error('Must provide PRICE_IN_ETH env');
}

async function main() {
  const { deployer } = await hre.getNamedAccounts();

  const hashes = _.flattenDeep(await csvtojson({ noheader: true, ignoreEmpty: true }).fromFile(process.env.INPUT_FILE));

  console.log(`Creating ${hashes.length} submissions...`);

  const batchSize = parseInt(process.env.BATCH_SIZE);
  const priceInEth = parseFloat(process.env.PRICE_IN_ETH);

  for (let i = 0;  i < hashes.length; i += batchSize) {
    const chunked = hashes.slice(i, i + batchSize).map(h => h.field1);

    const metadataVersions = Array(chunked.length).fill(1);
    const tokenIds = Array(chunked.length).fill(0);
    const addedValues = Array(chunked.length).fill(
      web3.utils.toWei(priceInEth.toString())
    );

    try {
      console.log(`Trying to create: ${chunked.length}`);
      console.log(`- Hashes: ${chunked.join(', ')}`);
      await hre.deployments.execute(
        'Directory',
        { from: deployer },
        'submissionCreateBulk',
        chunked,
        metadataVersions,
        tokenIds,
        addedValues,
      );
    } catch (err) {
      console.log(`Failed`);
      console.log((err.error && err.error.toString()) || (err.reason && err.reason.toString()) || err);
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

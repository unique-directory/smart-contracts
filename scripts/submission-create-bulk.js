const hre = require("hardhat");
const web3 = require("web3");

if (!process.env.HARDHAT_NETWORK) {
  throw new Error('Must provide HARDHAT_NETWORK env');
}

async function main() {
  const { deployer } = await hre.getNamedAccounts();

  // TODO Build a CSV parser to read from a file
  const hashes = [
    'QmbM9GSzoRCDchirf7DGh5uPQrCAoD8fGtEQTDS9KEoekN',
    'QmdwN3HKoWtk25YfNcLGTsNHipnMNicziyCveRSxc685k6',
    'Qmd8Rrmw79idKzctxfvowCg7jFA5pStCPK4ek1qBgH8HDZ',
    'QmcoRSjkpBgnk9RNV79t3Gho7D487YZ3VPk8bdgxZu3WKP',
    'QmNdZxeZKLmU9Gj5iDQRaLWP6pe8ucHabqFKRGCCtpAUsj',
    'QmeQ5PxiSdH7w4zaaCXR6vsrJGRZG54ZZoopat7mTkfnzC',
    'QmcNDKz5GfjRxqyd9PuXei19DWeKgA1SSk6Pohak3BzAQC',
    'QmZnMsvtWXX8EgLGrUYZaHj5aRKZEWn8rwg1wUXBX75v5p',
    'QmU8CrXjpe7m9Eo5DJqXoz3VjkHn2aHVf8o5pMUBYVosq3',
    'QmNNpyTvgoZ7Ruy6TMVT62McNj738aiamCev5NKF8HS9hA',
    'QmS4cYaSpQgSpLtwu8aFHdSW4sAuT63bmGAFD11f6qaNGM',
    'Qme4oyBXEiUWBsXnn3tBVwwR3eTZfitFzTKM9khRMQM8LZ',
    'QmXsTUNX3cgypXwkmFiU3owjv4gvc8f4gHW5EiiWyk2XpP'
  ];
  const metadataVersions = Array(hashes.length).fill(1);
  const tokenIds = Array(hashes.length).fill(0);
  const addedValues = Array(hashes.length).fill(
    web3.utils.toWei('0.5')
  );

  console.log(`Creating ${hashes.length} submissions...`);

  await hre.deployments.execute(
    'Directory',
    {from: deployer},
    'submissionCreateBulk',
    hashes,
    metadataVersions,
    tokenIds,
    addedValues,
  );

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

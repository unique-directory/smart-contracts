const hre = require("hardhat");
const web3 = require("web3");

if (!process.env.HARDHAT_NETWORK) {
  throw new Error('Must provide HARDHAT_NETWORK env');
}

async function main() {
  const { deployer } = await hre.getNamedAccounts();

  // TODO Build a CSV parser to read from a file
  const hashes = [
    // 'QmPGpPPtZxtCpKfqLsrdg4YvRqaT5mg46FxppoVA21Qr9V',
    // 'QmW9KdEa9vAgw6kqLC73kCKeSDoxjW5jag6XcvYzxjwa6R',
    // 'QmUXSH3S42iPpuqD41aZm7W9mNzZffmRkkJhK2m9bv2PEm',
    // 'QmPWcsb9KjnofcU7D6mz7HNQwyuQGxMnwZiknb1HJBYXHj',
    // 'QmafZo9P38eduXB2XBQ67RrmPBczUYetrBf7s4KgHp5qQa',
    // 'QmPi3xRFJ2pGpTQtrbWQSdMWqoRaKrDpUzaMAfVXniaQGZ',
    // 'QmU26QRSnnwK4Su2Md3aU6bbXjNfEKziJKhStwJeQhjrcZ',
    'QmWCPjSf3n8PCfMZBrCCd8LZMXFVjt4hzcM5WJEn965djh'
  ];
  const rewards = Array(hashes.length).fill(
    web3.utils.toWei('100')
  );

  console.log(`Approving ${hashes.length} submissions...`);

  await hre.deployments.execute(
    'Directory',
    {from: deployer},
    'submissionApproveBulk',
    hashes,
    rewards,
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

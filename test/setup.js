const web3 = require('web3');

const setupTest = deployments.createFixture(
  async (
    {deployments, getNamedAccounts, getUnnamedAccounts, ethers},
    options
  ) => {
    const governor = (await getNamedAccounts()).deployer;
    const accounts = await getUnnamedAccounts();

    await deployments.fixture();

    (await ethers.getContract('Directory', governor)).setSubmissionDeposit(
      web3.utils.toWei('0.1'),
    );

    return {
      governor: {
        signer: await ethers.getSigner(governor),
        tokenContract: await ethers.getContract('Token', governor),
        treasuryContract: await ethers.getContract('Treasury', governor),
        directoryContract: await ethers.getContract('Directory', governor),
        vaultContract: await ethers.getContract('Vault', governor),
      },
      userA: {
        signer: await ethers.getSigner(accounts[0]),
        tokenContract: await ethers.getContract('Token', accounts[0]),
        treasuryContract: await ethers.getContract('Treasury', accounts[0]),
        directoryContract: await ethers.getContract('Directory', accounts[0]),
        vaultContract: await ethers.getContract('Vault', accounts[0]),
      },
      userB: {
        signer: await ethers.getSigner(accounts[1]),
        tokenContract: await ethers.getContract('Token', accounts[1]),
        treasuryContract: await ethers.getContract('Treasury', accounts[1]),
        directoryContract: await ethers.getContract('Directory', accounts[1]),
        vaultContract: await ethers.getContract('Vault', accounts[1]),
      },
      userC: {
        signer: await ethers.getSigner(accounts[2]),
        tokenContract: await ethers.getContract('Token', accounts[2]),
        treasuryContract: await ethers.getContract('Treasury', accounts[2]),
        directoryContract: await ethers.getContract('Directory', accounts[2]),
        vaultContract: await ethers.getContract('Vault', accounts[2]),
      },
      userD: {
        signer: await ethers.getSigner(accounts[3]),
        tokenContract: await ethers.getContract('Token', accounts[3]),
        treasuryContract: await ethers.getContract('Treasury', accounts[3]),
        directoryContract: await ethers.getContract('Directory', accounts[3]),
        vaultContract: await ethers.getContract('Vault', accounts[3]),
      },
      userE: {
        signer: await ethers.getSigner(accounts[4]),
        tokenContract: await ethers.getContract('Token', accounts[4]),
        treasuryContract: await ethers.getContract('Treasury', accounts[4]),
        directoryContract: await ethers.getContract('Directory', accounts[4]),
        vaultContract: await ethers.getContract('Vault', accounts[4]),
      },
    };
  }
);

module.exports = {
  setupTest,
};

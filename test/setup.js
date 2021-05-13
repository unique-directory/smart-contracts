const setupTest = deployments.createFixture(
  async (
    {deployments, getNamedAccounts, getUnnamedAccounts, ethers},
    options
  ) => {
    const governor = (await getNamedAccounts()).deployer;
    const accounts = await getUnnamedAccounts();

    await deployments.fixture();

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
    };
  }
);

module.exports = {
  setupTest,
};

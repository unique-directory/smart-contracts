const { expect } = require("chai");
const { v4: uuid } = require("uuid");
const web3 = require("web3");
const deployUnique = require("../scripts/util");

describe("Vault", () => {
  /**
   * @type Signer[]
   */
  let accounts;
  let directoryContract;
  let tokenContract;
  let vaultContract;
  let treasuryContract;
  let marketerContract;

  beforeEach(async () => {
    accounts = await ethers.getSigners();

    const { directory, token, vault, treasury, marketer } = await deployUnique(ethers);

    directoryContract = directory;
    tokenContract = token;
    vaultContract = vault;
    treasuryContract = treasury;
    marketerContract = marketer;
  });

  it("should liquidate a uniquette and pay the owner", async () => {
    const [governor, userA, userB, userC] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directoryContract.connect(governor).uniquetteApprove(fakeHash, web3.utils.toWei('5000'));
    await directoryContract.connect(userB).uniquetteBuy(
      userB.address,
      1,
      {
        value: web3.utils.toWei('1.1') // ETH
      }
    );

    await expect(
      await vaultContract.connect(userB).uniquetteLiquidate(
        1,
        userB.address
      )
    ).to.changeEtherBalances([
      governor, directoryContract,
      vaultContract, treasuryContract,
      userA,
      userB,
      userC,
    ], [
      web3.utils.toWei('0'), web3.utils.toWei('0'),
      web3.utils.toWei('-0.55'), web3.utils.toWei('0'),
      web3.utils.toWei('0'),
      web3.utils.toWei('0.55'),
      web3.utils.toWei('0'),
    ]);

    await expect(await directoryContract.ownerOf(1)).to.equal(vaultContract.address);
  });

  it("should allow buying a liquidated uniquette", async () => {
    const [governor, userA, userB, userC] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directoryContract.connect(governor).uniquetteApprove(fakeHash, web3.utils.toWei('5000'));
    await directoryContract.connect(userB).uniquetteBuy(
      userB.address,
      1,
      {
        value: web3.utils.toWei('1.1') // ETH
      }
    );

    await vaultContract.connect(userB).uniquetteLiquidate(
      1,
      userB.address
    );

    await expect(
      await directoryContract.connect(userC).uniquetteBuy(
        userC.address,
        1,
        {
          value: web3.utils.toWei('0.5775') // ETH
        }
      )
    ).to.changeEtherBalances([
      governor, directoryContract,
      vaultContract, treasuryContract,
      userA,
      userB,
      userC,
    ], [
      web3.utils.toWei('0'), web3.utils.toWei('0'),
      web3.utils.toWei('0.55'), web3.utils.toWei('0.0275'),
      web3.utils.toWei('0'),
      web3.utils.toWei('0'),
      web3.utils.toWei('-0.5775'),
    ]);

    await expect(await directoryContract.ownerOf(1)).to.equal(userC.address);
  });

  it("should liquidate a previously liquidated uniquette", async () => {
    const [governor, userA, userB, userC, userD] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directoryContract.connect(governor).uniquetteApprove(fakeHash, web3.utils.toWei('5000'));
    await directoryContract.connect(userB).uniquetteBuy(
      userB.address,
      1,
      {
        value: web3.utils.toWei('1.1') // ETH
      }
    );

    await vaultContract.connect(userB).uniquetteLiquidate(
      1,
      userB.address
    );

    await directoryContract.connect(userC).uniquetteBuy(
      userC.address,
      1,
      {
        value: web3.utils.toWei('0.5775') // ETH
      }
    );

    await expect(
      await vaultContract.connect(userC).uniquetteLiquidate(
        1,
        userC.address
      )
    ).to.changeEtherBalances([
      governor, directoryContract,
      vaultContract, treasuryContract,
      userA,
      userB,
      userC,
    ], [
      web3.utils.toWei('0'), web3.utils.toWei('0'),
      web3.utils.toWei('-0.55'), web3.utils.toWei('0'),
      web3.utils.toWei('0'),
      web3.utils.toWei('0'),
      web3.utils.toWei('0.55'),
    ]);

    await expect(await directoryContract.ownerOf(1)).to.equal(vaultContract.address);
  });
});

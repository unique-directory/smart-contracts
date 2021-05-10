const { expect } = require("chai");
const { v4: uuid } = require("uuid");
const web3 = require("web3");
const deployUnique = require("../scripts/util");

describe("Directory", () => {
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

  it("should submit a new uniquette", async () => {
    const [governor, userA] = accounts;
    const fakeHash = uuid();

    await expect(
      directoryContract.connect(userA).uniquetteSubmit(
        fakeHash,
        1, // Schema v1
        {
          value: web3.utils.toWei('0.1') // ETH
        }
      )
    )
      .to.emit(directoryContract, 'UniquetteSubmitted')
      .withArgs(userA.address, fakeHash, web3.utils.toWei('0.1'));
  });

  it("should approve a uniquette submission", async () => {
    const [governor, userA] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await expect(directoryContract.connect(governor).uniquetteApprove(fakeHash, web3.utils.toWei('5000')))
      .to.emit(directoryContract, 'UniquetteApproved')
      .withArgs(governor.address, userA.address, fakeHash, 1);
  });

  it("should reject a uniquette submission", async () => {
    const [governor, userA] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await expect(directoryContract.connect(governor).uniquetteReject(fakeHash))
      .to.emit(directoryContract, 'UniquetteRejected')
      .withArgs(governor.address, userA.address, fakeHash);
  });

  it("should not reward original author on approval", async () => {
    const [governor, userA] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directoryContract.connect(governor).uniquetteApprove(fakeHash, web3.utils.toWei('5000'));

    await expect(
      await tokenContract.balanceOf(userA.address)
    ).to.equal(0);
  });

  it("should sell a new uniquette to a buyer and reward original author", async () => {
    const [governor, userA, userB] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directoryContract.connect(governor).uniquetteApprove(fakeHash, web3.utils.toWei('5000'));
    await expect(
      await directoryContract.connect(userB).uniquetteBuy(
        userB.address,
        1,
        {
          value: web3.utils.toWei('1.1') // 1 ETH
        }
      )
    ).to.changeEtherBalances([
      directoryContract,
      vaultContract,
      treasuryContract,
      userA,
      userB,
    ], [
      web3.utils.toWei('0'),
      web3.utils.toWei('0.55'),
      web3.utils.toWei('0.05'),
      web3.utils.toWei('0.5'),
      web3.utils.toWei('-1.1'),
    ]);

    await expect(
      await tokenContract.balanceOf(userA.address)
    ).to.equal(web3.utils.toWei('5000'));
    await expect(
      await directoryContract.balanceOf(userB.address)
    ).to.equal(1);
  });

  it("should pay protocol fee to treasury on first sale", async () => {
    const [governor, userA, userB] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directoryContract.connect(governor).uniquetteApprove(fakeHash, web3.utils.toWei('5000'));

    await expect(
      await directoryContract.connect(userB).uniquetteBuy(
        userB.address,
        1,
        {
          value: web3.utils.toWei('1.1') // 1.1 ETH
        }
      )
    ).to.changeEtherBalance(treasuryContract, web3.utils.toWei('0.05'));
  });

  it("should transfer additional payment as collateral to vault on first sale", async () => {
    const [governor, userA, userB] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directoryContract.connect(governor).uniquetteApprove(fakeHash, web3.utils.toWei('5000'));

    await expect(
      await directoryContract.connect(userB).uniquetteBuy(
        userB.address,
        1,
        {
          value: web3.utils.toWei('1.1') // 1.1 ETH
        }
      )
    ).to.changeEtherBalance(vaultContract, web3.utils.toWei('0.55'));
  });

  it("should pay the original author based on configured share on first sale", async () => {
    const [governor, userA, userB] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directoryContract.connect(governor).uniquetteApprove(fakeHash, web3.utils.toWei('5000'));

    await expect(
      await directoryContract.connect(userB).uniquetteBuy(
        userB.address,
        1,
        {
          value: web3.utils.toWei('1.1') // ETH
        }
      )
    ).to.changeEtherBalance(userA, web3.utils.toWei('0.5'));
  });

  it("should put on sale based on desired price", async () => {
    const [governor, userA, userB] = accounts;
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
      await directoryContract.connect(userB).uniquetteForSale(
        1,
        web3.utils.toWei('1.18')
      )
    ).to.emit(directoryContract, 'UniquettePutForSale')
    .withArgs(userB.address, userB.address, 1, fakeHash, web3.utils.toWei('1.18'));
  });

  it("should buy with same amount as sales price on secondary sales", async () => {
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
    await directoryContract.connect(userB).uniquetteForSale(
      1,
      web3.utils.toWei('1.18')
    );

    await expect(
      await directoryContract.connect(userC).uniquetteBuy(
        userC.address,
        1,
        {
          value: web3.utils.toWei('1.239') // ETH
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
      web3.utils.toWei('0'), web3.utils.toWei('0.059'),
      web3.utils.toWei('0'),
      web3.utils.toWei('1.18'),
      web3.utils.toWei('-1.239'),
    ]);
  });

  it("should buy with higher amount than sales price on secondary sales", async () => {
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
    await directoryContract.connect(userB).uniquetteForSale(
      1,
      web3.utils.toWei('1.18')
    );

    await expect(
      await directoryContract.connect(userC).uniquetteBuy(
        userC.address,
        1,
        {
          value: web3.utils.toWei('4') // ETH
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
      web3.utils.toWei('2.761'), web3.utils.toWei('0.059'),
      web3.utils.toWei('0'),
      web3.utils.toWei('1.18'),
      web3.utils.toWei('-4.0'),
    ]);
  });

  it("should sell for price lower than last purchase but higher than collateral", async () => {
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
    await directoryContract.connect(userB).uniquetteForSale(
      1,
      web3.utils.toWei('0.8')
    );

    await expect(
      await directoryContract.connect(userC).uniquetteBuy(
        userC.address,
        1,
        {
          value: web3.utils.toWei('0.84') // ETH
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
      web3.utils.toWei('0'), web3.utils.toWei('0.04'),
      web3.utils.toWei('0'),
      web3.utils.toWei('0.8'),
      web3.utils.toWei('-0.84'),
    ]);
  });
});

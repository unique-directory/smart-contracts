const { expect } = require("chai");
const { v4: uuid } = require("uuid");
const web3 = require("web3");

const UNQ_FUNGIBLE_TOKEN_ID = 0x1;

async function deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer) {
  const Core = await ethers.getContractFactory("Core");

  return await Core.deploy(
    "ipfs://",
    "QmUbtGBSKLrPfKMjrMhJQPMfGCrfmBY31VLm2HtuDYjkbV",
    fakeVault.address,
    fakeTreasury.address,
    fakeApprover.address,
    fakeMarketer.address,
    [
      web3.utils.toWei('1'), // initialUniquettePrice: 1 ETH
      4000,        // originalAuthorShare: 40%
      1000,        // protocolFee: 10%
      web3.utils.toWei('5000'), // submissionPrize: 5000 UNQ
      1,           // currentMetadataVersion
      1,           // minMetadataVersion
      800,         // maxPriceIncrease: 8%
    ]
  );
}

describe("Core", () => {
  /**
   * @type Signer[]
   */
  let accounts;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
  });

  it("should submit a new uniquette", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA] = accounts;
    const core = await deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await expect(core.connect(userA).submitUniquette(fakeHash))
      .to.emit(core, 'UniquetteSubmitted')
      .withArgs(userA.address, fakeHash);
  });

  it("should approve a uniquette submission", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA] = accounts;
    const core = await deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await core.connect(userA).submitUniquette(fakeHash);
    await expect(core.connect(fakeApprover).approveSubmission(fakeHash))
      .to.emit(core, 'UniquetteApproved')
      .withArgs(fakeApprover.address, userA.address, fakeHash, 1000);
  });

  it("should reject a uniquette submission", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA] = accounts;
    const core = await deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await core.connect(userA).submitUniquette(fakeHash);
    await expect(core.connect(fakeApprover).rejectSubmission(fakeHash))
      .to.emit(core, 'UniquetteRejected')
      .withArgs(fakeApprover.address, userA.address, fakeHash);
  });

  it("should reward UNQ to original author as submission prize", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA] = accounts;
    const core = await deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await core.connect(userA).submitUniquette(fakeHash);
    await core.connect(fakeApprover).approveSubmission(fakeHash);

    await expect(
      await core.balanceOf(userA.address, UNQ_FUNGIBLE_TOKEN_ID)
    ).to.equal(web3.utils.toWei('5000'));
  });

  it("should sell a new uniquette to a buyer", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB] = accounts;
    const core = await deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await core.connect(userA).submitUniquette(fakeHash);
    await core.connect(fakeApprover).approveSubmission(fakeHash);
    await expect(
      await core.connect(userB).safeBuy(
        userB.address,
        1000,
        web3.utils.toHex('test'),
        {
          value: web3.utils.toWei('1.1') // 1 ETH
        }
      )
    ).to.changeEtherBalances([
      core,
      fakeVault,
      fakeTreasury,
      userA,
      userB,
    ], [
      web3.utils.toWei('0'),
      web3.utils.toWei('0.6'),
      web3.utils.toWei('0.1'),
      web3.utils.toWei('0.4'),
      web3.utils.toWei('-1.1'),
    ]);

    await expect(
      await core.balanceOf(userB.address, 1000)
    ).to.equal(1);
  });

  it("should pay protocol fee to treasury on first sale", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB] = accounts;
    const core = await deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await core.connect(userA).submitUniquette(fakeHash);
    await core.connect(fakeApprover).approveSubmission(fakeHash);

    await expect(
      await core.connect(userB).safeBuy(
        userB.address,
        1000,
        web3.utils.toHex('test'),
        {
          value: web3.utils.toWei('1.1') // 1.1 ETH
        }
      )
    ).to.changeEtherBalance(fakeTreasury, web3.utils.toWei('0.1'));
  });

  it("should transfer additional payment as collateral to vault on first sale", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB] = accounts;
    const core = await deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await core.connect(userA).submitUniquette(fakeHash);
    await core.connect(fakeApprover).approveSubmission(fakeHash);

    await expect(
      await core.connect(userB).safeBuy(
        userB.address,
        1000,
        web3.utils.toHex('test'),
        {
          value: web3.utils.toWei('1.1') // 1.1 ETH
        }
      )
    ).to.changeEtherBalance(fakeVault, web3.utils.toWei('0.6'));
  });

  it("should pay the original author based on configured share on first sale", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB] = accounts;
    const core = await deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await core.connect(userA).submitUniquette(fakeHash);
    await core.connect(fakeApprover).approveSubmission(fakeHash);

    await expect(
      await core.connect(userB).safeBuy(
        userB.address,
        1000,
        web3.utils.toHex('test'),
        {
          value: web3.utils.toWei('1.1') // ETH
        }
      )
    ).to.changeEtherBalance(userA, web3.utils.toWei('0.4'));
  });

  it("should put on sale based on desired price", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB] = accounts;
    const core = await deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await core.connect(userA).submitUniquette(fakeHash);
    await core.connect(fakeApprover).approveSubmission(fakeHash);
    await core.connect(userB).safeBuy(
      userB.address,
      1000,
      web3.utils.toHex('test'),
      {
        value: web3.utils.toWei('1.1') // ETH
      }
    );

    await expect(
      await core.connect(userB).putForSale(
        1000,
        web3.utils.toWei('1.18')
      )
    ).to.emit(core, 'PutForSale')
    .withArgs(userB.address, userB.address, 1000, web3.utils.toWei('1.18'));
  });

  it("should buy with same amount as sales price on secondary sales", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB, userC] = accounts;
    const core = await deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await core.connect(userA).submitUniquette(fakeHash);
    await core.connect(fakeApprover).approveSubmission(fakeHash);
    await core.connect(userB).safeBuy(
      userB.address,
      1000,
      web3.utils.toHex('test'),
      {
        value: web3.utils.toWei('1.1') // ETH
      }
    );
    await core.connect(userB).putForSale(
      1000,
      web3.utils.toWei('1.18')
    );

    await expect(
      await core.connect(userC).safeBuy(
        userC.address,
        1000,
        web3.utils.toHex('test'),
        {
          value: web3.utils.toWei('1.298') // ETH
        }
      )
    ).to.changeEtherBalances([
      owner, core,
      fakeVault, fakeTreasury,
      userA,
      userB,
      userC,
    ], [
      web3.utils.toWei('0'), web3.utils.toWei('0'),
      web3.utils.toWei('0'), web3.utils.toWei('0.118'),
      web3.utils.toWei('0'),
      web3.utils.toWei('1.18'),
      web3.utils.toWei('-1.298'),
    ]);
  });

  it("should buy with higher amount than sales price on secondary sales", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB, userC] = accounts;
    const core = await deployCore(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await core.connect(userA).submitUniquette(fakeHash);
    await core.connect(fakeApprover).approveSubmission(fakeHash);
    await core.connect(userB).safeBuy(
      userB.address,
      1000,
      web3.utils.toHex('test'),
      {
        value: web3.utils.toWei('1.1') // ETH
      }
    );
    await core.connect(userB).putForSale(
      1000,
      web3.utils.toWei('1.18')
    );

    await expect(
      await core.connect(userC).safeBuy(
        userC.address,
        1000,
        web3.utils.toHex('test'),
        {
          value: web3.utils.toWei('4') // ETH
        }
      )
    ).to.changeEtherBalances([
      owner, core,
      fakeVault, fakeTreasury,
      userA,
      userB,
      userC,
    ], [
      web3.utils.toWei('0'), web3.utils.toWei('0'),
      web3.utils.toWei('2.702'), web3.utils.toWei('0.118'),
      web3.utils.toWei('0'),
      web3.utils.toWei('1.18'),
      web3.utils.toWei('-4.0'),
    ]);
  });
});

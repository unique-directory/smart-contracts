const { expect } = require("chai");
const { v4: uuid } = require("uuid");
const web3 = require("web3");

async function deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer) {
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy(
    "Unique Directory Governance Tokens",
    "UNQ",
  );

  const Directory = await ethers.getContractFactory("Directory");
  const directory = await Directory.deploy(
    "Unique Directory NFT Uniquettes",
    "UQT",
    "ipfs://",
    token.address,
    fakeVault.address,
    fakeTreasury.address,
    fakeApprover.address,
    fakeMarketer.address,
    [
      web3.utils.toWei('1'), // initialUniquettePrice: 1 ETH
      5000,        // originalAuthorShare: 40%
      500,         // protocolFee: 5%
      web3.utils.toWei('5000'), // submissionPrize: 5000 UNQ
      1,           // currentMetadataVersion
      1,           // minMetadataVersion
      1000,         // maxPriceIncrease: 8%
    ]
  );

  await token.grantRole(web3.utils.soliditySha3('MINTER_ROLE'), directory.address);

  return { token, directory };
}

describe("Directory", () => {
  /**
   * @type Signer[]
   */
  let accounts;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
  });

  it("should submit a new uniquette", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA] = accounts;
    const { directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await expect(directory.connect(userA).uniquetteSubmit(fakeHash))
      .to.emit(directory, 'UniquetteSubmitted')
      .withArgs(userA.address, fakeHash);
  });

  it("should approve a uniquette submission", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA] = accounts;
    const { directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(fakeHash);
    await expect(directory.connect(fakeApprover).uniquetteApprove(fakeHash))
      .to.emit(directory, 'UniquetteApproved')
      .withArgs(fakeApprover.address, userA.address, fakeHash, 1);
  });

  it("should reject a uniquette submission", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA] = accounts;
    const { directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(fakeHash);
    await expect(directory.connect(fakeApprover).uniquetteReject(fakeHash))
      .to.emit(directory, 'UniquetteRejected')
      .withArgs(fakeApprover.address, userA.address, fakeHash);
  });

  it("should reward UNQ to original author as submission prize", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(fakeHash);
    await directory.connect(fakeApprover).uniquetteApprove(fakeHash);

    await expect(
      await token.balanceOf(userA.address)
    ).to.equal(web3.utils.toWei('5000'));
  });

  it.only("should sell a new uniquette to a buyer", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(fakeHash);
    await directory.connect(fakeApprover).uniquetteApprove(fakeHash);
    await expect(
      await directory.connect(userB).uniquetteBuy(
        userB.address,
        1,
        {
          value: web3.utils.toWei('1.1') // 1 ETH
        }
      )
    ).to.changeEtherBalances([
      directory,
      fakeVault,
      fakeTreasury,
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
      await directory.balanceOf(userB.address)
    ).to.equal(1);
  });

  it("should pay protocol fee to treasury on first sale", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(fakeHash);
    await directory.connect(fakeApprover).uniquetteApprove(fakeHash);

    await expect(
      await directory.connect(userB).uniquetteBuy(
        userB.address,
        1,
        {
          value: web3.utils.toWei('1.1') // 1.1 ETH
        }
      )
    ).to.changeEtherBalance(fakeTreasury, web3.utils.toWei('0.1'));
  });

  it("should transfer additional payment as collateral to vault on first sale", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(fakeHash);
    await directory.connect(fakeApprover).uniquetteApprove(fakeHash);

    await expect(
      await directory.connect(userB).uniquetteBuy(
        userB.address,
        1,
        {
          value: web3.utils.toWei('1.1') // 1.1 ETH
        }
      )
    ).to.changeEtherBalance(fakeVault, web3.utils.toWei('0.6'));
  });

  it("should pay the original author based on configured share on first sale", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(fakeHash);
    await directory.connect(fakeApprover).uniquetteApprove(fakeHash);

    await expect(
      await directory.connect(userB).uniquetteBuy(
        userB.address,
        1,
        {
          value: web3.utils.toWei('1.1') // ETH
        }
      )
    ).to.changeEtherBalance(userA, web3.utils.toWei('0.4'));
  });

  it("should put on sale based on desired price", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(fakeHash);
    await directory.connect(fakeApprover).uniquetteApprove(fakeHash);
    await directory.connect(userB).uniquetteBuy(
      userB.address,
      1,
      {
        value: web3.utils.toWei('1.1') // ETH
      }
    );

    await expect(
      await directory.connect(userB).uniquetteForSale(
        1,
        web3.utils.toWei('1.18')
      )
    ).to.emit(directory, 'PutForSale')
    .withArgs(userB.address, userB.address, 1, fakeHash, web3.utils.toWei('1.18'));
  });

  it("should buy with same amount as sales price on secondary sales", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB, userC] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(fakeHash);
    await directory.connect(fakeApprover).uniquetteApprove(fakeHash);
    await directory.connect(userB).uniquetteBuy(
      userB.address,
      1,
      {
        value: web3.utils.toWei('1.1') // ETH
      }
    );
    await directory.connect(userB).uniquetteForSale(
      1,
      web3.utils.toWei('1.18')
    );

    await expect(
      await directory.connect(userC).uniquetteBuy(
        userC.address,
        1,
        {
          value: web3.utils.toWei('1.298') // ETH
        }
      )
    ).to.changeEtherBalances([
      owner, directory,
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
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(fakeHash);
    await directory.connect(fakeApprover).uniquetteApprove(fakeHash);
    await directory.connect(userB).uniquetteBuy(
      userB.address,
      1,
      {
        value: web3.utils.toWei('1.1') // ETH
      }
    );
    await directory.connect(userB).uniquetteForSale(
      1,
      web3.utils.toWei('1.18')
    );

    await expect(
      await directory.connect(userC).uniquetteBuy(
        userC.address,
        1,
        {
          value: web3.utils.toWei('4') // ETH
        }
      )
    ).to.changeEtherBalances([
      owner, directory,
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

  it("should sell for price lower than last purchase but higher than collateral", async () => {
    const [owner, fakeVault, fakeTreasury, fakeApprover, fakeMarketer, userA, userB, userC] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeApprover, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(fakeHash);
    await directory.connect(fakeApprover).uniquetteApprove(fakeHash);
    await directory.connect(userB).uniquetteBuy(
      userB.address,
      1,
      {
        value: web3.utils.toWei('1.1') // ETH
      }
    );
    await directory.connect(userB).uniquetteForSale(
      1,
      web3.utils.toWei('0.8')
    );

    await expect(
      await directory.connect(userC).uniquetteBuy(
        userC.address,
        1,
        {
          value: web3.utils.toWei('0.88') // ETH
        }
      )
    ).to.changeEtherBalances([
      owner, directory,
      fakeVault, fakeTreasury,
      userA,
      userB,
      userC,
    ], [
      web3.utils.toWei('0'), web3.utils.toWei('0'),
      web3.utils.toWei('0'), web3.utils.toWei('0.08'),
      web3.utils.toWei('0'),
      web3.utils.toWei('0.8'),
      web3.utils.toWei('-0.88'),
    ]);
  });
});

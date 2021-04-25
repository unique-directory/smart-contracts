const { expect } = require("chai");
const { v4: uuid } = require("uuid");
const web3 = require("web3");

async function deploy(fakeVault, fakeTreasury, fakeMarketer) {
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
    fakeMarketer.address,
    [
      web3.utils.toWei('1'), // initialUniquettePrice: 1 ETH
      5000,        // originalAuthorShare: 50%
      500,         // protocolFee: 5%
      web3.utils.toWei('5000'), // submissionPrize: 5000 UNQ
      web3.utils.toWei('0.1'), // submissionCollateral: 0.1 ETH
      7890000,     // firstSaleDeadline: 90 days
      1,           // currentMetadataVersion
      1,           // minMetadataVersion
      1000,        // maxPriceIncrease: 8%
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
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA] = accounts;
    const { directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await expect(
      directory.connect(userA).uniquetteSubmit(
        fakeHash,
        1, // Schema v1
        {
          value: web3.utils.toWei('0.1') // ETH
        }
      )
    )
      .to.emit(directory, 'UniquetteSubmitted')
      .withArgs(userA.address, fakeHash, web3.utils.toWei('0.1'));
  });

  it("should approve a uniquette submission", async () => {
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA] = accounts;
    const { directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await expect(directory.connect(governor).uniquetteApprove(fakeHash))
      .to.emit(directory, 'UniquetteApproved')
      .withArgs(governor.address, userA.address, fakeHash, 1);
  });

  it("should reject a uniquette submission", async () => {
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA] = accounts;
    const { directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await expect(directory.connect(governor).uniquetteReject(fakeHash))
      .to.emit(directory, 'UniquetteRejected')
      .withArgs(governor.address, userA.address, fakeHash);
  });

  it("should not reward original author on approval", async () => {
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directory.connect(governor).uniquetteApprove(fakeHash);

    await expect(
      await token.balanceOf(userA.address)
    ).to.equal(0);
  });

  it("should sell a new uniquette to a buyer and reward original author", async () => {
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA, userB] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directory.connect(governor).uniquetteApprove(fakeHash);
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
      await token.balanceOf(userA.address)
    ).to.equal(web3.utils.toWei('5000'));
    await expect(
      await directory.balanceOf(userB.address)
    ).to.equal(1);
  });

  it("should pay protocol fee to treasury on first sale", async () => {
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA, userB] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directory.connect(governor).uniquetteApprove(fakeHash);

    await expect(
      await directory.connect(userB).uniquetteBuy(
        userB.address,
        1,
        {
          value: web3.utils.toWei('1.1') // 1.1 ETH
        }
      )
    ).to.changeEtherBalance(fakeTreasury, web3.utils.toWei('0.05'));
  });

  it("should transfer additional payment as collateral to vault on first sale", async () => {
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA, userB] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directory.connect(governor).uniquetteApprove(fakeHash);

    await expect(
      await directory.connect(userB).uniquetteBuy(
        userB.address,
        1,
        {
          value: web3.utils.toWei('1.1') // 1.1 ETH
        }
      )
    ).to.changeEtherBalance(fakeVault, web3.utils.toWei('0.55'));
  });

  it("should pay the original author based on configured share on first sale", async () => {
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA, userB] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directory.connect(governor).uniquetteApprove(fakeHash);

    await expect(
      await directory.connect(userB).uniquetteBuy(
        userB.address,
        1,
        {
          value: web3.utils.toWei('1.1') // ETH
        }
      )
    ).to.changeEtherBalance(userA, web3.utils.toWei('0.5'));
  });

  it("should put on sale based on desired price", async () => {
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA, userB] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directory.connect(governor).uniquetteApprove(fakeHash);
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
    ).to.emit(directory, 'UniquettePutForSale')
    .withArgs(userB.address, userB.address, 1, fakeHash, web3.utils.toWei('1.18'));
  });

  it("should buy with same amount as sales price on secondary sales", async () => {
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA, userB, userC] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directory.connect(governor).uniquetteApprove(fakeHash);
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
          value: web3.utils.toWei('1.239') // ETH
        }
      )
    ).to.changeEtherBalances([
      governor, directory,
      fakeVault, fakeTreasury,
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
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA, userB, userC] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directory.connect(governor).uniquetteApprove(fakeHash);
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
      governor, directory,
      fakeVault, fakeTreasury,
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
    const [governor, fakeVault, fakeTreasury, fakeMarketer, userA, userB, userC] = accounts;
    const { token, directory } = await deploy(fakeVault, fakeTreasury, fakeMarketer);

    const fakeHash = uuid();

    await directory.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1') // ETH
      }
    );
    await directory.connect(governor).uniquetteApprove(fakeHash);
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
          value: web3.utils.toWei('0.84') // ETH
        }
      )
    ).to.changeEtherBalances([
      governor, directory,
      fakeVault, fakeTreasury,
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

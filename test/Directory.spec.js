const {deployments,getUnnamedAccounts,getNamedAccounts} = require('hardhat');
const {expect} = require('chai');
const {v4: uuid} = require('uuid');
const web3 = require('web3');

describe('Directory', () => {
  let governor;
  let accounts;
  let directoryContract;
  let tokenContract;
  let vaultContract;
  let treasuryContract;

  beforeEach(async () => {
    await deployments.fixture();

    governor = (await getNamedAccounts()).deployer;
    accounts = await getUnnamedAccounts();

    tokenContract = await ethers.getContract('Token', governor);
    treasuryContract = await ethers.getContract('Treasury', governor);
    directoryContract = await ethers.getContract('Directory', governor);
    vaultContract = await ethers.getContract('Vault', governor);
  });

  it.only('should submit a new uniquette', async () => {
    const [, userA] = accounts;
    const fakeHash = uuid();

    await expect(
      directoryContract.connect(userA).uniquetteSubmit(
        fakeHash,
        1, // Schema v1
        {
          value: web3.utils.toWei('0.1'), // ETH
        }
      )
    )
      .to.emit(directoryContract, 'UniquetteSubmitted')
      .withArgs(userA, fakeHash, web3.utils.toWei('0.1'));
  });

  it('should approve a uniquette submission', async () => {
    const [userA] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await expect(
      directoryContract
        .connect(governor)
        .uniquetteApprove(fakeHash, web3.utils.toWei('5000'))
    )
      .to.emit(directoryContract, 'UniquetteApproved')
      .withArgs(userA, fakeHash, 1);
  });

  it('should reject a uniquette submission', async () => {
    const [userA] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await expect(directoryContract.connect(governor).uniquetteReject(fakeHash))
      .to.emit(directoryContract, 'UniquetteRejected')
      .withArgs(userA, fakeHash);
  });

  it('should not reward original author on approval', async () => {
    const [userA] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await directoryContract
      .connect(governor)
      .uniquetteApprove(fakeHash, web3.utils.toWei('5000'));

    await expect(await tokenContract.balanceOf(userA)).to.equal(0);
  });

  it('should sell a new uniquette to a buyer and reward original author', async () => {
    const [userA, userB] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await directoryContract
      .connect(governor)
      .uniquetteApprove(fakeHash, web3.utils.toWei('4000'));
    await expect(
      await directoryContract.connect(userB).uniquetteBuy(userB, 1, {
        value: web3.utils.toWei('1.05'),
      })
    ).to.changeEtherBalances(
      [directoryContract, vaultContract, treasuryContract, userA, userB],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('1'),
        web3.utils.toWei('0.05'),
        web3.utils.toWei('0'),
        web3.utils.toWei('-1.05'),
      ]
    );

    await expect(await tokenContract.balanceOf(userA)).to.equal(
      web3.utils.toWei('4000')
    );
    await expect(await directoryContract.balanceOf(userB)).to.equal(1);
  });

  it('should increase the collateral when owner sends eth', async () => {
    const [userA, userB] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await directoryContract
      .connect(governor)
      .uniquetteApprove(fakeHash, web3.utils.toWei('5000'));
    await expect(
      await directoryContract.connect(userB).uniquetteBuy(userB, 1, {
        value: web3.utils.toWei('1.05'),
      })
    ).to.changeEtherBalances(
      [directoryContract, vaultContract, treasuryContract, userA, userB],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('1'),
        web3.utils.toWei('0.05'),
        web3.utils.toWei('0'),
        web3.utils.toWei('-1.05'),
      ]
    );

    await expect(
      await directoryContract.connect(userB).uniquetteIncreaseCollateral(1, {
        value: web3.utils.toWei('3'),
      })
    )
      .to.emit(directoryContract, 'UniquetteCollateralIncreased')
      .withArgs(userB, userB, 1, web3.utils.toWei('3'));

    await expect(
      await directoryContract.connect(userB).uniquetteIncreaseCollateral(1, {
        value: web3.utils.toWei('4'),
      })
    ).to.changeEtherBalances(
      [directoryContract, vaultContract, treasuryContract, userA, userB],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('4'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('-4'),
      ]
    );
  });

  it('should pay protocol fee to treasury on first sale', async () => {
    const [userA, userB] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await directoryContract
      .connect(governor)
      .uniquetteApprove(fakeHash, web3.utils.toWei('5000'));

    await expect(
      await directoryContract.connect(userB).uniquetteBuy(userB, 1, {
        value: web3.utils.toWei('1.1'), // 1.1 ETH
      })
    ).to.changeEtherBalance(treasuryContract, web3.utils.toWei('0.05'));
  });

  it('should transfer additional payment as collateral to vault on first sale', async () => {
    const [userA, userB] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await directoryContract
      .connect(governor)
      .uniquetteApprove(fakeHash, web3.utils.toWei('5000'));

    await expect(
      await directoryContract.connect(userB).uniquetteBuy(userB, 1, {
        value: web3.utils.toWei('1.1'), // 1.1 ETH
      })
    ).to.changeEtherBalance(vaultContract, web3.utils.toWei('1.05'));
  });

  it('should not pay the original author if configured share is zero on first sale', async () => {
    const [userA, userB] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await directoryContract
      .connect(governor)
      .uniquetteApprove(fakeHash, web3.utils.toWei('5000'));

    await expect(
      await directoryContract.connect(userB).uniquetteBuy(userB, 1, {
        value: web3.utils.toWei('1.1'), // ETH
      })
    ).to.changeEtherBalance(userA, web3.utils.toWei('0'));
  });

  it('should put on sale based on desired price', async () => {
    const [userA, userB] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await directoryContract
      .connect(governor)
      .uniquetteApprove(fakeHash, web3.utils.toWei('5000'));
    await directoryContract.connect(userB).uniquetteBuy(userB, 1, {
      value: web3.utils.toWei('1.1'), // ETH
    });

    await expect(
      await directoryContract
        .connect(userB)
        .uniquetteForSale(1, web3.utils.toWei('1.18'))
    )
      .to.emit(directoryContract, 'UniquettePutForSale')
      .withArgs(
        userB,
        userB,
        1,
        fakeHash,
        web3.utils.toWei('1.18')
      );
  });

  it('should buy with same amount as sales price on secondary sales', async () => {
    const [userA, userB, userC] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await directoryContract
      .connect(governor)
      .uniquetteApprove(fakeHash, web3.utils.toWei('5000'));
    await directoryContract.connect(userB).uniquetteBuy(userB, 1, {
      value: web3.utils.toWei('1.1'), // ETH
    });
    await directoryContract
      .connect(userB)
      .uniquetteForSale(1, web3.utils.toWei('1.18'));

    await expect(
      await directoryContract.connect(userC).uniquetteBuy(userC, 1, {
        value: web3.utils.toWei('1.239'), // ETH
      })
    ).to.changeEtherBalances(
      [
        governor,
        directoryContract,
        vaultContract,
        treasuryContract,
        userA,
        userB,
        userC,
      ],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0.059'),
        web3.utils.toWei('0'),
        web3.utils.toWei('1.18'),
        web3.utils.toWei('-1.239'),
      ]
    );
  });

  it('should buy with higher amount than sales price on secondary sales', async () => {
    const [userA, userB, userC] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await directoryContract
      .connect(governor)
      .uniquetteApprove(fakeHash, web3.utils.toWei('5000'));
    await directoryContract.connect(userB).uniquetteBuy(userB, 1, {
      value: web3.utils.toWei('1.1'), // ETH
    });
    await directoryContract
      .connect(userB)
      .uniquetteForSale(1, web3.utils.toWei('1.18'));

    await expect(
      await directoryContract.connect(userC).uniquetteBuy(userC, 1, {
        value: web3.utils.toWei('4'), // ETH
      })
    ).to.changeEtherBalances(
      [
        governor,
        directoryContract,
        vaultContract,
        treasuryContract,
        userA,
        userB,
        userC,
      ],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('2.761'),
        web3.utils.toWei('0.059'),
        web3.utils.toWei('0'),
        web3.utils.toWei('1.18'),
        web3.utils.toWei('-4.0'),
      ]
    );
  });

  it('should sell for price lower than last purchase but higher than collateral', async () => {
    const [userA, userB, userC] = accounts;
    const fakeHash = uuid();

    await directoryContract.connect(userA).uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await directoryContract
      .connect(governor)
      .uniquetteApprove(fakeHash, web3.utils.toWei('5000'));
    await directoryContract.connect(userB).uniquetteBuy(userB, 1, {
      value: web3.utils.toWei('1.05'), // ETH
    });
    await directoryContract
      .connect(userB)
      .uniquetteForSale(1, web3.utils.toWei('1.02'));

    await expect(
      await directoryContract.connect(userC).uniquetteBuy(userC, 1, {
        value: web3.utils.toWei('1.071'), // ETH
      })
    ).to.changeEtherBalances(
      [
        governor,
        directoryContract,
        vaultContract,
        treasuryContract,
        userA,
        userB,
        userC,
      ],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0.051'),
        web3.utils.toWei('0'),
        web3.utils.toWei('1.02'),
        web3.utils.toWei('-1.071'),
      ]
    );
  });
});

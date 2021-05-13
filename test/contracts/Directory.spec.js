const {expect} = require('chai');
const {v4: uuid} = require('uuid');
const web3 = require('web3');

const {setupTest} = require('../setup');

describe('Directory', () => {
  it('should submit a new uniquette', async () => {
    const {userA} = await setupTest();
    const fakeHash = uuid();

    await expect(
      userA.directoryContract.uniquetteSubmit(
        fakeHash,
        1, // Schema v1
        {
          value: web3.utils.toWei('0.1'), // ETH
        }
      )
    )
      .to.emit(userA.directoryContract, 'UniquetteSubmitted')
      .withArgs(userA.signer.address, fakeHash, web3.utils.toWei('0.1'));
  });

  it('should approve a uniquette submission', async () => {
    const {governor, userA} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await expect(
      governor.directoryContract.uniquetteApprove(
        fakeHash,
        web3.utils.toWei('5000')
      )
    )
      .to.emit(governor.directoryContract, 'UniquetteApproved')
      .withArgs(governor.signer.address, userA.signer.address, fakeHash, 1);
  });

  it('should reject a uniquette submission', async () => {
    const {governor, userA} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await expect(governor.directoryContract.uniquetteReject(fakeHash))
      .to.emit(governor.directoryContract, 'UniquetteRejected')
      .withArgs(governor.signer.address, userA.signer.address, fakeHash);
  });

  it('should not reward original author on approval', async () => {
    const {governor, userA} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await governor.directoryContract.uniquetteApprove(
      fakeHash,
      web3.utils.toWei('5000')
    );

    await expect(await userA.tokenContract.balanceOf(userA.signer.address)).to.equal(
      0
    );
  });

  it('should sell a new uniquette to a buyer and reward original author', async () => {
    const {governor, userA, userB} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await governor.directoryContract.uniquetteApprove(
      fakeHash,
      web3.utils.toWei('4000')
    );

    await expect(
      await userB.directoryContract.uniquetteBuy(userB.signer.address, 1, {
        value: web3.utils.toWei('1.05'),
      })
    ).to.changeEtherBalances(
      [
        userB.directoryContract,
        userB.vaultContract,
        userB.treasuryContract,
        userA.signer,
        userB.signer,
      ],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('1'),
        web3.utils.toWei('0.05'),
        web3.utils.toWei('0'),
        web3.utils.toWei('-1.05'),
      ]
    );

    await expect(await userA.tokenContract.balanceOf(userA.signer.address)).to.equal(
      web3.utils.toWei('4000')
    );
    await expect(
      await userB.directoryContract.balanceOf(userB.signer.address)
    ).to.equal(1);
  });

  it('should increase the collateral when owner sends eth', async () => {
    const {governor, userA, userB} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await governor.directoryContract.uniquetteApprove(
      fakeHash,
      web3.utils.toWei('5000')
    );
    await expect(
      await userB.directoryContract.uniquetteBuy(userB.signer.address, 1, {
        value: web3.utils.toWei('1.05'),
      })
    ).to.changeEtherBalances(
      [
        userB.directoryContract,
        userB.vaultContract,
        userB.treasuryContract,
        userA.signer,
        userB.signer,
      ],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('1'),
        web3.utils.toWei('0.05'),
        web3.utils.toWei('0'),
        web3.utils.toWei('-1.05'),
      ]
    );

    await expect(
      await userB.directoryContract.uniquetteIncreaseCollateral(1, {
        value: web3.utils.toWei('3'),
      })
    )
      .to.emit(userB.directoryContract, 'UniquetteCollateralIncreased')
      .withArgs(userB.signer.address, userB.signer.address, 1, web3.utils.toWei('3'));

    await expect(
      await userB.directoryContract.uniquetteIncreaseCollateral(1, {
        value: web3.utils.toWei('4'),
      })
    ).to.changeEtherBalances(
      [
        userB.directoryContract,
        userB.vaultContract,
        userB.treasuryContract,
        userA.signer,
        userB.signer,
      ],
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
    const {governor, userA, userB} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await governor.directoryContract.uniquetteApprove(
      fakeHash,
      web3.utils.toWei('5000')
    );

    await expect(
      await userB.directoryContract.uniquetteBuy(userB.signer.address, 1, {
        value: web3.utils.toWei('1.1'), // 1.1 ETH
      })
    ).to.changeEtherBalance(userB.treasuryContract, web3.utils.toWei('0.05'));
  });

  it('should transfer additional payment as collateral to vault on first sale', async () => {
    const {governor, userA, userB} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await governor.directoryContract.uniquetteApprove(
      fakeHash,
      web3.utils.toWei('5000')
    );

    await expect(
      await userB.directoryContract.uniquetteBuy(userB.signer.address, 1, {
        value: web3.utils.toWei('1.1'), // 1.1 ETH
      })
    ).to.changeEtherBalance(userB.vaultContract, web3.utils.toWei('1.05'));
  });

  it('should not pay the original author if configured share is zero on first sale', async () => {
    const {governor, userA, userB} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await governor.directoryContract.uniquetteApprove(
      fakeHash,
      web3.utils.toWei('5000')
    );

    await expect(
      await userB.directoryContract.uniquetteBuy(userB.signer.address, 1, {
        value: web3.utils.toWei('1.1'), // ETH
      })
    ).to.changeEtherBalance(userA.signer, web3.utils.toWei('0'));
  });

  it('should put on sale based on desired price', async () => {
    const {governor, userA, userB} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await governor.directoryContract.uniquetteApprove(
      fakeHash,
      web3.utils.toWei('5000')
    );
    await userB.directoryContract.uniquetteBuy(userB.signer.address, 1, {
      value: web3.utils.toWei('1.1'), // ETH
    });

    await expect(
      await userB.directoryContract.uniquetteForSale(
        1,
        web3.utils.toWei('1.18')
      )
    )
      .to.emit(userB.directoryContract, 'UniquettePutForSale')
      .withArgs(userB.signer.address, userB.signer.address, 1, fakeHash, web3.utils.toWei('1.18'));
  });

  it('should buy with same amount as sales price on secondary sales', async () => {
    const {governor, userA, userB, userC} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await governor.directoryContract.uniquetteApprove(
      fakeHash,
      web3.utils.toWei('5000')
    );
    await userB.directoryContract.uniquetteBuy(userB.signer.address, 1, {
      value: web3.utils.toWei('1.1'), // ETH
    });
    await userB.directoryContract.uniquetteForSale(1, web3.utils.toWei('1.18'));

    await expect(
      await userC.directoryContract.uniquetteBuy(userC.signer.address, 1, {
        value: web3.utils.toWei('1.239'), // ETH
      })
    ).to.changeEtherBalances(
      [
        governor.signer,
        userC.directoryContract,
        userC.vaultContract,
        userC.treasuryContract,
        userA.signer,
        userB.signer,
        userC.signer,
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
    const {governor, userA, userB, userC} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await governor.directoryContract.uniquetteApprove(
      fakeHash,
      web3.utils.toWei('5000')
    );
    await userB.directoryContract.uniquetteBuy(userB.signer.address, 1, {
      value: web3.utils.toWei('1.1'), // ETH
    });
    await userB.directoryContract.uniquetteForSale(1, web3.utils.toWei('1.18'));

    await expect(
      await userC.directoryContract.uniquetteBuy(userC.signer.address, 1, {
        value: web3.utils.toWei('4'), // ETH
      })
    ).to.changeEtherBalances(
      [
        governor.signer,
        userC.directoryContract,
        userC.vaultContract,
        userC.treasuryContract,
        userA.signer,
        userB.signer,
        userC.signer,
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
    const {governor, userA, userB, userC} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.uniquetteSubmit(
      fakeHash,
      1, // Schema v1
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );
    await governor.directoryContract.uniquetteApprove(
      fakeHash,
      web3.utils.toWei('5000')
    );
    await userB.directoryContract.uniquetteBuy(userB.signer.address, 1, {
      value: web3.utils.toWei('1.05'), // ETH
    });
    await userB.directoryContract.uniquetteForSale(1, web3.utils.toWei('1.02'));

    await expect(
      await userC.directoryContract.uniquetteBuy(userC.signer.address, 1, {
        value: web3.utils.toWei('1.071'), // ETH
      })
    ).to.changeEtherBalances(
      [
        governor.signer,
        userC.directoryContract,
        userC.vaultContract,
        userC.treasuryContract,
        userA.signer,
        userB.signer,
        userC.signer,
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
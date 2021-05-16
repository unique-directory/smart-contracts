const {expect} = require('chai');
const {v4: uuid} = require('uuid');
const web3 = require('web3');

const {setupTest} = require('../setup');

describe('Vault', () => {
  it('should liquidate a uniquette and pay the owner', async () => {
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
    await userB.directoryContract.uniquetteCollect(userB.signer.address, 1, {
      value: web3.utils.toWei('1.05'), // ETH
    });

    await expect(
      await userB.vaultContract.uniquetteLiquidate(1, userB.signer.address)
    ).to.changeEtherBalances(
      [
        governor.signer,
        userB.directoryContract,
        userB.vaultContract,
        userB.treasuryContract,
        userA.signer,
        userB.signer,
        userC.signer,
      ],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('-1'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('1'),
        web3.utils.toWei('0'),
      ]
    );

    await expect(await userA.directoryContract.ownerOf(1)).to.equal(
      userA.vaultContract.address
    );
  });

  it('should allow buying a liquidated uniquette', async () => {
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
    await userB.directoryContract.uniquetteCollect(userB.signer.address, 1, {
      value: web3.utils.toWei('1.05'),
    });

    await userB.vaultContract.uniquetteLiquidate(1, userB.signer.address);

    await expect(
      await userC.directoryContract.uniquetteCollect(userC.signer.address, 1, {
        value: web3.utils.toWei('1.05'), // ETH
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
        web3.utils.toWei('1'),
        web3.utils.toWei('0.05'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('-1.05'),
      ]
    );

    await expect(await userC.directoryContract.ownerOf(1)).to.equal(
      userC.signer.address
    );
  });

  it('should liquidate a previously liquidated uniquette', async () => {
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
    await userB.directoryContract.uniquetteCollect(userB.signer.address, 1, {
      value: web3.utils.toWei('1.05'), // ETH
    });

    await userB.vaultContract.uniquetteLiquidate(1, userB.signer.address);

    await userC.directoryContract.uniquetteCollect(userC.signer.address, 1, {
      value: web3.utils.toWei('1.05'),
    });

    await expect(
      await userC.vaultContract.uniquetteLiquidate(1, userC.signer.address)
    ).to.changeEtherBalances(
      [
        governor.signer,
        userA.directoryContract,
        userA.vaultContract,
        userA.treasuryContract,
        userA.signer,
        userB.signer,
        userC.signer,
      ],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('-1'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('1'),
      ]
    );

    await expect(await userA.directoryContract.ownerOf(1)).to.equal(
      userA.vaultContract.address
    );
  });
});

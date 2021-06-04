const {expect} = require('chai');
const {v4: uuid} = require('uuid');
const web3 = require('web3');

const {setupTest} = require('../setup');
const {calculateRequiredPayment} = require('../util');

describe('Vault', () => {
  it('should liquidate a uniquette and pay the owner', async () => {
    const {userA, userB, userC, governor} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.submissionCreate(
      0,
      fakeHash,
      1, // Schema v1
      web3.utils.toWei('1'), // ETH - valueAdded
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await governor.directoryContract.submissionApprove(
      fakeHash,
      web3.utils.toWei('100') // UNQ - reward
    );

    await userB.directoryContract.submissionFund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

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

    await userA.directoryContract.submissionCreate(
      0,
      fakeHash,
      1, // Schema v1
      web3.utils.toWei('1'), // ETH - valueAdded
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await governor.directoryContract.submissionApprove(
      fakeHash,
      web3.utils.toWei('100') // UNQ - reward
    );

    await userB.directoryContract.submissionFund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(),
      }
    );

    await userB.vaultContract.uniquetteLiquidate(1, userB.signer.address);

    await expect(
      await userC.directoryContract.uniquetteCollect(userC.signer.address, 1, {
        value: calculateRequiredPayment('1.1').toString(),
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
        web3.utils.toWei('1.1'),
        web3.utils.toWei('0.055'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('-1.155'),
      ]
    );

    await expect(await userC.directoryContract.ownerOf(1)).to.equal(
      userC.signer.address
    );
  });

  it('should liquidate a previously liquidated uniquette', async () => {
    const {governor, userA, userB, userC} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.submissionCreate(
      0,
      fakeHash,
      1, // Schema v1
      web3.utils.toWei('1'), // ETH - valueAdded
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await governor.directoryContract.submissionApprove(
      fakeHash,
      web3.utils.toWei('100') // UNQ - reward
    );

    await userB.directoryContract.submissionFund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await userB.vaultContract.uniquetteLiquidate(1, userB.signer.address);

    await userC.directoryContract.uniquetteCollect(userC.signer.address, 1, {
      value: calculateRequiredPayment('1.1').toString(),
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

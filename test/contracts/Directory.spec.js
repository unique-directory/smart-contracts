
const {expect} = require('chai');
const {v4: uuid} = require('uuid');
const web3 = require('web3');

const {setupTest} = require('../setup');
const {calculateRequiredPayment} = require('../util');

describe('Directory', () => {
  it('should create a new submission for a new uniquette', async () => {
    const {userA} = await setupTest();
    const fakeHash = uuid();

    await expect(
      userA.directoryContract.submissionCreate(
        0, // A new uniquette, therefore tokenId = 0
        fakeHash,
        1, // Schema v1
        web3.utils.toWei('1'), // ETH
        {
          value: web3.utils.toWei('0.1'), // ETH
        }
      )
    )
      .to.emit(userA.directoryContract, 'SubmissionCreated')
      .withArgs(
        userA.signer.address,
        0,
        fakeHash,
        web3.utils.toWei('1'),
        web3.utils.toWei('0.1')
      );
  });

  it('should approve a new submission for a new uniquette', async () => {
    const {userA, governor} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.submissionCreate(
      0,
      fakeHash,
      1, // Schema v1
      web3.utils.toWei('1'), // ETH
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await expect(
      governor.directoryContract.submissionApprove(
        fakeHash,
        web3.utils.toWei('100') // UNQ
      )
    )
      .to.emit(userA.directoryContract, 'SubmissionApproved')
      .withArgs(
        governor.signer.address,
        userA.signer.address,
        fakeHash,
        web3.utils.toWei('100')
      );
  });

  it('should reject a new submission for a new uniquette', async () => {
    const {userA, governor} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.submissionCreate(
      0,
      fakeHash,
      1, // Schema v1
      web3.utils.toWei('1'), // ETH
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await expect(governor.directoryContract.submissionReject(fakeHash))
      .to.emit(userA.directoryContract, 'SubmissionRejected')
      .withArgs(governor.signer.address, userA.signer.address, fakeHash);
  });

  it('should fund a new submission for a new uniquette with no additional collateral', async () => {
    const {userA, userB, governor} = await setupTest();
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

    await expect(
      userB.directoryContract.fund(
        userB.signer.address,
        1, // Token ID
        fakeHash,
        {
          value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
        }
      )
    )
      .to.emit(userA.directoryContract, 'SubmissionFunded')
      .withArgs(
        userB.signer.address,
        userB.signer.address,
        1,
        fakeHash,
        web3.utils.toWei('1'),
        web3.utils.toWei('1.052631578947368421')
      );

    const uniquette = await userB.directoryContract.uniquetteGetById(
      1 // Token ID
    );

    expect(uniquette.collateralValue.toString()).eq(web3.utils.toWei('1'));
  });

  it('should fund a new submission for a new uniquette and reward author', async () => {
    const {userA, userB, governor} = await setupTest();
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

    await expect(
      await userB.directoryContract.fund(
        userB.signer.address,
        1, // Token ID
        fakeHash,
        {
          value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
        }
      )
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
        web3.utils.toWei('0.052631578947368421'),
        web3.utils.toWei('0'),
        web3.utils.toWei('-1.052631578947368421'),
      ]
    );

    const uniquette = await userB.directoryContract.uniquetteGetById(
      1 // Token ID
    );

    expect(uniquette.collateralValue.toString()).eq(web3.utils.toWei('1'));
  });

  it('should fund a new submission for a new uniquette with some additional collateral', async () => {
    const {userA, userB, governor} = await setupTest();
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

    await expect(
      userB.directoryContract.fund(
        userB.signer.address,
        1, // Token ID
        fakeHash,
        {
          value: calculateRequiredPayment('1', '2').toString(), // ETH : valueAdded + fee
        }
      )
    )
      .to.emit(userA.directoryContract, 'SubmissionFunded')
      .withArgs(
        userB.signer.address,
        userB.signer.address,
        1,
        fakeHash,
        web3.utils.toWei('1'),
        web3.utils.toWei('3.157894736842105263')
      );

    const uniquette = await userB.directoryContract.uniquetteGetById(
      1 // Token ID
    );

    expect(uniquette.collateralValue.toString()).eq(
      web3.utils.toWei('3') // ETH
    );
  });

  it('should collect an existing uniquette with no additional collateral', async () => {
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userC.directoryContract.collect(
        userC.signer.address,
        1, // Token ID
        {
          value: calculateRequiredPayment('1.1').toString(), // ETH : (last principal amount + max appreciation) + fee
        }
      )
    )
      .to.emit(userC.directoryContract, 'UniquetteCollected')
      .withArgs(
        userC.signer.address,
        userB.signer.address,
        userC.signer.address,
        1,
        web3.utils.toWei('1.1')
      );

    const uniquette = await userC.directoryContract.uniquetteGetById(
      1 // Token ID
    );

    expect(uniquette.collateralValue.toString()).eq(web3.utils.toWei('1'));
  });

  it('should collect an existing uniquette with some additional collateral', async () => {
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    const uniquetteAfterFund = await userC.directoryContract.uniquetteGetById(
      1 // Token ID
    );

    expect(uniquetteAfterFund.collateralValue.toString()).eq(
      web3.utils.toWei('1') // ETH
    );

    await expect(
      userC.directoryContract.collect(
        userC.signer.address,
        1, // Token ID
        {
          value: calculateRequiredPayment('1.1', '2').toString(), // ETH : (last principal amount + max appreciation) + fee
        }
      )
    )
      .to.emit(userC.directoryContract, 'UniquetteCollected')
      .withArgs(
        userC.signer.address,
        userB.signer.address,
        userC.signer.address,
        1,
        web3.utils.toWei('1.1')
      );

    const uniquetteAfterCollect =
      await userC.directoryContract.uniquetteGetById(
        1 // Token ID
      );

    expect(uniquetteAfterCollect.collateralValue.toString()).eq(
      web3.utils.toWei('3') // ETH
    );
  });

  it('should create a new submission for an existing uniquette', async () => {
    const {userA, userB, governor} = await setupTest();
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(fakeHash);

    const upgradeFakeHash = uuid();

    await expect(
      userA.directoryContract.submissionCreate(
        1, // existing uniquette with tokenId = 1
        upgradeFakeHash,
        1, // Schema v1
        web3.utils.toWei('0.5'), // ETH - valueAdded
        {
          value: web3.utils.toWei('0.1'), // ETH
        }
      )
    )
      .to.emit(userA.directoryContract, 'SubmissionCreated')
      .withArgs(
        userA.signer.address,
        1, // tokenId
        upgradeFakeHash,
        web3.utils.toWei('0.5'),
        web3.utils.toWei('0.1')
      );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(upgradeFakeHash);
  });

  it('should approve a new submission for an existing uniquette', async () => {
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(fakeHash);

    const upgradeFakeHash = uuid();

    await userC.directoryContract.submissionCreate(
      1, // existing uniquette with tokenId = 1
      upgradeFakeHash,
      1, // Schema v1
      web3.utils.toWei('0.5'), // ETH - valueAdded
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await expect(
      governor.directoryContract.submissionApprove(
        upgradeFakeHash,
        web3.utils.toWei('150') // UNQ
      )
    )
      .to.emit(userC.directoryContract, 'SubmissionApproved')
      .withArgs(
        governor.signer.address,
        userC.signer.address,
        upgradeFakeHash,
        web3.utils.toWei('150')
      );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(upgradeFakeHash);
  });

  it('should fund a new submission for an existing uniquette with no additional collateral', async () => {
    const {userA, userB, userC, userD, governor} = await setupTest();
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(fakeHash);

    const upgradeFakeHash = uuid();

    await userC.directoryContract.submissionCreate(
      1, // existing uniquette with tokenId = 1
      upgradeFakeHash,
      1, // Schema v1
      web3.utils.toWei('0.5'), // ETH - valueAdded
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await governor.directoryContract.submissionApprove(
      upgradeFakeHash,
      web3.utils.toWei('150') // UNQ
    );

    await expect(
      userD.directoryContract.fund(
        userD.signer.address,
        1, // Token ID
        upgradeFakeHash,
        {
          value: calculateRequiredPayment('1.6').toString(), // ETH : valueAdded + fee
        }
      )
    )
      .to.emit(userD.directoryContract, 'SubmissionFunded')
      .withArgs(
        userD.signer.address,
        userD.signer.address,
        1,
        upgradeFakeHash,
        web3.utils.toWei('1.6'),
        web3.utils.toWei('1.684210526315789473')
      );

    await expect(
      userD.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(upgradeFakeHash);
  });

  it('should fund a new submission for an existing uniquette and reward author', async () => {
    const {userA, userB, userC, userD, governor} = await setupTest();
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(fakeHash);

    const upgradeFakeHash = uuid();

    await userC.directoryContract.submissionCreate(
      1, // existing uniquette with tokenId = 1
      upgradeFakeHash,
      1, // Schema v1
      web3.utils.toWei('0.5'), // ETH - valueAdded
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await governor.directoryContract.submissionApprove(
      upgradeFakeHash,
      web3.utils.toWei('150') // UNQ
    );

    await expect(
      await userD.directoryContract.fund(
        userD.signer.address,
        1, // Token ID
        upgradeFakeHash,
        {
          value: calculateRequiredPayment('1.6').toString(), // ETH : valueAdded + fee
        }
      )
    ).to.changeEtherBalances(
      [
        userD.directoryContract,
        userD.vaultContract,
        userD.treasuryContract,
        userA.signer,
        userB.signer,
        userC.signer,
        userD.signer,
      ],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('0.5'),
        web3.utils.toWei('0.084210526315789473'),
        web3.utils.toWei('0'),
        web3.utils.toWei('1.1'),
        web3.utils.toWei('0'),
        web3.utils.toWei('-1.684210526315789473'),
      ]
    );

    await expect(
      await userA.tokenContract.balanceOf(userA.signer.address)
    ).to.equal(web3.utils.toWei('100'));

    await expect(
      await userC.tokenContract.balanceOf(userC.signer.address)
    ).to.equal(web3.utils.toWei('150'));
  });

  it('should fund a new submission for an existing uniquette with some additional collateral', async () => {
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(fakeHash);

    const upgradeFakeHash = uuid();

    await userC.directoryContract.submissionCreate(
      1, // existing uniquette with tokenId = 1
      upgradeFakeHash,
      1, // Schema v1
      web3.utils.toWei('0.5'), // ETH - valueAdded
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await governor.directoryContract.submissionApprove(
      upgradeFakeHash,
      web3.utils.toWei('150') // UNQ
    );

    await expect(
      userA.directoryContract.fund(
        userA.signer.address,
        1, // Token ID
        upgradeFakeHash,
        {
          value: calculateRequiredPayment('1.6', '2').toString(), // ETH : valueAdded + fee
        }
      )
    )
      .to.emit(userA.directoryContract, 'SubmissionFunded')
      .withArgs(
        userA.signer.address,
        userA.signer.address,
        1,
        upgradeFakeHash,
        web3.utils.toWei('1.6'),
        web3.utils.toWei('3.789473684210526315')
      );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(upgradeFakeHash);
  });

  it('should increase the collateral when owner sends eth', async () => {
    const {userA, userB, governor} = await setupTest();
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

    await expect(
      userB.directoryContract.fund(
        userB.signer.address,
        1, // Token ID
        fakeHash,
        {
          value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
        }
      )
    )
      .to.emit(userA.directoryContract, 'SubmissionFunded')
      .withArgs(
        userB.signer.address,
        userB.signer.address,
        1,
        fakeHash,
        web3.utils.toWei('1'),
        web3.utils.toWei('1.052631578947368421')
      );

    await expect(
      await userB.directoryContract.uniquetteIncreaseCollateral(1, {
        value: web3.utils.toWei('3'),
      })
    )
      .to.emit(userB.directoryContract, 'UniquetteCollateralIncreased')
      .withArgs(
        userB.signer.address,
        userB.signer.address,
        1,
        web3.utils.toWei('3')
      );

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

  it('should increase effective price when collateral is increased', async () => {
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

    await expect(
      userB.directoryContract.fund(
        userB.signer.address,
        1, // Token ID
        fakeHash,
        {
          value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
        }
      )
    )
      .to.emit(userA.directoryContract, 'SubmissionFunded')
      .withArgs(
        userB.signer.address,
        userB.signer.address,
        1,
        fakeHash,
        web3.utils.toWei('1'),
        web3.utils.toWei('1.052631578947368421')
      );

    await expect(
      await userB.directoryContract.uniquetteIncreaseCollateral(1, {
        value: web3.utils.toWei('3'),
      })
    )
      .to.emit(userB.directoryContract, 'UniquetteCollateralIncreased')
      .withArgs(
        userB.signer.address,
        userB.signer.address,
        1,
        web3.utils.toWei('3')
      );

    await expect(
      userC.directoryContract.collect(
        userC.signer.address,
        1, // Token ID
        {
          value: calculateRequiredPayment('4.4').toString(), // ETH : (last principal amount + max appreciation) + fee
        }
      )
    )
      .to.emit(userC.directoryContract, 'UniquetteCollected')
      .withArgs(
        userC.signer.address,
        userB.signer.address,
        userC.signer.address,
        1,
        web3.utils.toWei('4.4')
      );

    const uniquette = await userC.directoryContract.uniquetteGetById(
      1 // Token ID
    );

    expect(uniquette.collateralValue.toString()).eq(web3.utils.toWei('4'));
  });

  it('should increase effective price based on last purchase', async () => {
    const {userA, userB, userC, userD, governor} = await setupTest();
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await userB.directoryContract.uniquetteIncreaseCollateral(1, {
      value: web3.utils.toWei('3'),
    });

    await userC.directoryContract.collect(
      userC.signer.address,
      1, // Token ID
      {
        value: calculateRequiredPayment('4.4').toString(), // ETH : (last principal amount + max appreciation) + fee
      }
    );

    await expect(
      await userD.directoryContract.collect(
        userD.signer.address,
        1, // Token ID
        {
          value: calculateRequiredPayment('4.84').toString(), // ETH : valueAdded + fee
        }
      )
    ).to.changeEtherBalances(
      [
        userB.directoryContract,
        userB.vaultContract,
        userB.treasuryContract,
        userA.signer,
        userB.signer,
        userC.signer,
        userD.signer,
      ],
      [
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0.254736842105263157'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0'),
        web3.utils.toWei('4.84'),
        web3.utils.toWei('-5.094736842105263157'),
      ]
    );
  });

  it('should not collect with payment less than effective price', async () => {
    const {userA, userB, userC, userD, governor} = await setupTest();
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await userB.directoryContract.uniquetteIncreaseCollateral(1, {
      value: web3.utils.toWei('3'),
    });

    await userC.directoryContract.collect(
      userC.signer.address,
      1, // Token ID
      {
        value: calculateRequiredPayment('4.4').toString(), // ETH : (last principal amount + max appreciation) + fee
      }
    );

    await expect(
      userD.directoryContract.collect(
        userD.signer.address,
        1, // Token ID
        {
          value: calculateRequiredPayment('4.8399999999999999').toString(), // ETH : (last principal amount + max appreciation) + fee
        }
      )
    ).to.be.revertedWith('UNIQUETTES/NOT_ENOUGH_PRINCIPAL');
  });

  it('should not fund a pending submission', async () => {
    const {userA, userB, userC, userD, governor} = await setupTest();
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(fakeHash);

    const upgradeFakeHash = uuid();

    await userC.directoryContract.submissionCreate(
      1, // existing uniquette with tokenId = 1
      upgradeFakeHash,
      1, // Schema v1
      web3.utils.toWei('0.5'), // ETH - valueAdded
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await expect(
      userD.directoryContract.fund(
        userD.signer.address,
        1, // Token ID
        upgradeFakeHash,
        {
          value: calculateRequiredPayment('1.8').toString(), // ETH : valueAdded + fee
        }
      )
    ).to.be.revertedWith('SUBMISSIONS/NOT_APPROVED');
  });

  it('should not fund an already funded submission', async () => {
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(fakeHash);

    await expect(
      userC.directoryContract.fund(
        userC.signer.address,
        1, // Token ID
        fakeHash,
        {
          value: calculateRequiredPayment('2').toString(), // ETH : valueAdded + fee
        }
      )
    ).to.be.revertedWith('SUBMISSIONS/NOT_APPROVED');
  });

  it('should not allow creating submission with an existing hash', async () => {
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(fakeHash);

    await expect(
      userC.directoryContract.submissionCreate(
        0,
        fakeHash,
        1, // Schema v1
        web3.utils.toWei('1'), // ETH - valueAdded
        {
          value: web3.utils.toWei('0.1'), // ETH
        }
      )
    ).to.be.revertedWith('SUBMISSIONS/ALREADY_CREATED');
  });

  it('should not allow funding a submission not meant for a uniquette', async () => {
    const {userA, userB, userC, governor} = await setupTest();
    const fakeHash = uuid();
    const anotherFakeHash = uuid();

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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(fakeHash);

    await userC.directoryContract.submissionCreate(
      0,
      anotherFakeHash,
      1, // Schema v1
      web3.utils.toWei('1'), // ETH - valueAdded
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await governor.directoryContract.submissionApprove(
      anotherFakeHash,
      web3.utils.toWei('200') // UNQ - reward
    );

    await expect(
      userB.directoryContract.fund(
        userB.signer.address,
        1, // Token ID
        anotherFakeHash,
        {
          value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
        }
      )
    ).to.be.revertedWith('DIRECTORY/INVALID_SUBMISSION_FOR_UNIQUETTE');
  });

  it('should seize author deposit when submission is rejected', async () => {
    const {userA, governor} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.submissionCreate(
      0,
      fakeHash,
      1, // Schema v1
      web3.utils.toWei('1'), // ETH
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await expect(
      await governor.directoryContract.submissionReject(fakeHash)
    ).to.changeEtherBalances(
      [
        userA.directoryContract,
        userA.vaultContract,
        userA.treasuryContract,
        userA.signer,
      ],
      [
        web3.utils.toWei('-0.1'),
        web3.utils.toWei('0'),
        web3.utils.toWei('0.1'),
        web3.utils.toWei('0'),
      ]
    );
  });

  it('should allow author to fund their own submission of new uniquette', async () => {
    const {userA, governor} = await setupTest();
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

    await expect(
      userA.directoryContract.fund(
        userA.signer.address,
        1, // Token ID
        fakeHash,
        {
          value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
        }
      )
    )
      .to.emit(userA.directoryContract, 'SubmissionFunded')
      .withArgs(
        userA.signer.address,
        userA.signer.address,
        1,
        fakeHash,
        web3.utils.toWei('1'),
        web3.utils.toWei('1.052631578947368421')
      );

    const uniquette = await userA.directoryContract.uniquetteGetById(
      1 // Token ID
    );

    expect(uniquette.collateralValue.toString()).eq(web3.utils.toWei('1'));
  });

  it('should allow author to fund their own submission of existing uniquette', async () => {
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(fakeHash);

    const upgradeFakeHash = uuid();

    await userC.directoryContract.submissionCreate(
      1, // existing uniquette with tokenId = 1
      upgradeFakeHash,
      1, // Schema v1
      web3.utils.toWei('0.5'), // ETH - valueAdded
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await governor.directoryContract.submissionApprove(
      upgradeFakeHash,
      web3.utils.toWei('150') // UNQ
    );

    await expect(
      userC.directoryContract.fund(
        userC.signer.address,
        1, // Token ID
        upgradeFakeHash,
        {
          value: calculateRequiredPayment('1.6').toString(), // ETH : valueAdded + fee
        }
      )
    )
      .to.emit(userC.directoryContract, 'SubmissionFunded')
      .withArgs(
        userC.signer.address,
        userC.signer.address,
        1,
        upgradeFakeHash,
        web3.utils.toWei('1.6'),
        web3.utils.toWei('1.684210526315789473')
      );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(upgradeFakeHash);
  });

  it('should allow owner to fund new submission of its own uniquette', async () => {
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(fakeHash);

    const upgradeFakeHash = uuid();

    await userC.directoryContract.submissionCreate(
      1, // existing uniquette with tokenId = 1
      upgradeFakeHash,
      1, // Schema v1
      web3.utils.toWei('0.5'), // ETH - valueAdded
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await governor.directoryContract.submissionApprove(
      upgradeFakeHash,
      web3.utils.toWei('150') // UNQ
    );

    await expect(
      userB.directoryContract.fund(
        userB.signer.address,
        1, // Token ID
        upgradeFakeHash,
        {
          value: calculateRequiredPayment('1.6').toString(), // ETH : valueAdded + fee
        }
      )
    )
      .to.emit(userC.directoryContract, 'SubmissionFunded')
      .withArgs(
        userB.signer.address,
        userB.signer.address,
        1,
        upgradeFakeHash,
        web3.utils.toWei('1.6'),
        web3.utils.toWei('1.684210526315789473')
      );

    await expect(
      userB.directoryContract.uniquetteGetFundedSubmission(
        1 // Token ID
      )
    ).not.eq(upgradeFakeHash);
  });

  it('should not allow approving an already approved submission', async () => {
    const {userA, governor} = await setupTest();
    const fakeHash = uuid();

    await userA.directoryContract.submissionCreate(
      0,
      fakeHash,
      1, // Schema v1
      web3.utils.toWei('1'), // ETH
      {
        value: web3.utils.toWei('0.1'), // ETH
      }
    );

    await governor.directoryContract.submissionApprove(
      fakeHash,
      web3.utils.toWei('100') // UNQ
    );

    await expect(
      governor.directoryContract.submissionApprove(
        fakeHash,
        web3.utils.toWei('100') // UNQ
      )
    ).to.be.revertedWith('SUBMISSIONS/NOT_PENDING');
  });

  it('should not allow approving a funded submission', async () => {
    const {userA, userB, governor} = await setupTest();
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

    await userB.directoryContract.fund(
      userB.signer.address,
      1, // Token ID
      fakeHash,
      {
        value: calculateRequiredPayment('1').toString(), // ETH : valueAdded + fee
      }
    );

    await expect(
      governor.directoryContract.submissionApprove(
        fakeHash,
        web3.utils.toWei('100') // UNQ
      )
    ).to.be.revertedWith('SUBMISSIONS/NOT_PENDING');
  });
});

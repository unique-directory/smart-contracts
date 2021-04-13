const { expect } = require("chai");

const UNQ_FUNGIBLE_TOKEN_ID = 0x1;

describe("Core", () => {
  let accounts;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
  });

  it("should submit a new uniquette", async () => {
    const [owner, fakeVault, fakeTreasury, approver, userA] = accounts;
    const Core = await ethers.getContractFactory("Core");
    const core = await Core.deploy(
      "ipfs://",
      fakeVault.address,
      fakeTreasury.address,
      approver.address,
      10000
    );

    await expect(core.connect(userA).submitUniquette('randomIpFsHash', 150))
      .to.emit(core, 'UniquetteSubmitted')
      .withArgs(userA.address, 'randomIpFsHash', 150);
  });

  it("should approve a uniquette submission", async () => {
    const [owner, fakeVault, fakeTreasury, approver, userA] = accounts;
    const Core = await ethers.getContractFactory("Core");
    const core = await Core.deploy(
      "https://ipfs.io/ipfs/",
      fakeVault.address,
      fakeTreasury.address,
      approver.address,
      10000
    );

    await core.connect(userA).submitUniquette('randomIpFsHash', 150);
    await expect(core.connect(approver).approveSubmission('randomIpFsHash'))
      .to.emit(core, 'UniquetteApproved')
      .withArgs(approver.address, userA.address, 'randomIpFsHash', 150, 1);
  });

  it("should reject a uniquette submission", async () => {
    const [owner, fakeVault, fakeTreasury, approver, userA] = accounts;
    const Core = await ethers.getContractFactory("Core");
    const core = await Core.deploy(
      "https://ipfs.io/ipfs/",
      fakeVault.address,
      fakeTreasury.address,
      approver.address,
      10000
    );

    await core.connect(userA).submitUniquette('randomIpFsHash', 150);
    await expect(core.connect(approver).rejectSubmission('randomIpFsHash'))
      .to.emit(core, 'UniquetteRejected')
      .withArgs(approver.address, userA.address, 'randomIpFsHash', 150);
  });

  it("should reward UNQ to original author as submission prize", async () => {
    const [owner, fakeVault, fakeTreasury, approver, userA] = accounts;
    const Core = await ethers.getContractFactory("Core");
    const core = await Core.deploy(
      "https://ipfs.io/ipfs/",
      fakeVault.address,
      fakeTreasury.address,
      approver.address,
      10000
    );

    await core.connect(userA).submitUniquette('randomIpFsHash', 150);
    await core.connect(approver).approveSubmission('randomIpFsHash');

    await expect(
      await core.balanceOf(userA.address, UNQ_FUNGIBLE_TOKEN_ID)
    ).to.equal(10000);
  });
});

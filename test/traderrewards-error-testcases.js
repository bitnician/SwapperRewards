const TraderRewards = artifacts.require('TraderRewards');
const MockSphToken = artifacts.require('MockSphToken');
const BN = require('bn.js');
const { expect } = require('chai');
const truffleAssert = require('truffle-assertions');

contract('Trader Rewards Error Flow Test', async accounts => {
  let instance, sphToken;
  let traderRewardsOwner, sphOwner, sphInitiallAccount, trader1, trader2, trader3, router, router2, alice;
  let createInstanceTx;
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  assert.isAtLeast(accounts.length, 9);

  // Runs before all tests in this block.
  before('setting up test data', async () => {
    //Set up accounts for parties.
    [traderRewardsOwner, sphOwner, sphInitialAccount, trader1, trader2, trader3, router, router2, alice] = accounts;
  });

  //Run before each test case
  beforeEach('deploying new instance', async () => {
    sphToken = await MockSphToken.new(sphInitialAccount, { from: sphOwner });

    //Have to fudge the router address (not an actual router contract) because otherwise, recordTrade can't be tested
    instance = await TraderRewards.new(sphToken.address, router, new BN(5000000), new BN(10000000000000000000000000n), {
      from: traderRewardsOwner
    });

    //Allocate SPH tokens to the TraderRewards contract
    await sphToken.transfer(instance.address, new BN(10000000000000000000000000n), { from: sphInitialAccount });
  });

  it('should not deploy if initial values are invalid', async () => {
    await truffleAssert.reverts(
      TraderRewards.new(ZERO_ADDRESS, router, new BN(5000000), new BN(10000000000000000000000000n), {
        from: traderRewardsOwner
      }),
      'TraderRewards::constructor: token address is the zero address'
    );

    await truffleAssert.reverts(
      TraderRewards.new(sphToken.address, ZERO_ADDRESS, new BN(5000000), new BN(10000000000000000000000000n), {
        from: traderRewardsOwner
      }),
      'TraderRewards::constructor: router address is the zero address'
    );

    await truffleAssert.reverts(
      TraderRewards.new(sphToken.address, router, 0, new BN(10000000000000000000000000n), { from: traderRewardsOwner }),
      'TraderRewards::constructor: divisor out of range'
    );

    await truffleAssert.reverts(
      TraderRewards.new(sphToken.address, router, new BN(5000000), 0, { from: traderRewardsOwner }),
      'TraderRewards::constructor: initialRewardTokens out of range'
    );
  });

  it('should only allow the router to call the recordTrade function', async () => {
    await truffleAssert.reverts(
      instance.recordTrade(trader1, { from: alice }),
      'TraderRewards:onlyRouter: caller is not the router'
    );
  });

  it('should revert if recordTrade is called with an invalid trader address', async () => {
    await truffleAssert.reverts(
      instance.recordTrade(ZERO_ADDRESS, { from: router }),
      'TraderRewards::recordTrade: trader address is the zero address'
    );
  });

  it('should not allow a trader to withdraw reward tokens if she has no accumulated reward tokens', async () => {
    await truffleAssert.reverts(
      instance.withdrawRewardTokens({ from: trader1 }),
      'TraderRewards::withdrawRewardTokens: no rewards available for withdrawal'
    );
  });

  it('should only allow owner to call certain functions', async () => {
    await truffleAssert.reverts(
      instance.setSphToken(sphToken.address, { from: trader1 }),
      'Ownable: caller is not the owner'
    );

    await truffleAssert.reverts(instance.setRouter(router, { from: trader1 }), 'Ownable: caller is not the owner');

    await truffleAssert.reverts(
      instance.setDivisor(new BN(5000000), { from: trader1 }),
      'Ownable: caller is not the owner'
    );

    await truffleAssert.reverts(
      instance.setRewardTokensRemaining(new BN(10000000000000000000000000n), { from: trader1 }),
      'Ownable: caller is not the owner'
    );
  });

  it('should revert if TraderRewards contract SPH token balance is 0', async () => {
    const traderRewards = await TraderRewards.new(sphToken.address, router, 10, 1000, { from: traderRewardsOwner });
    const txObj = await traderRewards.recordTrade(trader1, { from: router });

    await truffleAssert.reverts(
      traderRewards.withdrawRewardTokens({ from: trader1 }),
      'TraderRewards:safeSPHTransfer:  no SPH tokens available to reward'
    );
  });
}); //end test contract

const TraderRewards = artifacts.require('TraderRewards');
const MockTestToken = artifacts.require('MockTestToken');
const BN = require('bn.js');
const { expect } = require('chai');
const truffleAssert = require('truffle-assertions');

contract('Trader Rewards Error Flow Test', async (accounts) => {
  let instance, testToken;
  let traderRewardsOwner, testOwner, testInitiallAccount, trader1, trader2, trader3, router, router2, alice;
  let createInstanceTx;
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  assert.isAtLeast(accounts.length, 9);

  // Runs before all tests in this block.
  before('setting up test data', async () => {
    //Set up accounts for parties.
    [traderRewardsOwner, testOwner, testInitialAccount, trader1, trader2, trader3, router, router2, alice] = accounts;
  });

  //Run before each test case
  beforeEach('deploying new instance', async () => {
    testToken = await MockTestToken.new(testInitialAccount, { from: testOwner });

    //Have to fudge the router address (not an actual router contract) because otherwise, recordTrade can't be tested
    instance = await TraderRewards.new(
      testToken.address,
      router,
      new BN(5000000),
      new BN(10000000000000000000000000n),
      {
        from: traderRewardsOwner,
      }
    );

    //Allocate TEST tokens to the TraderRewards contract
    await testToken.transfer(instance.address, new BN(10000000000000000000000000n), { from: testInitialAccount });
  });

  it('should not deploy if initial values are invalid', async () => {
    await truffleAssert.reverts(
      TraderRewards.new(ZERO_ADDRESS, router, new BN(5000000), new BN(10000000000000000000000000n), {
        from: traderRewardsOwner,
      }),
      'TraderRewards::constructor: token address is the zero address'
    );

    await truffleAssert.reverts(
      TraderRewards.new(testToken.address, ZERO_ADDRESS, new BN(5000000), new BN(10000000000000000000000000n), {
        from: traderRewardsOwner,
      }),
      'TraderRewards::constructor: router address is the zero address'
    );

    await truffleAssert.reverts(
      TraderRewards.new(testToken.address, router, 0, new BN(10000000000000000000000000n), {
        from: traderRewardsOwner,
      }),
      'TraderRewards::constructor: divisor out of range'
    );

    await truffleAssert.reverts(
      TraderRewards.new(testToken.address, router, new BN(5000000), 0, { from: traderRewardsOwner }),
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
      instance.setTestToken(testToken.address, { from: trader1 }),
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

  it('should revert if TraderRewards contract TEST token balance is 0', async () => {
    const traderRewards = await TraderRewards.new(testToken.address, router, 10, 1000, { from: traderRewardsOwner });
    const txObj = await traderRewards.recordTrade(trader1, { from: router });

    await truffleAssert.reverts(
      traderRewards.withdrawRewardTokens({ from: trader1 }),
      'TraderRewards:safeTESTTransfer:  no test tokens available to reward'
    );
  });
}); //end test contract

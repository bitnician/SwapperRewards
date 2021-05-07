const TraderRewards = artifacts.require('TraderRewards');
const MockTestToken = artifacts.require('MockTestToken');
const BN = require('bn.js');
const { expect } = require('chai');
const truffleAssert = require('truffle-assertions');

contract('Trader Rewards Happy Flow Test', async accounts => {
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
    instance = await TraderRewards.new(testToken.address, router, new BN(5000000), new BN(10000000000000000000000000n), {
      from: traderRewardsOwner
    });

    //Allocate test tokens to the TraderRewards contract
    await testToken.transfer(instance.address, new BN(10000000000000000000000000n), { from: testInitialAccount });
  });

  it('should correctly initialize values', async () => {
    assert.strictEqual(await instance.testToken(), testToken.address, 'TEST token address incorrect');
    assert.strictEqual(await instance.router(), router, 'router address incorrect');
    expect(new BN(await instance.divisor()).toNumber()).to.eq(5000000);
    expect(new BN(await instance.rewardTokensRemaining()).toString()).to.eq('10000000000000000000000000');
    expect(new BN(await testToken.balanceOf(instance.address)).toString()).to.eq('10000000000000000000000000');

    const options = { fromBlock: 0, toBlock: 'latest' };
    const eventList = await instance.getPastEvents('LogCreated', options);
    assert.equal(eventList.length, 1, 'Incorrect number of events');
    assert.strictEqual(eventList[0].args[0], traderRewardsOwner, 'Owner address incorrect');
    assert.strictEqual(eventList[0].args[1], testToken.address, 'TEST token address incorrect');
    assert.strictEqual(eventList[0].args[2], router, 'Router token address incorrect');
    expect(new BN(eventList[0].args[3]).toNumber()).to.eq(5000000);
    expect(new BN(eventList[0].args[4]).toString()).to.eq('10000000000000000000000000');
  });

  it('should correctly record a trade for one trader', async () => {
    expect(new BN(await instance.rewardTokensRemaining()).toString()).to.eq('10000000000000000000000000');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toNumber()).to.eq(0);

    const txObj = await instance.recordTrade(trader1, { from: router });
    expect(new BN(await instance.rewardTokensRemaining()).toString()).to.eq('9999998000000000000000000');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toString()).to.eq('2000000000000000000');

    assert.strictEqual(txObj.receipt.logs.length, 1, 'Incorrect number of events emitted');

    truffleAssert.eventEmitted(txObj.receipt, 'LogRecordTrade', ev => {
      return ev.trader == trader1 && expect(new BN(ev.allocatedRewardTokens).toString()).to.eq('2000000000000000000');
    });
  });

  it('should correctly record multiple trades for the same trader', async () => {
    expect(new BN(await instance.rewardTokensRemaining()).toString()).to.eq('10000000000000000000000000');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toNumber()).to.eq(0);

    const txObj1 = await instance.recordTrade(trader1, { from: router });
    const txObj2 = await instance.recordTrade(trader1, { from: router });
    const txObj3 = await instance.recordTrade(trader1, { from: router });
    const txObj4 = await instance.recordTrade(trader1, { from: router });

    expect(new BN(await instance.rewardTokensRemaining()).toString()).to.eq('9999992000002399999680001');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toString()).to.eq('7999997600000319999');

    assert.strictEqual(txObj4.receipt.logs.length, 1, 'Incorrect number of events emitted');

    truffleAssert.eventEmitted(txObj4.receipt, 'LogRecordTrade', ev => {
      return ev.trader == trader1 && expect(new BN(ev.allocatedRewardTokens).toString()).to.eq('1999998800000239999');
    });
  });

  it('should correctly record multiple trades for multiple traders', async () => {
    expect(new BN(await instance.rewardTokensRemaining()).toString()).to.eq('10000000000000000000000000');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toNumber()).to.eq(0);
    expect(new BN(await instance.rewardTokenBalances(trader2)).toNumber()).to.eq(0);
    expect(new BN(await instance.rewardTokenBalances(trader3)).toNumber()).to.eq(0);

    const txObj1 = await instance.recordTrade(trader1, { from: router });
    const txObj2 = await instance.recordTrade(trader2, { from: router });
    const txObj3 = await instance.recordTrade(trader3, { from: router });
    const txObj4 = await instance.recordTrade(trader1, { from: router });
    const txObj5 = await instance.recordTrade(trader3, { from: router });
    const txObj6 = await instance.recordTrade(trader2, { from: router });
    const txObj7 = await instance.recordTrade(trader2, { from: router });
    const txObj8 = await instance.recordTrade(trader2, { from: router });
    const txObj9 = await instance.recordTrade(trader3, { from: router });

    expect(new BN(await instance.rewardTokensRemaining()).toString()).to.eq('9999982000014399993280006');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toString()).to.eq('3999998800000239999');
    expect(new BN(await instance.rewardTokenBalances(trader2)).toString()).to.eq('7999992400003679997');
    expect(new BN(await instance.rewardTokenBalances(trader3)).toString()).to.eq('5999994400002799998');
  });

  it('should allow a trader to withdraw her reward tokens', async () => {
    expect(new BN(await testToken.balanceOf(instance.address)).toString()).to.eq('10000000000000000000000000');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader1)).toNumber()).to.eq(0);

    const txObj1 = await instance.recordTrade(trader1, { from: router });
    const txObj2 = await instance.recordTrade(trader1, { from: router });
    const txObj3 = await instance.recordTrade(trader1, { from: router });
    const txObj4 = await instance.recordTrade(trader1, { from: router });

    const txObjWithdrawal = await instance.withdrawRewardTokens({ from: trader1 });

    assert.strictEqual(txObjWithdrawal.receipt.logs.length, 2, 'Incorrect number of events emitted');

    truffleAssert.eventEmitted(txObjWithdrawal.receipt, 'LogWithdrawal', ev => {
      return ev.withdrawnBy == trader1 && expect(new BN(ev.amount).toString()).to.eq('7999997600000319999');
    });

    truffleAssert.eventEmitted(txObjWithdrawal.receipt, 'LogSafeTESTTransfer', ev => {
      return ev.to == trader1 && expect(new BN(ev.amount).toString()).to.eq('7999997600000319999');
    });

    expect(new BN(await testToken.balanceOf(instance.address)).toString()).to.eq('9999992000002399999680001');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader1)).toString()).to.eq('7999997600000319999');
  });

  it('should allow multiple traders to withdraw their tokens', async () => {
    expect(new BN(await testToken.balanceOf(instance.address)).toString()).to.eq('10000000000000000000000000');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader1)).toNumber()).to.eq(0);
    expect(new BN(await instance.rewardTokenBalances(trader2)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader2)).toNumber()).to.eq(0);
    expect(new BN(await instance.rewardTokenBalances(trader3)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader3)).toNumber()).to.eq(0);

    await instance.recordTrade(trader1, { from: router });
    await instance.recordTrade(trader2, { from: router });
    await instance.recordTrade(trader3, { from: router });
    await instance.recordTrade(trader1, { from: router });
    await instance.recordTrade(trader3, { from: router });
    await instance.recordTrade(trader2, { from: router });
    await instance.recordTrade(trader2, { from: router });
    await instance.recordTrade(trader2, { from: router });
    await instance.recordTrade(trader3, { from: router });

    await instance.withdrawRewardTokens({ from: trader1 });
    await instance.withdrawRewardTokens({ from: trader2 });
    await instance.withdrawRewardTokens({ from: trader3 });

    expect(new BN(await testToken.balanceOf(instance.address)).toString()).to.eq('9999982000014399993280006');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader1)).toString()).to.eq('3999998800000239999');
    expect(new BN(await instance.rewardTokenBalances(trader2)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader2)).toString()).to.eq('7999992400003679997');
    expect(new BN(await instance.rewardTokenBalances(trader3)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader3)).toString()).to.eq('5999994400002799998');
  });

  it('should correctly process interleaved trades and withdrawals', async () => {
    expect(new BN(await testToken.balanceOf(instance.address)).toString()).to.eq('10000000000000000000000000');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader1)).toNumber()).to.eq(0);
    expect(new BN(await instance.rewardTokenBalances(trader2)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader2)).toNumber()).to.eq(0);
    expect(new BN(await instance.rewardTokenBalances(trader3)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader3)).toNumber()).to.eq(0);

    await instance.recordTrade(trader1, { from: router });
    await instance.recordTrade(trader2, { from: router });
    await instance.recordTrade(trader3, { from: router });

    await instance.withdrawRewardTokens({ from: trader2 });

    expect(new BN(await testToken.balanceOf(instance.address)).toString()).to.eq('9999998000000400000000000');
    expect(new BN(await instance.rewardTokenBalances(trader2)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader2)).toString()).to.eq('1999999600000000000');

    await instance.recordTrade(trader1, { from: router });
    await instance.recordTrade(trader3, { from: router });

    await instance.withdrawRewardTokens({ from: trader1 });

    expect(new BN(await testToken.balanceOf(instance.address)).toString()).to.eq('9999994000001599999760001');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader1)).toString()).to.eq('3999998800000239999');

    await instance.recordTrade(trader2, { from: router });
    await instance.recordTrade(trader2, { from: router });
    await instance.recordTrade(trader2, { from: router });

    await instance.withdrawRewardTokens({ from: trader2 });

    expect(new BN(await testToken.balanceOf(instance.address)).toString()).to.eq('9999988000008799996080004');
    expect(new BN(await instance.rewardTokenBalances(trader2)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader2)).toString()).to.eq('7999992400003679997');

    await instance.recordTrade(trader3, { from: router });

    await instance.withdrawRewardTokens({ from: trader3 });

    expect(new BN(await testToken.balanceOf(instance.address)).toString()).to.eq('9999982000014399993280006');
    expect(new BN(await instance.rewardTokenBalances(trader3)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader3)).toString()).to.eq('5999994400002799998');
  });

  it("should transfer the TraderRewards contrac's TEST balance if that is less than the trader's accumulated rewards", async () => {
    const traderRewards = await TraderRewards.new(testToken.address, router, 10, 1000, { from: traderRewardsOwner });
    await testToken.transfer(traderRewards.address, 100, { from: testInitialAccount });

    expect(new BN(await testToken.balanceOf(traderRewards.address)).toString()).to.eq('100');
    expect(new BN(await traderRewards.rewardTokenBalances(trader1)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader1)).toNumber()).to.eq(0);

    const txObj1 = await traderRewards.recordTrade(trader1, { from: router });
    const txObj2 = await traderRewards.recordTrade(trader1, { from: router });

    const txObjWithdrawal = await traderRewards.withdrawRewardTokens({ from: trader1 });

    assert.strictEqual(txObjWithdrawal.receipt.logs.length, 2, 'Incorrect number of events emitted');

    truffleAssert.eventEmitted(txObjWithdrawal.receipt, 'LogWithdrawal', ev => {
      return ev.withdrawnBy == trader1 && expect(new BN(ev.amount).toString()).to.eq('100');
    });

    truffleAssert.eventEmitted(txObjWithdrawal.receipt, 'LogSafeTESTTransfer', ev => {
      return ev.to == trader1 && expect(new BN(ev.amount).toString()).to.eq('100');
    });

    expect(new BN(await testToken.balanceOf(traderRewards.address)).toString()).to.eq('0');
    expect(new BN(await instance.rewardTokenBalances(trader1)).toNumber()).to.eq(0);
    expect(new BN(await testToken.balanceOf(trader1)).toString()).to.eq('100');
  });

  it('should set the router', async () => {
    assert.strictEqual(await instance.router(), router, 'router address incorrect');
    const txObj = await instance.setRouter(router2, { from: traderRewardsOwner });
    assert.strictEqual(await instance.router(), router2, 'router address incorrect');

    assert.strictEqual(txObj.receipt.logs.length, 1, 'Incorrect number of events emitted');

    truffleAssert.eventEmitted(txObj.receipt, 'LogSetRouter', ev => {
      return ev.setBy == traderRewardsOwner && ev.oldAddress == router && ev.newAddress == router2;
    });
  });

  it('should set the TEST token address', async () => {
    assert.strictEqual(await instance.testToken(), testToken.address, 'TEST token address incorrect');
    const txObj = await instance.setTestToken(alice, { from: traderRewardsOwner });
    assert.strictEqual(await instance.testToken(), alice, 'TEST token address incorrect');

    assert.strictEqual(txObj.receipt.logs.length, 1, 'Incorrect number of events emitted');

    truffleAssert.eventEmitted(txObj.receipt, 'LogSetTestToken', ev => {
      return ev.setBy == traderRewardsOwner && ev.oldAddress == testToken.address && ev.newAddress == alice;
    });
  });

  it('should set the divisor', async () => {
    expect(new BN(await instance.divisor()).toNumber()).to.eq(5000000);
    const txObj = await instance.setDivisor(new BN(10000000), { from: traderRewardsOwner });
    expect(new BN(await instance.divisor()).toNumber()).to.eq(10000000);

    assert.strictEqual(txObj.receipt.logs.length, 1, 'Incorrect number of events emitted');

    truffleAssert.eventEmitted(txObj.receipt, 'LogSetDivisor', ev => {
      return (
        ev.setBy == traderRewardsOwner &&
        expect(new BN(ev.oldDivisor).toNumber()).to.eq(5000000) &&
        expect(new BN(ev.newDivisor).toNumber()).to.eq(10000000)
      );
    });
  });

  it('should set the remaining rewards', async () => {
    expect(new BN(await instance.rewardTokensRemaining()).toString()).to.eq('10000000000000000000000000');
    const txObj = await instance.setRewardTokensRemaining(new BN(20000000000000000000000000n), {
      from: traderRewardsOwner
    });
    expect(new BN(await instance.rewardTokensRemaining()).toString()).to.eq('20000000000000000000000000');

    assert.strictEqual(txObj.receipt.logs.length, 1, 'Incorrect number of events emitted');

    truffleAssert.eventEmitted(txObj.receipt, 'LogSetRewardTokensRemaining', ev => {
      return (
        ev.setBy == traderRewardsOwner &&
        expect(new BN(ev.oldValue).toString()).to.eq('10000000000000000000000000') &&
        expect(new BN(ev.newValue).toString()).to.eq('20000000000000000000000000')
      );
    });
  });

  it('should be possisble to transfer ownership', async () => {
    assert.strictEqual(await instance.owner(), traderRewardsOwner, 'owner address incorrect');
    const txObj = instance.transferOwnership(alice, { from: traderRewardsOwner });
    assert.strictEqual(await instance.owner(), alice, 'owner address incorrect');

    const options = { fromBlock: 'latest', toBlock: 'latest' };
    const eventList = await instance.getPastEvents('OwnershipTransferred', options);
    assert.equal(eventList.length, 1, 'Incorrect number of events');
    assert.strictEqual(eventList[0].args[0], traderRewardsOwner, 'Previous owner address incorrect');
    assert.strictEqual(eventList[0].args[1], alice, 'New owner address incorrect');
  });

  it('should be possisble to renounce ownership', async () => {
    assert.strictEqual(await instance.owner(), traderRewardsOwner, 'owner address incorrect');
    const txObj = instance.renounceOwnership({ from: traderRewardsOwner });
    assert.strictEqual(await instance.owner(), ZERO_ADDRESS, 'owner address incorrect');

    const options = { fromBlock: 'latest', toBlock: 'latest' };
    const eventList = await instance.getPastEvents('OwnershipTransferred', options);
    assert.equal(eventList.length, 1, 'Incorrect number of events');
    assert.strictEqual(eventList[0].args[0], traderRewardsOwner, 'Previous owner address incorrect');
    assert.strictEqual(eventList[0].args[1], ZERO_ADDRESS, 'New owner address incorrect');
  });
}); //end test contract

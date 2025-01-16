import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { time, loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { encodeBytes32String } from "ethers";
import { ONE_DAY_IN_SECS, deployContractsFixture } from './utils';
import BalanceTree from '../src/balance-tree';

const { provider } = ethers;

describe('Rewards Distributor', () => {

  it('RewardsDistributor works', async () => {
    
    const {
      Alice, Bob, Caro, Dave, Eve, Ivy, protocol, settings, erc20, enReachToken, rewardsDistributor
    } = await loadFixture(deployContractsFixture);

    const genesisTime = await time.latest();
    const rewardsActivationDelay = await settings.paramValue(encodeBytes32String('RewardsActivationDelay'));

    // First batch of rewards, for epoch 1
    let epochId = 1;
    await time.increase(ONE_DAY_IN_SECS);

    const aliceRewards1 = ethers.parseUnits('100.5', await enReachToken.decimals());
    const bobRewards1 = ethers.parseUnits('2.5', await enReachToken.decimals());
    const caroRewards1 = ethers.parseUnits('0.01', await enReachToken.decimals());
    let totalRewards = aliceRewards1 + bobRewards1 + caroRewards1;
    const distributionList1 = [
      { account: Alice.address, amount: aliceRewards1 },
      { account: Bob.address, amount: bobRewards1 },
      { account: Caro.address, amount: caroRewards1 },
    ];
    const merkleTree1 = new BalanceTree(distributionList1);
    let rewardsCalculationEndTimestamp = await time.latest();
    
    // Submit first merkle root
    expect(await rewardsDistributor.isRewarder(Bob.address)).to.equal(false);
    await expect(rewardsDistributor.connect(Bob).submitRewardsDistributionRoot(merkleTree1.getHexRoot(), epochId, rewardsCalculationEndTimestamp))
      .to.be.revertedWith(/Caller is not owner or rewarder/);
    await expect(rewardsDistributor.connect(Alice).setRewarder(Bob.address, true))
      .to.emit(rewardsDistributor, 'UpdateRewarder')
      .withArgs(Bob.address, true);
    expect(await rewardsDistributor.isRewarder(Bob.address)).to.equal(true);
    await expect(rewardsDistributor.connect(Bob).submitRewardsDistributionRoot(merkleTree1.getHexRoot(), epochId, rewardsCalculationEndTimestamp))
      .to.emit(rewardsDistributor, 'RewardsDistributionRootSubmitted')
      .withArgs(0, merkleTree1.getHexRoot(), epochId, rewardsCalculationEndTimestamp, anyValue);

    // Alice could not claim rewards if not activated
    await expect(rewardsDistributor.connect(Alice).claim(0, merkleTree1.getHexRoot(), 0, Alice.address, aliceRewards1, merkleTree1.getProof(0, Alice.address, aliceRewards1)))
      .to.be.revertedWith(/Root not activated yet/);

    // Alice could not claim rewards if not funded
    await time.increase(rewardsActivationDelay);
    await expect(rewardsDistributor.connect(Alice).claim(0, merkleTree1.getHexRoot(), 0, Alice.address, aliceRewards1, merkleTree1.getProof(0, Alice.address, aliceRewards1)))
      .to.be.revertedWith(/Insufficient balance/);

    // Fund the contract (could be multiple transactions)
    await expect(enReachToken.connect(Ivy).transfer(await rewardsDistributor.getAddress(), totalRewards / 2n)).not.to.be.reverted;
    await expect(enReachToken.connect(Ivy).transfer(await rewardsDistributor.getAddress(), totalRewards / 2n)).not.to.be.reverted;
    await expect(enReachToken.connect(Ivy).transfer(await rewardsDistributor.getAddress(), totalRewards / 2n)).not.to.be.reverted;

    // Could not claim with invalid proof
    await expect(rewardsDistributor.connect(Alice).claim(0, merkleTree1.getHexRoot(), 0, Alice.address, aliceRewards1, merkleTree1.getProof(1, Bob.address, bobRewards1)))
      .to.be.revertedWith(/Invalid proof/);

    // Alice could claim rewards with valid proof
    let trans = await rewardsDistributor.connect(Alice).claim(0, merkleTree1.getHexRoot(), 0, Alice.address, aliceRewards1, merkleTree1.getProof(0, Alice.address, aliceRewards1));
    await trans.wait();
    await expect(trans)
      .to.emit(rewardsDistributor, 'RewardsClaimed').withArgs(0, Alice.address, aliceRewards1);
    await expect(trans).to.changeTokenBalances(
      enReachToken,
      [await rewardsDistributor.getAddress(), Alice.address],
      [-aliceRewards1, aliceRewards1]
    );
    expect(await rewardsDistributor.cumulativeClaimedRewards(Alice.address)).to.equal(aliceRewards1);

    // Alice could not cliam rewards for epoch 1 again
    await expect(rewardsDistributor.connect(Alice).claim(0, merkleTree1.getHexRoot(), 0, Alice.address, aliceRewards1, merkleTree1.getProof(0, Alice.address, aliceRewards1)))
      .to.be.revertedWith(/Nothing to claim/);

    // Extra rewards could be withdrawn
    await expect(rewardsDistributor.connect(Bob).withdraw(Bob.address, totalRewards / 2n))
      .to.be.revertedWith(/Ownable: caller is not the owner/);
    trans = await rewardsDistributor.connect(Alice).withdraw(Ivy.address, totalRewards / 2n);
    await trans.wait();
    await expect(trans)
      .to.emit(rewardsDistributor, 'Withdrawn').withArgs(Alice.address, Ivy.address, totalRewards / 2n);
    await expect(trans).to.changeTokenBalances(
      enReachToken,
      [await rewardsDistributor.getAddress(), Ivy.address],
      [-totalRewards / 2n, totalRewards / 2n]
    );

    // Second batch of rewards, for epoch 2 & 3
    epochId = 3;
    await time.increase(ONE_DAY_IN_SECS * 2);

    const aliceRewards2 = ethers.parseUnits('100.5', await enReachToken.decimals());
    const bobRewards2 = ethers.parseUnits('2.5', await enReachToken.decimals());
    const caroRewards2 = 0n;   // Caro didn't participate
    const daveRewards2 = ethers.parseUnits('10', await enReachToken.decimals());  // New participant

    let accumulatedRewardsAlice = aliceRewards1 + aliceRewards2;
    let accumulatedRewardsBob = bobRewards1 + bobRewards2;
    let accumulatedRewardsCaro = caroRewards1 + caroRewards2;
    let accumulatedRewardsDave = daveRewards2;

    let newBatchRewards = aliceRewards2 + bobRewards2 + caroRewards2 + daveRewards2;
    totalRewards += newBatchRewards;

    const distributionList2 = [
      { account: Alice.address, amount: accumulatedRewardsAlice },
      { account: Bob.address, amount: accumulatedRewardsBob },
      { account: Caro.address, amount: accumulatedRewardsCaro },
      { account: Dave.address, amount: accumulatedRewardsDave },
    ];
    const merkleTree2 = new BalanceTree(distributionList2);
    rewardsCalculationEndTimestamp = await time.latest();

    // Add rewards for epoch 2 & 3
    await expect(enReachToken.connect(Ivy).transfer(await rewardsDistributor.getAddress(), newBatchRewards)).not.to.be.reverted;

    // Submit new merkle root
    await expect(rewardsDistributor.connect(Alice).submitRewardsDistributionRoot(merkleTree2.getHexRoot(), epochId, rewardsCalculationEndTimestamp))
      .to.emit(rewardsDistributor, 'RewardsDistributionRootSubmitted')
      .withArgs(1, merkleTree2.getHexRoot(), epochId, rewardsCalculationEndTimestamp, anyValue);
    expect(await rewardsDistributor.getRewardsDistributionRootCount()).to.equal(2);

    // Alice could only claim rewards for epoch 2 & 3, since she already claimed for epoch 1
    await time.increase(rewardsActivationDelay);
    trans = await rewardsDistributor.connect(Alice).claim(1, merkleTree2.getHexRoot(), 0, Alice.address, accumulatedRewardsAlice, merkleTree2.getProof(0, Alice.address, accumulatedRewardsAlice));
    await trans.wait();
    await expect(trans)
      .to.emit(rewardsDistributor, 'RewardsClaimed').withArgs(1, Alice.address, aliceRewards2);
    await expect(trans).to.changeTokenBalances(
      enReachToken,
      [await rewardsDistributor.getAddress(), Alice.address],
      [-aliceRewards2, aliceRewards2]
    );
    expect(await rewardsDistributor.cumulativeClaimedRewards(Alice.address)).to.equal(accumulatedRewardsAlice);

    // Bob could claim all accumulated rewards
    trans = await rewardsDistributor.connect(Bob).claim(1, merkleTree2.getHexRoot(), 1, Bob.address, accumulatedRewardsBob, merkleTree2.getProof(1, Bob.address, accumulatedRewardsBob));
    await trans.wait();
    await expect(trans)
      .to.emit(rewardsDistributor, 'RewardsClaimed').withArgs(1, Bob.address, accumulatedRewardsBob);
    await expect(trans).to.changeTokenBalances(
      enReachToken,
      [await rewardsDistributor.getAddress(), Bob.address],
      [-accumulatedRewardsBob, accumulatedRewardsBob]
    );
    expect(await rewardsDistributor.cumulativeClaimedRewards(Bob.address)).to.equal(accumulatedRewardsBob);

    // Blob could not cliam rewards again
    await expect(rewardsDistributor.connect(Bob).claim(1, merkleTree2.getHexRoot(), 1, Bob.address, accumulatedRewardsBob, merkleTree2.getProof(1, Bob.address, accumulatedRewardsBob)))
      .to.be.revertedWith(/Nothing to claim/);

    // Third batch of rewards, for epoch 4 & 5 & 6
    epochId = 6;
    await time.increase(ONE_DAY_IN_SECS * 3);

    const aliceRewards3 = ethers.parseUnits('100.5', await enReachToken.decimals());
    const bobRewards3 = ethers.parseUnits('2.5', await enReachToken.decimals());
    const caroRewards3 = ethers.parseUnits('100', await enReachToken.decimals());
    const daveRewards3 = ethers.parseUnits('10', await enReachToken.decimals());

    accumulatedRewardsAlice += aliceRewards3;
    accumulatedRewardsBob += bobRewards3;
    accumulatedRewardsCaro += caroRewards3;
    accumulatedRewardsDave += daveRewards3;

    newBatchRewards = aliceRewards3 + bobRewards3 + caroRewards3 + daveRewards3;
    totalRewards += newBatchRewards;

    const distributionList3 = [
      { account: Alice.address, amount: accumulatedRewardsAlice },
      { account: Bob.address, amount: accumulatedRewardsBob },
      { account: Caro.address, amount: accumulatedRewardsCaro },
      { account: Dave.address, amount: accumulatedRewardsDave },
    ];
    const merkleTree3 = new BalanceTree(distributionList3);
    rewardsCalculationEndTimestamp = await time.latest();

    // Add rewards for epoch 4 & 5 & 6
    await expect(enReachToken.connect(Ivy).transfer(await rewardsDistributor.getAddress(), newBatchRewards)).not.to.be.reverted;

    // Submit new merkle root
    await expect(rewardsDistributor.connect(Bob).submitRewardsDistributionRoot(merkleTree3.getHexRoot(), epochId, rewardsCalculationEndTimestamp))
      .to.emit(rewardsDistributor, 'RewardsDistributionRootSubmitted')
      .withArgs(2, merkleTree3.getHexRoot(), epochId, rewardsCalculationEndTimestamp, anyValue);
    expect(await rewardsDistributor.getRewardsDistributionRootCount()).to.equal(3);

    // Could disable merkle root before activation
    await expect(rewardsDistributor.connect(Caro).disableRoot(1, merkleTree2.getHexRoot()))
      .to.be.revertedWith(/Caller is not owner or rewarder/); 
    await expect(rewardsDistributor.connect(Alice).disableRoot(1, merkleTree2.getHexRoot()))
      .to.be.revertedWith(/Root already activated/);
    
    await expect(rewardsDistributor.connect(Alice).disableRoot(2, merkleTree3.getHexRoot()))
      .to.emit(rewardsDistributor, 'RewardsDistributionRootDisabled')
      .withArgs(2, merkleTree3.getHexRoot());

    // Could enable disabled merkle root before activation
    await expect(rewardsDistributor.connect(Caro).enableRoot(2, merkleTree3.getHexRoot()))
      .to.be.revertedWith(/Caller is not owner or rewarder/);
    await expect(rewardsDistributor.connect(Alice).enableRoot(1, merkleTree2.getHexRoot()))
      .to.be.revertedWith(/Root already enabled/); 
    await expect(rewardsDistributor.connect(Alice).enableRoot(2, merkleTree3.getHexRoot()))
      .to.emit(rewardsDistributor, 'RewardsDistributionRootEnabled')
      .withArgs(2, merkleTree3.getHexRoot());

    // Could not enable a disabled merkle root after activation
    await expect(rewardsDistributor.connect(Alice).disableRoot(2, merkleTree3.getHexRoot())).not.to.be.reverted;
    await time.increase(rewardsActivationDelay);
    await expect(rewardsDistributor.connect(Alice).enableRoot(2, merkleTree3.getHexRoot()))
      .to.be.revertedWith(/Root already activated/);

  });

});

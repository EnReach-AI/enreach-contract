import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployContractsFixture } from './utils';
import { MerkleDistributor__factory } from '../typechain';
import BalanceTree from '../src/balance-tree';

const { provider } = ethers;

describe('Merkle Distributor', () => {

  it('merkle-distributor works', async () => {
    const { Alice, Bob, Caro, Dave, Eve, protocol, erc20 } = await loadFixture(deployContractsFixture);

    const aliceAmount = ethers.parseUnits('100.5', await erc20.decimals());
    const bobAmount = ethers.parseUnits('2.5', await erc20.decimals());
    const caroAmount = ethers.parseUnits('0.01', await erc20.decimals());
    const daveAmount = ethers.parseUnits('6.009', await erc20.decimals());
    const eveAmount = ethers.parseUnits('0', await erc20.decimals());
    const daveAmount2 = ethers.parseUnits('888888888888.009', await erc20.decimals());
    const totalAmount = aliceAmount + bobAmount + caroAmount + daveAmount + eveAmount;

    let distributionList = [
      { account: Alice.address, amount: aliceAmount },
      { account: Bob.address, amount: bobAmount },
      { account: Caro.address, amount: caroAmount },
      { account: Dave.address, amount: daveAmount },
      { account: Eve.address, amount: eveAmount },
      { account: Dave.address, amount: daveAmount2 },
    ];
    expect(() => new BalanceTree(distributionList)).to.throw("Duplicate accounts detected");
    
    distributionList = distributionList.slice(0, -1);
    const merkleTree = new BalanceTree(distributionList);

    const MerkleDistributor = await ethers.getContractFactory('MerkleDistributor');
    const merkleDistributorContract = await MerkleDistributor.deploy(await protocol.getAddress(), await erc20.getAddress(), merkleTree.getHexRoot());
    const merkleDistributor = MerkleDistributor__factory.connect(await merkleDistributorContract.getAddress(), provider);

    // Alice should fail to claim before the contract is funded
    expect(await merkleDistributor.isClaimed(0)).to.equal(false);
    const aliceProof = merkleTree.getProof(0, Alice.address, aliceAmount);
    await expect(merkleDistributor.connect(Alice).claim(0, Alice.address, aliceAmount, aliceProof)).to.be.rejectedWith(
      /ERC20: transfer amount exceeds balance/,
    );

    // Fund the contract (could be multiple transactions)
    expect(await erc20.balanceOf(await merkleDistributor.getAddress())).to.equal(0);
    await expect(erc20.connect(Alice).mint(Alice.address, totalAmount)).not.to.be.reverted;
    await expect(erc20.connect(Alice).transfer(await merkleDistributor.getAddress(), totalAmount / 2n)).not.to.be.reverted;
    await expect(erc20.connect(Alice).transfer(await merkleDistributor.getAddress(), totalAmount / 2n)).not.to.be.reverted;

    // Now Alice could claim her rewards
    await expect(merkleDistributor.connect(Alice).claim(0, Alice.address, aliceAmount, aliceProof))
      .to.emit(erc20, 'Transfer').withArgs(await merkleDistributor.getAddress(), Alice.address, aliceAmount)
      .to.emit(merkleDistributor, 'Claimed').withArgs(0, Alice.address, aliceAmount);
    expect(await merkleDistributor.isClaimed(0)).to.equal(true);
    
    // Caro could pay the gas to claim rewards for Bob
    const bobProof = merkleTree.getProof(1, Bob.address, bobAmount);
    await expect(merkleDistributor.connect(Caro).claim(1, Bob.address, bobAmount, bobProof))
      .to.emit(erc20, 'Transfer').withArgs(await merkleDistributor.getAddress(), Bob.address, bobAmount)
      .to.emit(merkleDistributor, 'Claimed').withArgs(1, Bob.address, bobAmount);
    expect(await merkleDistributor.isClaimed(1)).to.equal(true);

    // Bob's rewards could not be re-claimed
    await expect(merkleDistributor.connect(Bob).claim(1, Bob.address, bobAmount, bobProof)).to.be.revertedWith(/Already claimed/);

    // Caro's rewards could not be claimed with an invalid proof or amount
    await expect(merkleDistributor.connect(Caro).claim(2, Caro.address, bobAmount, bobProof)).to.be.revertedWith(/Invalid proof/);
    await expect(merkleDistributor.connect(Caro).claim(2, Caro.address, caroAmount, bobProof)).to.be.revertedWith(/Invalid proof/);

    // Dave claim his rewards
    let trans = await merkleDistributor.connect(Dave).claim(3, Dave.address, daveAmount, merkleTree.getProof(3, Dave.address, daveAmount));
    await trans.wait();
    await expect(trans)
      .to.emit(merkleDistributor, 'Claimed').withArgs(3, Dave.address, daveAmount);
    await expect(trans).to.changeTokenBalances(
      erc20,
      [await merkleDistributor.getAddress(), Dave.address],
      [-daveAmount, daveAmount]
    );
    
    // Eve's rewards amount is 0, he could still claim, but no token transferred
    const eveProof = merkleTree.getProof(4, Eve.address, eveAmount);
    trans = await merkleDistributor.connect(Eve).claim(4, Eve.address, eveAmount, eveProof);
    await trans.wait();
    await expect(trans)
      .to.emit(merkleDistributor, 'Claimed').withArgs(4, Eve.address, 0);
    await expect(trans).to.changeTokenBalances(
      erc20,
      [await merkleDistributor.getAddress(), Eve.address],
      [0, 0]
    );



  });

});

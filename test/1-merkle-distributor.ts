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
    const { Alice, Bob, Caro, Dave, erc20 } = await loadFixture(deployContractsFixture);

    const aliceAmount = ethers.parseUnits('100.5', await erc20.decimals());
    const bobAmount = ethers.parseUnits('2.5', await erc20.decimals());
    const caroAmount = ethers.parseUnits('0.01', await erc20.decimals());
    const daveAmount = ethers.parseUnits('6.009', await erc20.decimals());
    const totalAmount = aliceAmount + bobAmount + caroAmount + daveAmount;

    const distributionList = [
      { account: Alice.address, amount: aliceAmount },
      { account: Bob.address, amount: bobAmount },
      { account: Caro.address, amount: caroAmount },
      { account: Dave.address, amount: daveAmount }
    ];
    const merkleTree = new BalanceTree(distributionList);

    const MerkleDistributor = await ethers.getContractFactory('MerkleDistributor');
    const merkleDistributorContract = await MerkleDistributor.deploy(await erc20.getAddress(), merkleTree.getHexRoot());
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
    await expect(merkleDistributor.connect(Bob).claim(1, Bob.address, bobAmount, bobProof)).to.be.rejected

    // Caro's rewards could not be claimed with an invalid proof or amount
    await expect(merkleDistributor.connect(Caro).claim(2, Caro.address, bobAmount, bobProof)).to.be.rejected;
    await expect(merkleDistributor.connect(Caro).claim(2, Caro.address, caroAmount, bobProof)).to.be.rejected;

  });

});

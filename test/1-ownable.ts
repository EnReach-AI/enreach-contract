import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { encodeBytes32String } from "ethers";
import { deployContractsFixture, ONE_DAY_IN_SECS } from "./utils";

describe("Ownable", () => {

  it("Protocol ownable work", async () => {
    const {
      Alice, Bob, protocol, settings, enReachToken, rewardsDistributor
    } = await loadFixture(deployContractsFixture);

    let protocolOwner = await protocol.owner();
    expect(protocolOwner).to.equal(await protocol.protocolOwner(), "Protocol owner is Alice");
    expect(protocolOwner).to.equal(Alice.address, "Protocol owner is Alice");

    const contracts = [settings, rewardsDistributor];
    for (const contract of contracts) {
      const owner = await contract.owner();
      expect(owner).to.equal(protocolOwner, "Contract owner is protocol owner Alice");
    }
    
    await expect(protocol.connect(Bob).transferOwnership(Bob.address)).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(protocol.connect(Alice).transferOwnership(Bob.address))
      .to.emit(protocol, "OwnershipTransferred")
      .withArgs(Alice.address, Bob.address);

    protocolOwner = await protocol.owner();
    expect(protocolOwner).to.equal(await protocol.protocolOwner(), "Protocol owner is Bob");
    expect(protocolOwner).to.equal(Bob.address, "Protocol owner is Bob");

    for (const contract of contracts) {
      const owner = await contract.owner();
      expect(owner).to.equal(Bob.address, "Contract owner is protocol owner Bob");
    }
  });

  it("Privileged operations", async () => {
    const {
      Alice, Bob, protocol, settings, enReachToken, rewardsDistributor
    } = await loadFixture(deployContractsFixture);

    let protocolOwner = await protocol.owner();
    expect(protocolOwner).to.equal(await protocol.protocolOwner(), "Protocol owner is Alice");
    expect(protocolOwner).to.equal(Alice.address, "Protocol owner is Alice");

    // Only admin could update params
    await expect(protocol.connect(Alice).transferOwnership(Bob.address)).not.to.be.reverted;
    await expect(settings.connect(Alice).setTreasury(Bob.address)).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(settings.connect(Alice).upsertParamValue(encodeBytes32String("RewardsActivationDelay"), ONE_DAY_IN_SECS)).to.be.revertedWith("Ownable: caller is not the owner");
    
    await expect(protocol.connect(Bob).transferOwnership(Alice.address)).not.to.be.reverted;
    await expect(settings.connect(Alice).setTreasury(Bob.address))
      .to.emit(settings, "UpdateTreasury")
      .withArgs(anyValue, Bob.address);
    await expect(settings.connect(Alice).upsertParamValue(encodeBytes32String("RewardsActivationDelay"), ONE_DAY_IN_SECS))
      .to.emit(settings, "UpsertParamValue")
      .withArgs(encodeBytes32String("RewardsActivationDelay"), ONE_DAY_IN_SECS);
    
    expect(await settings.treasury()).to.equal(Bob.address, "Treasury is Bob");
    expect(await settings.paramValue(encodeBytes32String("RewardsActivationDelay"))).to.equal(ONE_DAY_IN_SECS, "RewardsActivationDelay is updated");

  });

});

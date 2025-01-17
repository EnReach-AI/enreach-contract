import * as _ from "lodash";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { deployContract, wait1Tx } from "./hutils";
import { 
  MockERC20__factory, ProtocolSettings__factory, EnReachProtocol__factory, ERC20__factory, RewardsDistributor__factory
} from "../typechain";
import { deploy } from "@openzeppelin/hardhat-upgrades/dist/utils";

dotenv.config();

let deployer: SignerWithAddress;

async function main() {
  const signers = await ethers.getSigners();
  deployer = signers[0];
  const nonce = await deployer.getNonce();
  console.log("deployer:", deployer.address);
  console.log("nonce:", nonce);

  let treasuryAddress = process.env.TREASURY_ADDRESS || signers[0].address;

  const protocolAddress = await deployContract("EnReachProtocol", []);
  const protocol = EnReachProtocol__factory.connect(protocolAddress, deployer);

  const protocolSettingsAddress = await deployContract("ProtocolSettings", [protocolAddress, treasuryAddress]);
  const settings = ProtocolSettings__factory.connect(protocolSettingsAddress, deployer);

  const enReachTokenAddress = await deployContract("EnReachToken", [await settings.getAddress(), "EnReach Token", "REACH"]);
  const enReachToken = ERC20__factory.connect(enReachTokenAddress, deployer);

  const rewardsDistributorAddress = await deployContract("RewardsDistributor", [
    await protocol.getAddress(), await settings.getAddress(), await enReachToken.getAddress()
  ]);
  const rewardsDistributor = RewardsDistributor__factory.connect(rewardsDistributorAddress, deployer);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
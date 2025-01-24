import { ethers } from "hardhat";
import { encodeBytes32String } from "ethers";
import { ProtocolSettings__factory } from "../typechain";

async function main() {
  const [deployer] = await ethers.getSigners();

  const settings = ProtocolSettings__factory.connect("0xa216814E345E83181563cc6380E3ddEe7d035308", deployer);

  let rewardsActivationDelay = await settings.paramValue(encodeBytes32String("RewardsActivationDelay"));
  console.info("rewardsActivationDelay: ", rewardsActivationDelay);

  let trans = await settings.connect(deployer).upsertParamValue(encodeBytes32String("RewardsActivationDelay"), 3600);
  await trans.wait();

  rewardsActivationDelay = await settings.paramValue(encodeBytes32String("RewardsActivationDelay"));
  console.info("rewardsActivationDelay: ", rewardsActivationDelay);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

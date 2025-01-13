import _ from 'lodash';
import { expect } from "chai";
import { encodeBytes32String, formatUnits } from "ethers";
import { ethers } from "hardhat";
import { time } from '@nomicfoundation/hardhat-network-helpers';
import {
  MockERC20__factory,
  EnReachProtocol__factory,
  ProtocolSettings__factory,
  ERC20__factory,
} from "../typechain";

const { provider } = ethers;

export const ONE_DAY_IN_SECS = 24 * 60 * 60;

export const SETTINGS_DECIMALS = 10n;

export const nativeTokenAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const maxContractSize = 24576;

export async function deployContractsFixture() {
  const [Alice, Bob, Caro, Dave, Eve, Ivy] = await ethers.getSigners();

  const EnReachProtocolFactory = await ethers.getContractFactory("EnReachProtocol");
  expect(EnReachProtocolFactory.bytecode.length / 2).lessThan(maxContractSize);
  const EnReachProtocol = await EnReachProtocolFactory.deploy();
  const protocol = EnReachProtocol__factory.connect(await EnReachProtocol.getAddress(), provider);

  const ProtocolSettingsFactory = await ethers.getContractFactory("ProtocolSettings");
  expect(ProtocolSettingsFactory.bytecode.length / 2).lessThan(maxContractSize);
  const ProtocolSettings = await ProtocolSettingsFactory.deploy(await protocol.getAddress(), Ivy.address);
  const settings = ProtocolSettings__factory.connect(await ProtocolSettings.getAddress(), provider);
  
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const MockERC20 = await MockERC20Factory.deploy(await protocol.getAddress(), "ERC20 Mock", "MockERC20", 18);
  const erc20 = MockERC20__factory.connect(await MockERC20.getAddress(), provider);

  return { 
    Alice, Bob, Caro, Dave, Eve, Ivy, protocol, settings, erc20
  };

}
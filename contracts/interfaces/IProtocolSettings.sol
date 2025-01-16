// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IProtocolSettings {

  function treasury() external view returns (address);

  function decimals() external view returns (uint256);

  function paramValue(bytes32 param) external view returns (uint256);
  
}
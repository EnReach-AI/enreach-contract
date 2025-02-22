// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/Context.sol";
import "../interfaces/IEnReachProtocol.sol";

abstract contract ProtocolOwner is Context {
  IEnReachProtocol public immutable protocol;

  constructor(address _protocol_) {
    require(_protocol_ != address(0), "Zero address detected");
    protocol = IEnReachProtocol(_protocol_);
  }

  modifier onlyProtocol() {
    require(_msgSender() == address(protocol), "Ownable: caller is not the protocol");
    _;
  }

  modifier onlyOwner() {
    require(_msgSender() == IEnReachProtocol(protocol).protocolOwner(), "Ownable: caller is not the owner");
    _;
  }

  function owner() public view returns(address) {
    return IEnReachProtocol(protocol).protocolOwner();
  }
}
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IEnReachProtocol.sol";

contract ZooProtocol is IEnReachProtocol, Ownable {

  constructor() {}

  /* ========== Views ========= */

  function protocolOwner() public view returns (address) {
    return owner();
  }

}
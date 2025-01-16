// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "hardhat/console.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../interfaces/IProtocolSettings.sol";
import "../libs/Constants.sol";
import "./ProtocolOwner.sol";

contract ProtocolSettings is IProtocolSettings, ProtocolOwner, ReentrancyGuard {
  using EnumerableSet for EnumerableSet.Bytes32Set;

  address internal _treasury;

  EnumerableSet.Bytes32Set internal _paramsSet;
  mapping(bytes32 => uint256) _paramValue;

  constructor(address _protocol_, address _treasury_) ProtocolOwner(_protocol_) {
    _treasury = _treasury_;

    // Activation day of newly submitted rewards distribution root
    _upsertParamValue("RewardsActivationDelay", 7 days);
  }

  /* ============== VIEWS =============== */

  function treasury() public view override returns (address) {
    return _treasury;
  }

  function decimals() public pure override returns (uint256) {
    return Constants.PROTOCOL_DECIMALS;
  }

  function params() public view returns (bytes32[] memory) {
    return _paramsSet.values();
  }

  function paramValue(bytes32 param) public view returns (uint256) {
    require(param.length > 0, "Empty param name");
    require(_paramsSet.contains(param), "Invalid param name");
    return _paramValue[param];
  }

  /* ============ MUTATIVE FUNCTIONS =========== */

  function setTreasury(address newTreasury) external nonReentrant onlyOwner {
    require(newTreasury != address(0), "Zero address detected");
    require(newTreasury != _treasury, "Same treasury");

    address prevTreasury = _treasury;
    _treasury = newTreasury;
    emit UpdateTreasury(prevTreasury, _treasury);
  }

  function upsertParamValue(bytes32 param, uint256 value) external nonReentrant onlyOwner {
    _upsertParamValue(param, value);
  }

  /* ========== INTERNAL FUNCTIONS ========== */

  function _upsertParamValue(bytes32 param, uint256 value) internal {
    require(param.length > 0, "Empty param name");
    if (!_paramsSet.contains(param)) {
      _paramsSet.add(param);
    }

    _paramValue[param] = value;
    emit UpsertParamValue(param, value);
  }


  /* =============== EVENTS ============= */

  event UpdateTreasury(address prevTreasury, address newTreasury);

  event UpsertParamValue(bytes32 indexed name, uint256 value);

}
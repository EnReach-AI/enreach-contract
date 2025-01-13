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

  struct ParamConfig {
    uint256 defaultValue;
    uint256 min;
    uint256 max;
  }

  EnumerableSet.Bytes32Set internal _paramsSet;
  mapping(bytes32 => ParamConfig) internal _paramConfigs;

  constructor(address _protocol_, address _treasury_) ProtocolOwner(_protocol_) {
    _treasury = _treasury_;

    // _upsertParamConfig("D", 30 days, 1 hours, 365 days);
  }

  /* ============== VIEWS =============== */

  function treasury() public view override returns (address) {
    return _treasury;
  }

  function decimals() public pure returns (uint256) {
    return Constants.PROTOCOL_DECIMALS;
  }

  function params() public view returns (bytes32[] memory) {
    return _paramsSet.values();
  }

  function isValidParam(bytes32 param, uint256 value) public view returns (bool) {
    if (param.length == 0 || !_paramsSet.contains(param)) {
      return false;
    }

    ParamConfig memory config = _paramConfigs[param];
    return config.min <= value && value <= config.max;
  }

  function paramConfig(bytes32 param) public view returns(ParamConfig memory) {
    require(param.length > 0, "Empty param name");
    require(_paramsSet.contains(param), "Invalid param name");
    return _paramConfigs[param];
  }

  function paramDefaultValue(bytes32 param) public view returns (uint256) {
    require(param.length > 0, "Empty param name");
    require(_paramsSet.contains(param), "Invalid param name");
    return paramConfig(param).defaultValue;
  }

  /* ============ MUTATIVE FUNCTIONS =========== */

  function setTreasury(address newTreasury) external nonReentrant onlyOwner {
    require(newTreasury != address(0), "Zero address detected");
    require(newTreasury != _treasury, "Same treasury");

    address prevTreasury = _treasury;
    _treasury = newTreasury;
    emit UpdateTreasury(prevTreasury, _treasury);
  }

  function upsertParamConfig(bytes32 param, uint256 defaultValue, uint256 min, uint256 max) external nonReentrant onlyOwner {
    _upsertParamConfig(param, defaultValue, min, max);
  }

  function _upsertParamConfig(bytes32 param, uint256 defaultValue, uint256 min, uint256 max) internal {
    require(param.length > 0, "Empty param name");
    require(min <= defaultValue && defaultValue <= max, "Invalid default value");

    if (_paramsSet.contains(param)) {
      ParamConfig storage config = _paramConfigs[param];
      config.defaultValue = defaultValue;
      config.min = min;
      config.max = max;
    }
    else {
      _paramsSet.add(param);
      _paramConfigs[param] = ParamConfig(defaultValue, min, max);
    }
    emit UpsertParamConfig(param, defaultValue, min, max);
  }

  /* =============== EVENTS ============= */

  event UpdateTreasury(address prevTreasury, address newTreasury);

  event UpsertParamConfig(bytes32 indexed name, uint256 defaultValue, uint256 min, uint256 max);

}
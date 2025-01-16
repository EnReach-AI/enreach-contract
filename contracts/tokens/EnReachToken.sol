// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/IProtocolSettings.sol";
import "../settings/ProtocolOwner.sol";

contract EnReachToken is ProtocolOwner, ERC20, ReentrancyGuard {

  uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;  // 1 billion

  address public immutable settings;

  string internal _name_;
  string internal _symbol_;
  
  constructor(
    address _protocol, address _settings,
    string memory _name, string memory _symbol
  ) ProtocolOwner(_protocol) ERC20(_name, _symbol) {
    require(_settings != address(0), "Zero address detected");
    settings = _settings;

    _name_ = _name;
    _symbol_ = _symbol;

    address treasury = IProtocolSettings(settings).treasury();
    require(treasury != address(0), "Zero treasury address");

    _mint(treasury, TOTAL_SUPPLY);
  }

  /* ================= IERC20 Functions ================ */

  function name() public view virtual override returns (string memory) {
    return _name_;
  }

  function symbol() public view virtual override returns (string memory) {
    return _symbol_;
  }

  /* ========== RESTRICTED FUNCTIONS ========== */

  function setName(string memory _name) external nonReentrant onlyOwner {
    _name_ = _name;
  }

  function setSymbol(string memory _symbol) external nonReentrant onlyOwner {
    _symbol_ = _symbol;
  }

}
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../interfaces/IProtocolSettings.sol";
import "../interfaces/IRewardsDistributor.sol";
import "../libs/TokensTransfer.sol";
import "../settings/ProtocolOwner.sol";

contract RewardsDistributor is IRewardsDistributor, ProtocolOwner, ReentrancyGuard {
  using EnumerableSet for EnumerableSet.AddressSet;

  address public immutable settings;

  address public immutable rewardsToken;

  uint256 public currRewardsCalculationEndEpoch;
  uint256 public currRewardsCalculationEndTimestamp;

  RewardsDistributionRoot[] internal _rewardsDistributionRoots;

  EnumerableSet.AddressSet internal _rewarders;

  /// @notice Mapping: earner => total amount claimed
  mapping(address => uint256) public cumulativeClaimedRewards;

  constructor(address _protocol, address _settings, address _rewardsToken) ProtocolOwner(_protocol) {
    require(_settings != address(0) && _rewardsToken != address(0), "Zero address detected");

    settings = _settings;
    rewardsToken = _rewardsToken;
  }

   /* ================= VIEWS ================ */

  function getRewardsDistributionRootCount() public view returns (uint256) {
    return _rewardsDistributionRoots.length;
  }

  function getRewardsDistributionRoot(uint256 index) public view returns (RewardsDistributionRoot memory) {
    require(index < _rewardsDistributionRoots.length, "Invalid index");
    return _rewardsDistributionRoots[index];
  }

  function getRewardsDistributionRoots() public view returns (RewardsDistributionRoot[] memory) {
    return _rewardsDistributionRoots;
  }

  function getRewardersCount() public view returns (uint256) {
    return _rewarders.length();
  }

  function getRewarder(uint256 index) public view returns (address) {
    require(index < _rewarders.length(), "Invalid index");
    return _rewarders.at(index);
  }

  function getRewarders() public view returns (address[] memory) {
    return _rewarders.values();
  }

  function isRewarder(address account) public view returns (bool) {
    return _rewarders.contains(account);
  }
  

  /* ================= MUTATIVE FUNCTIONS ================ */

  function claim(
    uint256 rootIndex, bytes32 merkleRoot,
    uint256 accountIndex, address account, uint256 amount, bytes32[] calldata merkleProof
  ) external nonReentrant {
    require(rootIndex < _rewardsDistributionRoots.length, "Invalid rootIndex");

    RewardsDistributionRoot memory distributionRoot = _rewardsDistributionRoots[rootIndex];
    require(distributionRoot.merkleRoot == merkleRoot, "Invalid root");
    require(!distributionRoot.disabled, "Root disabled");
    require(block.timestamp >= distributionRoot.activatedAt, "Root not activated yet");

    // Verify the merkle proof.
    bytes32 node = keccak256(abi.encodePacked(accountIndex, account, amount));
    require(MerkleProof.verify(merkleProof, distributionRoot.merkleRoot, node), "Invalid proof");

    require(amount > cumulativeClaimedRewards[account], "Nothing to claim");
    uint256 claimAmount = amount - cumulativeClaimedRewards[account];
    cumulativeClaimedRewards[account] = amount;

    uint256 balance = IERC20(rewardsToken).balanceOf(address(this));
    require(claimAmount <= balance, "Insufficient balance");
    TokensTransfer.transferTokens(rewardsToken, address(this), account, claimAmount);

    emit RewardsClaimed(rootIndex, account, claimAmount);
  }

  /* ========== RESTRICTED FUNCTIONS ========== */

  function setRewarder(address account, bool rewarder) external nonReentrant onlyOwner {
    _setRewarder(account, rewarder);
  }

  function withdraw(address recipient, uint256 amount) external nonReentrant onlyOwner {
    require(recipient != address(0), "Invalid recipient");
    require(amount > 0, "Invalid amount");

    uint256 balance = IERC20(rewardsToken).balanceOf(address(this));
    if (amount <= balance) {
      TokensTransfer.transferTokens(rewardsToken, address(this), recipient, amount);
    }

    emit Withdrawn(_msgSender(), recipient, amount);
  }

  function submitRewardsDistributionRoot(
    bytes32 merkleRoot, uint256 rewardsCalculationEndEpoch, uint256 rewardsCalculationEndTimestamp
  ) external nonReentrant onlyOwnerOrRewarder {
    require(merkleRoot != bytes32(0), "Invalid root");
    require(rewardsCalculationEndTimestamp < block.timestamp, "rewardsCalculationEndTimestamp cannot be in the future");

    uint256 activationDelay = IProtocolSettings(settings).paramValue("RewardsActivationDelay");
    uint256 activatedAt = block.timestamp + activationDelay;

    uint256 rootIndex = _rewardsDistributionRoots.length;
    _rewardsDistributionRoots.push(RewardsDistributionRoot({
      merkleRoot: merkleRoot,
      rewardsCalculationEndEpoch: rewardsCalculationEndEpoch,
      rewardsCalculationEndTimestamp: rewardsCalculationEndTimestamp,
      activatedAt: activatedAt,
      disabled: false
    }));

    currRewardsCalculationEndEpoch = rewardsCalculationEndEpoch;
    currRewardsCalculationEndTimestamp = rewardsCalculationEndTimestamp;
    emit RewardsDistributionRootSubmitted(
      rootIndex, merkleRoot, rewardsCalculationEndEpoch, rewardsCalculationEndTimestamp, activatedAt
    );
  }

  /**
   * @notice allow the rewarder to disable/cancel a pending root submission in case of an error
   */
  function disableRoot(uint32 rootIndex, bytes32 merkleRoot) external nonReentrant onlyOwnerOrRewarder {
    require(rootIndex < _rewardsDistributionRoots.length, "Invalid rootIndex");

    RewardsDistributionRoot storage distributionRoot = _rewardsDistributionRoots[rootIndex];
    require(distributionRoot.merkleRoot == merkleRoot, "Invalid root");
    require(!distributionRoot.disabled, "Root already disabled");
    require(block.timestamp < distributionRoot.activatedAt, "Root already activated");
    distributionRoot.disabled = true;

    emit RewardsDistributionRootDisabled(rootIndex, merkleRoot);
  }

  /**
   * @notice allow the rewarder to enable a previously disabled pending root submission in case of an error action
   */
  function enableRoot(uint32 rootIndex, bytes32 merkleRoot) external nonReentrant onlyOwnerOrRewarder {
    require(rootIndex < _rewardsDistributionRoots.length, "Invalid rootIndex");

    RewardsDistributionRoot storage distributionRoot = _rewardsDistributionRoots[rootIndex];
    require(distributionRoot.merkleRoot == merkleRoot, "Invalid root");
    require(distributionRoot.disabled, "Root already enabled");
    require(block.timestamp < distributionRoot.activatedAt, "Root already activated");
    distributionRoot.disabled = false;

    emit RewardsDistributionRootEnabled(rootIndex, merkleRoot);
  }


  /* ========== INTERNAL FUNCTIONS ========== */

  function _setRewarder(address account, bool rewarder) internal {
    require(account != address(0), "Zero address detected");

    if (rewarder) {
      require(!_rewarders.contains(account), "Address is already rewarder");
      _rewarders.add(account);
    }
    else {
      require(_rewarders.contains(account), "Address was not rewarder");
      _rewarders.remove(account);
    }

    emit UpdateRewarder(account, rewarder);
  }


  /* ============== MODIFIERS =============== */

  modifier onlyOwnerOrRewarder() {
    require((owner() == _msgSender()) || isRewarder(_msgSender()), "Caller is not owner or rewarder");
    _;
  }


  /* ========== EVENTS ========== */

  event UpdateRewarder(address indexed account, bool rewarder);

  event RewardsDistributionRootSubmitted(
    uint256 indexed rootIndex,
    bytes32 indexed merkleRoot,
    uint256 indexed rewardsCalculationEndEpoch,
    uint256 rewardsCalculationEndTimestamp,
    uint256 activatedAt
  );

  event RewardsDistributionRootDisabled(uint256 indexed rootIndex, bytes32 indexed merkleRoot);

  event RewardsDistributionRootEnabled(uint256 indexed rootIndex, bytes32 indexed merkleRoot);

  event RewardsClaimed(uint256 indexed rootIndex, address indexed account, uint256 amount);

  event Withdrawn(address indexed owner, address recipient, uint256 amount);

}
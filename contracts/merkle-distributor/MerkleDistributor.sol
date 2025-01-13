// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "../libs/TokensTransfer.sol";
import "../interfaces/IMerkleDistributor.sol";
import "../settings/ProtocolOwner.sol";

contract MerkleDistributor is IMerkleDistributor, ProtocolOwner {
  address public immutable override token;
  bytes32 public immutable override merkleRoot;

  // This is a packed array of booleans.
  mapping(uint256 => uint256) private claimedBitMap;

  constructor(address _protocol, address _token, bytes32 _merkleRoot) ProtocolOwner(_protocol) {
    token = _token;
    merkleRoot = _merkleRoot;
  }

  /* ================= VIEWS ================ */

  function isClaimed(uint256 index) public view override returns (bool) {
    uint256 claimedWordIndex = index / 256;
    uint256 claimedBitIndex = index % 256;
    uint256 claimedWord = claimedBitMap[claimedWordIndex];
    uint256 mask = (1 << claimedBitIndex);
    return claimedWord & mask == mask;
  }

  /* ================= MUTATIVE FUNCTIONS ================ */

  function claim(
    uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof
  ) public virtual override {
    require(!isClaimed(index), "Already claimed");

    // Verify the merkle proof.
    bytes32 node = keccak256(abi.encodePacked(index, account, amount));
    require(MerkleProof.verify(merkleProof, merkleRoot, node), "Invalid proof");

    // Mark it claimed and send the token.
    _setClaimed(index);
    if (amount > 0) {
      TokensTransfer.transferTokens(token, address(this), account, amount);
    }
    
    emit Claimed(index, account, amount);
  }

  /* ========== RESTRICTED FUNCTIONS ========== */

  function withdraw(address recipient, uint256 amount) external onlyOwner {
    require(recipient != address(0), "Invalid recipient");
    require(amount > 0, "Invalid amount");

    uint256 balance = IERC20(token).balanceOf(address(this));
    if (amount <= balance) {
      TokensTransfer.transferTokens(token, address(this), _msgSender(), amount);
    }

    emit Withdrawn(_msgSender(), recipient, amount);
  }

  /* ========== INTERNAL FUNCTIONS ========== */

  function _setClaimed(uint256 index) private {
    uint256 claimedWordIndex = index / 256;
    uint256 claimedBitIndex = index % 256;
    claimedBitMap[claimedWordIndex] = claimedBitMap[claimedWordIndex] | (1 << claimedBitIndex);
  }

  /* ========== EVENTS and ERRORS ========== */

  event Claimed(uint256 index, address account, uint256 amount);

  event Withdrawn(address indexed owner, address recipient, uint256 amount);
}

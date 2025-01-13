// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "../interfaces/IMerkleDistributor.sol";

contract MerkleDistributor is IMerkleDistributor {
  using SafeERC20 for IERC20;

  address public immutable override token;
  bytes32 public immutable override merkleRoot;

  // This is a packed array of booleans.
  mapping(uint256 => uint256) private claimedBitMap;

  constructor(address _token, bytes32 _merkleRoot) {
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
    if (isClaimed(index)) revert AlreadyClaimed();

    // Verify the merkle proof.
    bytes32 node = keccak256(abi.encodePacked(index, account, amount));
    if (!MerkleProof.verify(merkleProof, merkleRoot, node)) revert InvalidProof();

    // Mark it claimed and send the token.
    _setClaimed(index);
    IERC20(token).safeTransfer(account, amount);

    emit Claimed(index, account, amount);
  }

  /* ========== INTERNAL FUNCTIONS ========== */

  function _setClaimed(uint256 index) private {
    uint256 claimedWordIndex = index / 256;
    uint256 claimedBitIndex = index % 256;
    claimedBitMap[claimedWordIndex] = claimedBitMap[claimedWordIndex] | (1 << claimedBitIndex);
  }

  /* ========== EVENTS and ERRORS ========== */

  event Claimed(uint256 index, address account, uint256 amount);

  error AlreadyClaimed();
  error InvalidProof();
}

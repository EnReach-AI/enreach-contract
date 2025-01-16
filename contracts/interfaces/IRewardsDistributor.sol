// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IRewardsDistributor {

    /**
     * @notice A distribution root is a merkle root of the distribution of earnings for a given period.
     * The RewardsDistributor stores all historical distribution roots so that earners can claim their earnings against older roots
     * if they wish but the merkle tree contains the cumulative earnings of all earners and tokens for a given period so earners
     * only need to claim against the latest root to claim all available earnings.
     * @param root The merkle root of the distribution
     * @param rewardsCalculationEndEpoch The epoch until which rewards have been calculated
     * @param rewardsCalculationEndTimestamp The timestamp (seconds) until which rewards have been calculated
     * @param activatedAt The timestamp (seconds) at which the root can be claimed against
     */
    struct RewardsDistributionRoot {
      bytes32 merkleRoot;
      uint256 rewardsCalculationEndEpoch;
      uint256 rewardsCalculationEndTimestamp;
      uint256 activatedAt;
      bool disabled;
    }

}
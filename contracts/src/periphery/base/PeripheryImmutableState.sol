// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import '../interfaces/IPeripheryImmutableState.sol';

/// @title Immutable state
/// @notice Immutable state used by periphery contracts
abstract contract PeripheryImmutableState is IPeripheryImmutableState {
    /// @inheritdoc IPeripheryImmutableState
    address public immutable override factory;
    /// @inheritdoc IPeripheryImmutableState
    address public immutable override WETH9;

    constructor(address _factory) {
        factory = _factory;
        WETH9 = 0x2F3A25941AB75Ef97c97749343d7c71F09762e48;
    }
}

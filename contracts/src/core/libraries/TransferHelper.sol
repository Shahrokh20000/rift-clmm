// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20Minimal} from '../interfaces/IERC20Minimal.sol';

/// @title TransferHelper
/// @notice Contains helper methods for interacting with ERC20 tokens that do not consistently return true/false
library TransferHelper {
    error TF();

    /// @notice Transfers tokens from msg.sender to a recipient
    /// @dev Calls transfer on token contract, errors with TF if transfer fails
    /// @param token The contract address of the token which will be transferred
    /// @param to The recipient of the transfer
    /// @param value The value of the transfer
    function safeTransfer(
        address token,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20Minimal.transfer.selector, to, value)
        );
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) {
            bytes4 src20Selector = bytes4(keccak256("transfer(address,suint256)"));
            bytes memory src20Calldata = abi.encodeWithSelector(src20Selector,to,value);
            (success,data) = token.call(src20Calldata);
            if (!(success && (data.length == 0 || abi.decode(data, (bool))))) revert TF();
            return;
        }
    }
}

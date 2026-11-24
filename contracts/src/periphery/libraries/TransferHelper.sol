// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

library TransferHelper {
    error TF();

    /// @notice Transfers tokens from the targeted address to the given destination
    /// @dev Tries standard ERC20 first, falls back to SRC20 if it fails. Errors with 'STF'
    /// @param token The contract address of the token to be transferred
    /// @param from The originating address from which the tokens will be transferred
    /// @param to The destination address of the transfer
    /// @param value The amount to be transferred
    function safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value)
        );
        
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) {
            bytes4 src20Selector = bytes4(keccak256("transferFrom(address,address,suint256)"));
            bytes memory src20Calldata = abi.encodeWithSelector(src20Selector, from, to, value);
            (success, data) = token.call(src20Calldata);
            
            require(success && (data.length == 0 || abi.decode(data, (bool))), 'STF');
        }
    }

    /// @notice Transfers tokens from msg.sender to a recipient
    /// @dev Tries standard ERC20 first, falls back to SRC20 if it fails. Errors with 'ST'
    /// @param token The contract address of the token which will be transferred
    /// @param to The recipient of the transfer
    /// @param value The value of the transfer
    function safeTransfer(
        address token,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, value)
        );
        
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) {
            bytes4 src20Selector = bytes4(keccak256("transfer(address,suint256)"));
            bytes memory src20Calldata = abi.encodeWithSelector(src20Selector, to, value);
            (success, data) = token.call(src20Calldata);
            
            require(success && (data.length == 0 || abi.decode(data, (bool))), 'ST');
        }
    }

    /// @notice Approves the stipulated contract to spend the given allowance in the given token
    /// @dev Tries standard ERC20 first, falls back to SRC20 if it fails. Errors with 'SA'
    /// @param token The contract address of the token to be approved
    /// @param to The target of the approval
    /// @param value The amount of the given token the target will be allowed to spend
    function safeApprove(
        address token,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, to, value)
        );
        
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) {
            bytes4 src20Selector = bytes4(keccak256("approve(address,suint256)"));
            bytes memory src20Calldata = abi.encodeWithSelector(src20Selector, to, value);
            (success, data) = token.call(src20Calldata);
            
            require(success && (data.length == 0 || abi.decode(data, (bool))), 'SA');
        }
    }

    /// @notice Transfers ETH to the recipient address
    /// @dev Fails with `STE`
    /// @param to The destination of the transfer
    /// @param value The value to be transferred
    function safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, 'STE');
    }

    
}
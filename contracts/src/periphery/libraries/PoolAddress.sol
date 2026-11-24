// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFactoryForPoolAddress {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

/// @title Provides functions for deriving a pool address from the factory, tokens, and the fee
library PoolAddress {
    bytes32 internal constant POOL_INIT_CODE_HASH = 0x6fc98a0231a3c7eb950083a093dbfff2e4ee3d4f11142855c87b26fee365281a;

    struct PoolKey {
        address token0;
        address token1;
        uint24 fee;
    }

    function getPoolKey(
        address tokenA,
        address tokenB,
        uint24 fee
    ) internal pure returns (PoolKey memory) {
        if (tokenA > tokenB) (tokenA, tokenB) = (tokenB, tokenA);
        return PoolKey({token0: tokenA, token1: tokenB, fee: fee});
    }

    function computeAddress(address factory, PoolKey memory key) internal view returns (address pool) {
        require(key.token0 < key.token1);
        
        pool = IFactoryForPoolAddress(factory).getPool(key.token0, key.token1, key.fee);
        
        require(pool != address(0), "Pool not deployed");
    }
}
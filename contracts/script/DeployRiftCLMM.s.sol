// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import {UniswapV3Factory} from "../src/core/UniswapV3Factory.sol";
import {SwapRouter} from "../src/periphery/SwapRouter.sol";
import {NonfungiblePositionManager} from "../src/periphery/NonfungiblePositionManager.sol";
import {QuoterV2} from "../src/periphery/lens/QuoterV2.sol";

/// @notice Reference deployment script for Rift CLMM core & periphery contracts on Seismic Testnet.
contract DeployRiftCLMM is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        UniswapV3Factory factory = new UniswapV3Factory();
        SwapRouter router = new SwapRouter(address(factory));
        NonfungiblePositionManager positionManager = new NonfungiblePositionManager(address(factory));
        QuoterV2 quoter = new QuoterV2(address(factory));

        vm.stopBroadcast();

        console2.log("UniswapV3Factory:", address(factory));
        console2.log("SwapRouter:", address(router));
        console2.log("NonfungiblePositionManager:", address(positionManager));
        console2.log("QuoterV2:", address(quoter));
    }
}

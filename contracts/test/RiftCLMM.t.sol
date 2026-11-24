// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import {UniswapV3Factory} from "../src/core/UniswapV3Factory.sol";
import {SwapRouter} from "../src/periphery/SwapRouter.sol";
import {QuoterV2} from "../src/periphery/lens/QuoterV2.sol";
import {Rift} from "../src/tokens/Rift.sol";
import {Gmic} from "../src/tokens/Gmic.sol";
import {WSIZE} from "../src/tokens/WSIZE.sol";

contract RiftCLMMTest is Test {
    UniswapV3Factory internal factory;
    SwapRouter internal router;
    QuoterV2 internal quoter;
    Rift internal rft;
    Gmic internal gmic;
    WSIZE internal wsize;

    function setUp() public {
        factory = new UniswapV3Factory();
        router = new SwapRouter(address(factory));
        quoter = new QuoterV2(address(factory));
        rft = new Rift();
        gmic = new Gmic();
        wsize = new WSIZE();
    }

    function testFactoryAndRouterWiring() public view {
        assertEq(router.factory(), address(factory));
        assertEq(quoter.factory(), address(factory));
        assertEq(factory.feeAmountTickSpacing(3000), 60);
    }

    function testHybridTokenCreationAndPoolDeploy() public {
        address pool = factory.createPool(address(rft), address(gmic), 3000);
        assertTrue(pool != address(0));
        assertEq(factory.getPool(address(rft), address(gmic), 3000), pool);
    }

    function testWSIZEDepositAndProtectedBalanceView() public {
        address alice = address(0xA11CE);
        vm.deal(alice, 5 ether);

        vm.prank(alice);
        wsize.deposit{value: 1 ether}();

        vm.prank(alice);
        assertEq(wsize.balanceOf(alice), 1 ether);

        vm.prank(address(0xB0B));
        vm.expectRevert("Unauthorized: Only owner can view balance");
        wsize.balanceOf(alice);
    }
}

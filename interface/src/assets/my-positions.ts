import type { Address } from "viem";
import type { pubClient } from "./clients";
import { getPoolWithDirectCall } from "./getPoolDirectly";
import { readRawSqrtPriceX96, readTickFromSlot0 } from "./readSlot0";
import { getSqrtRatioAtTick } from "./math/TickMath";

const abi = [
    {
        type: "constructor",
        inputs: [
            { name: "_factory", type: "address", internalType: "address" },
        ],
        stateMutability: "nonpayable",
    },
    { type: "receive", stateMutability: "payable" },
    {
        type: "function",
        name: "DOMAIN_SEPARATOR",
        inputs: [],
        outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "PERMIT_TYPEHASH",
        inputs: [],
        outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "WETH9",
        inputs: [],
        outputs: [{ name: "", type: "address", internalType: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "approve",
        inputs: [
            { name: "to", type: "address", internalType: "address" },
            { name: "tokenId", type: "uint256", internalType: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "balanceOf",
        inputs: [{ name: "owner", type: "address", internalType: "address" }],
        outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "baseURI",
        inputs: [],
        outputs: [{ name: "", type: "string", internalType: "string" }],
        stateMutability: "pure",
    },
    {
        type: "function",
        name: "burn",
        inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "collect",
        inputs: [
            {
                name: "params",
                type: "tuple",
                internalType:
                    "struct INonfungiblePositionManager.CollectParams",
                components: [
                    {
                        name: "tokenId",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "recipient",
                        type: "address",
                        internalType: "address",
                    },
                    {
                        name: "amount0Max",
                        type: "uint128",
                        internalType: "uint128",
                    },
                    {
                        name: "amount1Max",
                        type: "uint128",
                        internalType: "uint128",
                    },
                ],
            },
        ],
        outputs: [
            { name: "amount0", type: "uint256", internalType: "uint256" },
            { name: "amount1", type: "uint256", internalType: "uint256" },
        ],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "createAndInitializePoolIfNecessary",
        inputs: [
            { name: "token0", type: "address", internalType: "address" },
            { name: "token1", type: "address", internalType: "address" },
            { name: "fee", type: "uint24", internalType: "uint24" },
            { name: "sqrtPriceX96", type: "uint160", internalType: "uint160" },
        ],
        outputs: [{ name: "pool", type: "address", internalType: "address" }],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "decreaseLiquidity",
        inputs: [
            {
                name: "params",
                type: "tuple",
                internalType:
                    "struct INonfungiblePositionManager.DecreaseLiquidityParams",
                components: [
                    {
                        name: "tokenId",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "liquidity",
                        type: "uint128",
                        internalType: "uint128",
                    },
                    {
                        name: "amount0Min",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amount1Min",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "deadline",
                        type: "uint256",
                        internalType: "uint256",
                    },
                ],
            },
        ],
        outputs: [
            { name: "amount0", type: "uint256", internalType: "uint256" },
            { name: "amount1", type: "uint256", internalType: "uint256" },
        ],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "factory",
        inputs: [],
        outputs: [{ name: "", type: "address", internalType: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getApproved",
        inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
        outputs: [{ name: "", type: "address", internalType: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "increaseLiquidity",
        inputs: [
            {
                name: "params",
                type: "tuple",
                internalType:
                    "struct INonfungiblePositionManager.IncreaseLiquidityParams",
                components: [
                    {
                        name: "tokenId",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amount0Desired",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amount1Desired",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amount0Min",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amount1Min",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "deadline",
                        type: "uint256",
                        internalType: "uint256",
                    },
                ],
            },
        ],
        outputs: [
            { name: "liquidity", type: "uint128", internalType: "uint128" },
            { name: "amount0", type: "uint256", internalType: "uint256" },
            { name: "amount1", type: "uint256", internalType: "uint256" },
        ],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "isApprovedForAll",
        inputs: [
            { name: "owner", type: "address", internalType: "address" },
            { name: "operator", type: "address", internalType: "address" },
        ],
        outputs: [{ name: "", type: "bool", internalType: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "mint",
        inputs: [
            {
                name: "params",
                type: "tuple",
                internalType: "struct INonfungiblePositionManager.MintParams",
                components: [
                    {
                        name: "token0",
                        type: "address",
                        internalType: "address",
                    },
                    {
                        name: "token1",
                        type: "address",
                        internalType: "address",
                    },
                    { name: "fee", type: "uint24", internalType: "uint24" },
                    { name: "tickLower", type: "int24", internalType: "int24" },
                    { name: "tickUpper", type: "int24", internalType: "int24" },
                    {
                        name: "amount0Desired",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amount1Desired",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amount0Min",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amount1Min",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "recipient",
                        type: "address",
                        internalType: "address",
                    },
                    {
                        name: "deadline",
                        type: "uint256",
                        internalType: "uint256",
                    },
                ],
            },
        ],
        outputs: [
            { name: "tokenId", type: "uint256", internalType: "uint256" },
            { name: "liquidity", type: "uint128", internalType: "uint128" },
            { name: "amount0", type: "uint256", internalType: "uint256" },
            { name: "amount1", type: "uint256", internalType: "uint256" },
        ],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "multicall",
        inputs: [{ name: "data", type: "bytes[]", internalType: "bytes[]" }],
        outputs: [
            { name: "results", type: "bytes[]", internalType: "bytes[]" },
        ],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "name",
        inputs: [],
        outputs: [{ name: "", type: "string", internalType: "string" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "ownerOf",
        inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
        outputs: [{ name: "", type: "address", internalType: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "permit",
        inputs: [
            { name: "spender", type: "address", internalType: "address" },
            { name: "tokenId", type: "uint256", internalType: "uint256" },
            { name: "deadline", type: "uint256", internalType: "uint256" },
            { name: "v", type: "uint8", internalType: "uint8" },
            { name: "r", type: "bytes32", internalType: "bytes32" },
            { name: "s", type: "bytes32", internalType: "bytes32" },
        ],
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "positions",
        inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
        outputs: [
            { name: "nonce", type: "uint96", internalType: "uint96" },
            { name: "operator", type: "address", internalType: "address" },
            { name: "token0", type: "address", internalType: "address" },
            { name: "token1", type: "address", internalType: "address" },
            { name: "fee", type: "uint24", internalType: "uint24" },
            { name: "tickLower", type: "int24", internalType: "int24" },
            { name: "tickUpper", type: "int24", internalType: "int24" },
            { name: "liquidity", type: "uint128", internalType: "uint128" },
            {
                name: "feeGrowthInside0LastX128",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "feeGrowthInside1LastX128",
                type: "uint256",
                internalType: "uint256",
            },
            { name: "tokensOwed0", type: "uint128", internalType: "uint128" },
            { name: "tokensOwed1", type: "uint128", internalType: "uint128" },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "refundETH",
        inputs: [],
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "safeTransferFrom",
        inputs: [
            { name: "from", type: "address", internalType: "address" },
            { name: "to", type: "address", internalType: "address" },
            { name: "tokenId", type: "uint256", internalType: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "safeTransferFrom",
        inputs: [
            { name: "from", type: "address", internalType: "address" },
            { name: "to", type: "address", internalType: "address" },
            { name: "tokenId", type: "uint256", internalType: "uint256" },
            { name: "data", type: "bytes", internalType: "bytes" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "selfPermit",
        inputs: [
            { name: "token", type: "address", internalType: "address" },
            { name: "value", type: "uint256", internalType: "uint256" },
            { name: "deadline", type: "uint256", internalType: "uint256" },
            { name: "v", type: "uint8", internalType: "uint8" },
            { name: "r", type: "bytes32", internalType: "bytes32" },
            { name: "s", type: "bytes32", internalType: "bytes32" },
        ],
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "selfPermitAllowed",
        inputs: [
            { name: "token", type: "address", internalType: "address" },
            { name: "nonce", type: "uint256", internalType: "uint256" },
            { name: "expiry", type: "uint256", internalType: "uint256" },
            { name: "v", type: "uint8", internalType: "uint8" },
            { name: "r", type: "bytes32", internalType: "bytes32" },
            { name: "s", type: "bytes32", internalType: "bytes32" },
        ],
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "selfPermitAllowedIfNecessary",
        inputs: [
            { name: "token", type: "address", internalType: "address" },
            { name: "nonce", type: "uint256", internalType: "uint256" },
            { name: "expiry", type: "uint256", internalType: "uint256" },
            { name: "v", type: "uint8", internalType: "uint8" },
            { name: "r", type: "bytes32", internalType: "bytes32" },
            { name: "s", type: "bytes32", internalType: "bytes32" },
        ],
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "selfPermitIfNecessary",
        inputs: [
            { name: "token", type: "address", internalType: "address" },
            { name: "value", type: "uint256", internalType: "uint256" },
            { name: "deadline", type: "uint256", internalType: "uint256" },
            { name: "v", type: "uint8", internalType: "uint8" },
            { name: "r", type: "bytes32", internalType: "bytes32" },
            { name: "s", type: "bytes32", internalType: "bytes32" },
        ],
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "setApprovalForAll",
        inputs: [
            { name: "operator", type: "address", internalType: "address" },
            { name: "approved", type: "bool", internalType: "bool" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "supportsInterface",
        inputs: [
            { name: "interfaceId", type: "bytes4", internalType: "bytes4" },
        ],
        outputs: [{ name: "", type: "bool", internalType: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "sweepToken",
        inputs: [
            { name: "token", type: "address", internalType: "address" },
            {
                name: "amountMinimum",
                type: "uint256",
                internalType: "uint256",
            },
            { name: "recipient", type: "address", internalType: "address" },
        ],
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "symbol",
        inputs: [],
        outputs: [{ name: "", type: "string", internalType: "string" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "tokenByIndex",
        inputs: [{ name: "index", type: "uint256", internalType: "uint256" }],
        outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "tokenOfOwnerByIndex",
        inputs: [
            { name: "owner", type: "address", internalType: "address" },
            { name: "index", type: "uint256", internalType: "uint256" },
        ],
        outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "tokenURI",
        inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
        outputs: [{ name: "", type: "string", internalType: "string" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "totalSupply",
        inputs: [],
        outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "transferFrom",
        inputs: [
            { name: "from", type: "address", internalType: "address" },
            { name: "to", type: "address", internalType: "address" },
            { name: "tokenId", type: "uint256", internalType: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "uniswapV3MintCallback",
        inputs: [
            { name: "amount0Owed", type: "uint256", internalType: "uint256" },
            { name: "amount1Owed", type: "uint256", internalType: "uint256" },
            { name: "data", type: "bytes", internalType: "bytes" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "unwrapWETH9",
        inputs: [
            {
                name: "amountMinimum",
                type: "uint256",
                internalType: "uint256",
            },
            { name: "recipient", type: "address", internalType: "address" },
        ],
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "event",
        name: "Approval",
        inputs: [
            {
                name: "owner",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "approved",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "tokenId",
                type: "uint256",
                indexed: true,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "ApprovalForAll",
        inputs: [
            {
                name: "owner",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "operator",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "approved",
                type: "bool",
                indexed: false,
                internalType: "bool",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "Collect",
        inputs: [
            {
                name: "tokenId",
                type: "uint256",
                indexed: true,
                internalType: "uint256",
            },
            {
                name: "recipient",
                type: "address",
                indexed: false,
                internalType: "address",
            },
            {
                name: "amount0",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
            {
                name: "amount1",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "DecreaseLiquidity",
        inputs: [
            {
                name: "tokenId",
                type: "uint256",
                indexed: true,
                internalType: "uint256",
            },
            {
                name: "liquidity",
                type: "uint128",
                indexed: false,
                internalType: "uint128",
            },
            {
                name: "amount0",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
            {
                name: "amount1",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "IncreaseLiquidity",
        inputs: [
            {
                name: "tokenId",
                type: "uint256",
                indexed: true,
                internalType: "uint256",
            },
            {
                name: "liquidity",
                type: "uint128",
                indexed: false,
                internalType: "uint128",
            },
            {
                name: "amount0",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
            {
                name: "amount1",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "Transfer",
        inputs: [
            {
                name: "from",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "to",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "tokenId",
                type: "uint256",
                indexed: true,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    { type: "error", name: "T", inputs: [] },
] as const;

export const positionManager = "0xCF1e20C1063B8037A3D281D85Af00a915cC84025";

export const balanceOfNft = async (
    user: Address,
    publicClient: pubClient,
): Promise<bigint> => {
    return await publicClient.readContract({
        abi,
        address: positionManager,
        functionName: "balanceOf",
        args: [user],
    });
};

export const tokenOfOwnerByIndex = async (
    user: Address,
    index: bigint,
    publicClient: pubClient,
): Promise<bigint> => {
    return await publicClient.readContract({
        abi,
        address: positionManager,
        functionName: "tokenOfOwnerByIndex",
        args: [user, index],
    });
};

export const tokenIds = async (
    user: Address,
    publicClient: pubClient,
): Promise<bigint[]> => {
    let ids: bigint[] = [];
    const balance = await balanceOfNft(user, publicClient);
    if (balance === 0n) return ids;
    for (let i = 0n; i < balance; i++) {
        const id = await tokenOfOwnerByIndex(user, i, publicClient);
        ids.push(id);
    }
    return ids;
};

export type positionDataType = {
    tokenId: bigint;

    nonce: bigint;
    operator: Address;

    token0: Address;
    token1: Address;

    fee: number;

    tickLower: number;
    tickUpper: number;

    liquidity: bigint;

    feeGrowthInside0LastX128: bigint;
    feeGrowthInside1LastX128: bigint;

    tokensOwed0: bigint;
    tokensOwed1: bigint;

    amount0: bigint;
    amount1: bigint;

    inRange: boolean;
};

const Q96 = 2n ** 96n;

export const positionData = async (
    tokenId: bigint,
    publicClient: pubClient,
): Promise<positionDataType | null> => {
    try {
        const position = await publicClient.readContract({
            abi,
            address: positionManager,
            functionName: "positions",
            args: [tokenId],
        });

        const pool = await getPoolWithDirectCall(
            position[2],
            position[3],
            position[4],
            publicClient,
        );

        const [tickCurrent, sqrtPriceX96] = await Promise.all([
            readTickFromSlot0(pool, publicClient),
            readRawSqrtPriceX96(pool, publicClient),
        ]);

        const tickLower = position[5];
        const tickUpper = position[6];
        const liquidity = position[7];

        const inRange = tickCurrent >= tickLower && tickCurrent < tickUpper;

        // sqrt prices at the position boundaries
        const sqrtPriceAX96 = getSqrtRatioAtTick(tickLower);
        const sqrtPriceBX96 = getSqrtRatioAtTick(tickUpper);

        let amount0 = 0n;
        let amount1 = 0n;

        // Current price is below the range
        if (sqrtPriceX96 <= sqrtPriceAX96) {
            amount0 =
                (liquidity * (sqrtPriceBX96 - sqrtPriceAX96) * Q96) /
                (sqrtPriceAX96 * sqrtPriceBX96);

            amount1 = 0n;
        }
        // Current price is inside the range
        else if (sqrtPriceX96 < sqrtPriceBX96) {
            amount0 =
                (liquidity * (sqrtPriceBX96 - sqrtPriceX96) * Q96) /
                (sqrtPriceX96 * sqrtPriceBX96);

            amount1 = (liquidity * (sqrtPriceX96 - sqrtPriceAX96)) / Q96;
        }
        // Current price is above the range
        else {
            amount0 = 0n;
            amount1 = (liquidity * (sqrtPriceBX96 - sqrtPriceAX96)) / Q96;
        }

        // ==============================================
        // 💡 THE SMART WAY: Simulate Collect for Fees
        // ==============================================
        let tokensOwed0 = position[10];
        let tokensOwed1 = position[11];

        try {
            const owner = (await publicClient.readContract({
                abi,
                address: positionManager,
                functionName: "ownerOf",
                args: [tokenId],
            })) as Address;

            const MAX_UINT128 = 2n ** 128n - 1n;

            const { result } = await publicClient.simulateContract({
                abi,
                address: positionManager,
                functionName: "collect",
                args: [
                    {
                        tokenId,
                        recipient: owner,
                        amount0Max: MAX_UINT128,
                        amount1Max: MAX_UINT128,
                    },
                ],
                account: owner,
            });

            tokensOwed0 = result[0];
            tokensOwed1 = result[1];
        } catch (error) {
            console.warn(`Fee simulation skipped for token #${tokenId}`);
        }

        const positionInfo: positionDataType = {
            tokenId,
            nonce: position[0],
            operator: position[1],
            token0: position[2],
            token1: position[3],
            fee: position[4],
            tickLower,
            tickUpper,
            liquidity,
            feeGrowthInside0LastX128: position[8],
            feeGrowthInside1LastX128: position[9],
            tokensOwed0,
            tokensOwed1,
            amount0,
            amount1,
            inRange,
        };

        return positionInfo;
    } catch (e) {
        console.warn(`Failed to fetch position data for token #${tokenId}`, e);
        return null;
    }
};

export const positionsData = async (
    user: Address,
    publicClient: pubClient,
): Promise<positionDataType[]> => {
    let datas: positionDataType[] = [];
    const _tokenIds = await tokenIds(user, publicClient);
    if (_tokenIds.length === 0) return datas;
    for (const i of _tokenIds) {
        const position = await positionData(i, publicClient);
        if (position !== null) {
            datas.push(position);
        }
    }
    return datas;
};

export const positionSvg = async (
    tokenId: bigint,
    publicClient: pubClient,
): Promise<string | null> => {
    try {
        const uri = await publicClient.readContract({
            abi,
            address: positionManager,
            functionName: "tokenURI",
            args: [tokenId],
        });
        const json = atob(uri.split(",")[1]);
        const metadata = JSON.parse(json);
        return metadata.image;
    } catch (e) {
        console.warn(`Failed to fetch SVG for token #${tokenId}`);
        return null;
    }
};

export type nftSvg = string;

export const positionsSvg = async (
    user: Address,
    publicClient: pubClient,
): Promise<nftSvg[]> => {
    let images: nftSvg[] = [];
    const ids = await tokenIds(user, publicClient);
    if (ids.length === 0) return images;
    for (const i of ids) {
        const image = await positionSvg(i, publicClient);
        if (image !== null) {
            images.push(image);
        }
    }
    return images;
};
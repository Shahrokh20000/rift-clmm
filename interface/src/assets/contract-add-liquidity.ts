import {
    encodeFunctionData,
    type Address,
    maxUint128,
    parseEventLogs,
} from "viem";
import type { pubClient, sigClient } from "./clients";
import { sortAddresses } from "./math/sortAddress";
import { computePoolAddress } from "./math/poolAddress";

export const address: Address =
    "0xCF1e20C1063B8037A3D281D85Af00a915cC84025" as const;

export const WSIZE: Address =
    "0x2F3A25941AB75Ef97c97749343d7c71F09762e48" as const;
export const NATIVE_TOKEN = "0xnative";

export const abi = [
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

export const createPool = async (
    addressA: string,
    addressB: string,
    fee: number,
    sqrtPriceX96: bigint,
    signClient: sigClient,
    publicClient: pubClient,
): Promise<{ poolAddress: Address; txHash: `0x${string}` } | null> => {
    const actualA = addressA === NATIVE_TOKEN ? WSIZE : (addressA as Address);
    const actualB = addressB === NATIVE_TOKEN ? WSIZE : (addressB as Address);

    const [token0, token1] = sortAddresses(actualA, actualB);

    try {
        const hash = await signClient.writeContract({
            abi,
            address,
            functionName: "createAndInitializePoolIfNecessary",
            args: [token0, token1, fee, sqrtPriceX96],
            gas: 15000000n,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
            console.error("Pool creation reverted!", receipt);
            throw new Error("Transaction reverted");
        }
        return {
            poolAddress: computePoolAddress(token0, token1, fee),
            txHash: receipt.transactionHash,
        };
    } catch (e) {
        console.error("pool creation failed : ", e);
        throw e;
    }
};

type MintParams = {
    token0: Address;
    token1: Address;
    fee: number;
    tickLower: number;
    tickUpper: number;
    amount0Desired: bigint;
    amount1Desired: bigint;
    amount0Min: bigint;
    amount1Min: bigint;
    recipient: Address;
    deadline: bigint;
};

export const mint = async (
    tokenA: string,
    tokenB: string,
    fee: number,
    tickLower: number,
    tickUpper: number,
    amountADesired: bigint,
    amountBDesired: bigint,
    amountAMin: bigint,
    amountBMin: bigint,
    recipient: Address,
    deadline: bigint,
    publicClient: pubClient,
    signClient: sigClient,
): Promise<{ tokenId: bigint; txHash: `0x${string}` } | null> => {
    const isNativeA = tokenA === NATIVE_TOKEN;
    const isNativeB = tokenB === NATIVE_TOKEN;
    const actualTokenA = isNativeA ? WSIZE : (tokenA as Address);
    const actualTokenB = isNativeB ? WSIZE : (tokenB as Address);

    const nativeValue = isNativeA
        ? amountADesired
        : isNativeB
          ? amountBDesired
          : 0n;

    const [token0, token1] = sortAddresses(actualTokenA, actualTokenB);
    let amount0Desired, amount0Min, amount1Desired, amount1Min;

    if (actualTokenA.toLowerCase() === token0.toLowerCase()) {
        [amount0Desired, amount0Min, amount1Desired, amount1Min] = [
            amountADesired,
            amountAMin,
            amountBDesired,
            amountBMin,
        ];
    } else {
        [amount0Desired, amount0Min, amount1Desired, amount1Min] = [
            amountBDesired,
            amountBMin,
            amountADesired,
            amountAMin,
        ];
    }

    const params: MintParams = {
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        recipient,
        deadline,
    };

    try {
        let hash;

        if (nativeValue > 0n) {
            const mintData = encodeFunctionData({
                abi,
                functionName: "mint",
                args: [params],
            });
            const refundData = encodeFunctionData({
                abi,
                functionName: "refundETH",
            });

            hash = await signClient.writeContract({
                abi,
                address,
                functionName: "multicall",
                args: [[mintData, refundData]],
                value: nativeValue,
                gas: 5000000n,
            });
        } else {
            hash = await signClient.writeContract({
                abi,
                address,
                functionName: "mint",
                args: [params],
                gas: 3000000n,
            });
        }

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === "reverted") {
            console.error("Mint reverted!", receipt);
            throw new Error("Transaction reverted");
        }

        const logs = parseEventLogs({
            abi,
            logs: receipt.logs,
            eventName: "IncreaseLiquidity",
        });

        if (logs && logs.length > 0) {
            const realTokenId = logs[0].args.tokenId;
            return { tokenId: realTokenId, txHash: receipt.transactionHash };
        }

        console.warn(
            "Transaction succeeded, but 'IncreaseLiquidity' log not found!",
        );
        return null;
    } catch (e) {
        console.error("add liquidity failed : ", e);
        throw e;
    }
};

type IncreaseLiquidityParams = {
    tokenId: bigint;
    amount0Desired: bigint;
    amount1Desired: bigint;
    amount0Min: bigint;
    amount1Min: bigint;
    deadline: bigint;
};

export const increaseLiquidity = async (
    tokenId: bigint,
    amount0Desired: bigint,
    amount1Desired: bigint,
    amount0Min: bigint,
    amount1Min: bigint,
    deadline: bigint,
    publicClient: pubClient,
    signClient: sigClient,
    nativeValue: bigint = 0n, // 🚨 مقدار اختیاری برای پشتیبانی نیتیو
) => {
    const params: IncreaseLiquidityParams = {
        tokenId,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        deadline,
    };

    try {
        let hash;

        // 🚨 ارسال Multicall اگر توکن نیتیو درگیر است
        if (nativeValue > 0n) {
            const increaseData = encodeFunctionData({
                abi,
                functionName: "increaseLiquidity",
                args: [params],
            });
            const refundData = encodeFunctionData({
                abi,
                functionName: "refundETH",
            });

            hash = await signClient.writeContract({
                abi,
                address,
                functionName: "multicall",
                args: [[increaseData, refundData]],
                value: nativeValue,
                gas: 5000000n,
            });
        } else {
            hash = await signClient.writeContract({
                abi,
                address,
                functionName: "increaseLiquidity",
                args: [params],
                gas: 5000000n,
            });
        }

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === "reverted") {
            console.error("Increase Liquidity reverted!", receipt);
            throw new Error("Transaction reverted");
        }

        return receipt.transactionHash;
    } catch (e) {
        console.error("increase liquidity failed : ", e);
        throw e;
    }
};

type CollectParams = {
    tokenId: bigint;
    recipient: Address;
    amount0Max: bigint;
    amount1Max: bigint;
};

export const collectLiquidityRewards = async (
    tokenId: bigint,
    recipient: Address,
    amount0Max: bigint,
    amount1Max: bigint,
    publicClient: pubClient,
    signClient: sigClient,
): Promise<`0x${string}`> => {
    const params: CollectParams = {
        tokenId,
        recipient,
        amount0Max,
        amount1Max,
    };

    try {
        const hash = await signClient.writeContract({
            abi,
            address,
            functionName: "collect",
            args: [params],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
            console.error("Collect reverted!", receipt);
            throw new Error("Transaction reverted");
        }
        return receipt.transactionHash;
    } catch (e) {
        console.error("collect rewards failed : ", e);
        throw e;
    }
};

export const getPositionLiquidity = async (
    tokenId: bigint,
    publicClient: pubClient,
): Promise<bigint> => {
    try {
        const positionData = await publicClient.readContract({
            abi,
            address,
            functionName: "positions",
            args: [tokenId],
        });

        const totalLiquidity = positionData[7];
        return totalLiquidity;
    } catch (e) {
        console.error("Failed to fetch position data: ", e);
        return 0n;
    }
};

type DecreaseLiquidityParams = {
    tokenId: bigint;
    liquidity: bigint;
    amount0Min: bigint;
    amount1Min: bigint;
    deadline: bigint;
};

export const decreaseLiquidity = async (
    tokenId: bigint,
    liquidity: bigint,
    amount0Min: bigint,
    amount1Min: bigint,
    deadline: bigint,
    recipient: Address,
    publicClient: pubClient,
    signClient: sigClient,
) => {
    const _liquidity: bigint = await getPositionLiquidity(
        tokenId,
        publicClient,
    );
    const DecreaseParams: DecreaseLiquidityParams = {
        tokenId,
        liquidity,
        amount0Min,
        amount1Min,
        deadline,
    };

    const _CollectParams: CollectParams = {
        tokenId,
        recipient,
        amount0Max: maxUint128,
        amount1Max: maxUint128,
    };

    try {
        const decreaseData = encodeFunctionData({
            abi,
            functionName: "decreaseLiquidity",
            args: [DecreaseParams],
        });
        const collectData = encodeFunctionData({
            abi,
            functionName: "collect",
            args: [_CollectParams],
        });

        let hash;
        if (_liquidity === liquidity) {
            const burnData = encodeFunctionData({
                abi,
                functionName: "burn",
                args: [tokenId],
            });

            hash = await signClient.writeContract({
                abi,
                address,
                functionName: "multicall",
                args: [[decreaseData, collectData, burnData]],
            });
        } else {
            hash = await signClient.writeContract({
                abi,
                address,
                functionName: "multicall",
                args: [[decreaseData, collectData]],
            });
        }

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
            console.error("Decrease Liquidity reverted!", receipt);
            throw new Error("Transaction reverted");
        }
        return receipt.transactionHash;
    } catch (e) {
        console.error("remove liquidity failed : ", e);
        throw e;
    }
};

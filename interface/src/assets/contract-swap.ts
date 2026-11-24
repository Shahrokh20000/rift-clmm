import {
    encodeFunctionData,
    encodePacked,
    zeroAddress,
    maxUint256,
    type Address,
    type Hex,
} from "viem";
import type { pubClient, sigClient } from "./clients";
import { poolAvailableInFactory } from "./math/poolAddress";
import { showLog } from "./log";
import { signedReadContract } from "seismic-viem";

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
        name: "WETH9",
        inputs: [],
        outputs: [{ name: "", type: "address", internalType: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "exactInput",
        inputs: [
            {
                name: "params",
                type: "tuple",
                internalType: "struct ISwapRouter.ExactInputParams",
                components: [
                    { name: "path", type: "bytes", internalType: "bytes" },
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
                    {
                        name: "amountIn",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amountOutMinimum",
                        type: "uint256",
                        internalType: "uint256",
                    },
                ],
            },
        ],
        outputs: [
            { name: "amountOut", type: "uint256", internalType: "uint256" },
        ],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "exactInputSingle",
        inputs: [
            {
                name: "params",
                type: "tuple",
                internalType: "struct ISwapRouter.ExactInputSingleParams",
                components: [
                    {
                        name: "tokenIn",
                        type: "address",
                        internalType: "address",
                    },
                    {
                        name: "tokenOut",
                        type: "address",
                        internalType: "address",
                    },
                    { name: "fee", type: "uint24", internalType: "uint24" },
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
                    {
                        name: "amountIn",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amountOutMinimum",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "sqrtPriceLimitX96",
                        type: "uint160",
                        internalType: "uint160",
                    },
                ],
            },
        ],
        outputs: [
            { name: "amountOut", type: "uint256", internalType: "uint256" },
        ],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "exactOutput",
        inputs: [
            {
                name: "params",
                type: "tuple",
                internalType: "struct ISwapRouter.ExactOutputParams",
                components: [
                    { name: "path", type: "bytes", internalType: "bytes" },
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
                    {
                        name: "amountOut",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amountInMaximum",
                        type: "uint256",
                        internalType: "uint256",
                    },
                ],
            },
        ],
        outputs: [
            { name: "amountIn", type: "uint256", internalType: "uint256" },
        ],
        stateMutability: "payable",
    },
    {
        type: "function",
        name: "exactOutputSingle",
        inputs: [
            {
                name: "params",
                type: "tuple",
                internalType: "struct ISwapRouter.ExactOutputSingleParams",
                components: [
                    {
                        name: "tokenIn",
                        type: "address",
                        internalType: "address",
                    },
                    {
                        name: "tokenOut",
                        type: "address",
                        internalType: "address",
                    },
                    { name: "fee", type: "uint24", internalType: "uint24" },
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
                    {
                        name: "amountOut",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "amountInMaximum",
                        type: "uint256",
                        internalType: "uint256",
                    },
                    {
                        name: "sqrtPriceLimitX96",
                        type: "uint160",
                        internalType: "uint160",
                    },
                ],
            },
        ],
        outputs: [
            { name: "amountIn", type: "uint256", internalType: "uint256" },
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
        name: "multicall",
        inputs: [{ name: "data", type: "bytes[]", internalType: "bytes[]" }],
        outputs: [
            { name: "results", type: "bytes[]", internalType: "bytes[]" },
        ],
        stateMutability: "payable",
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
] as const;

const quoterV2Address: Address = '0xe5320b750Fced30B9c1eC9b30C06B3996092E032' as const;
const quoterV2Abi = [
    {
        type: "function",
        name: "quoteExactInput",
        inputs: [
            { name: "path", type: "bytes", internalType: "bytes" },
            { name: "amountIn", type: "uint256", internalType: "uint256" },
        ],
        outputs: [
            { name: "amountOut", type: "uint256", internalType: "uint256" },
            { name: "sqrtPriceX96AfterList", type: "uint160[]", internalType: "uint160[]" },
            { name: "initializedTicksCrossedList", type: "uint32[]", internalType: "uint32[]" },
            { name: "gasEstimate", type: "uint256", internalType: "uint256" },
        ],
        stateMutability: "view", 
    },
    {
        type: "function",
        name: "quoteExactInputSingle",
        inputs: [
            {
                name: "params",
                type: "tuple",
                internalType: "struct IQuoterV2.QuoteExactInputSingleParams",
                components: [
                    { name: "tokenIn", type: "address", internalType: "address" },
                    { name: "tokenOut", type: "address", internalType: "address" },
                    { name: "amountIn", type: "uint256", internalType: "uint256" },
                    { name: "fee", type: "uint24", internalType: "uint24" },
                    { name: "sqrtPriceLimitX96", type: "uint160", internalType: "uint160" },
                ],
            },
        ],
        outputs: [
            { name: "amountOut", type: "uint256", internalType: "uint256" },
            { name: "sqrtPriceX96After", type: "uint160", internalType: "uint160" },
            { name: "initializedTicksCrossed", type: "uint32", internalType: "uint32" },
            { name: "gasEstimate", type: "uint256", internalType: "uint256" },
        ],
        stateMutability: "view", 
    },
    {
        type: "function",
        name: "quoteExactOutput",
        inputs: [
            { name: "path", type: "bytes", internalType: "bytes" },
            { name: "amountOut", type: "uint256", internalType: "uint256" },
        ],
        outputs: [
            { name: "amountIn", type: "uint256", internalType: "uint256" },
            { name: "sqrtPriceX96AfterList", type: "uint160[]", internalType: "uint160[]" },
            { name: "initializedTicksCrossedList", type: "uint32[]", internalType: "uint32[]" },
            { name: "gasEstimate", type: "uint256", internalType: "uint256" },
        ],
        stateMutability: "view", 
    },
    {
        type: "function",
        name: "quoteExactOutputSingle",
        inputs: [
            {
                name: "params",
                type: "tuple",
                internalType: "struct IQuoterV2.QuoteExactOutputSingleParams",
                components: [
                    { name: "tokenIn", type: "address", internalType: "address" },
                    { name: "tokenOut", type: "address", internalType: "address" },
                    { name: "amount", type: "uint256", internalType: "uint256" },
                    { name: "fee", type: "uint24", internalType: "uint24" },
                    { name: "sqrtPriceLimitX96", type: "uint160", internalType: "uint160" },
                ],
            },
        ],
        outputs: [
            { name: "amountIn", type: "uint256", internalType: "uint256" },
            { name: "sqrtPriceX96After", type: "uint160", internalType: "uint160" },
            { name: "initializedTicksCrossed", type: "uint32", internalType: "uint32" },
            { name: "gasEstimate", type: "uint256", internalType: "uint256" },
        ],
        stateMutability: "view", 
    },
] as const;

export const NATIVE_TOKEN = "0xnative";
const address: Address = "0x15D499264016C01143eb84bce319f762cFe2AB19";
const sUSDC: Address = '0x790701048922e265105fd6a4467a2901c2201c43';
const WSIZE: Address = '0x2F3A25941AB75Ef97c97749343d7c71F09762e48';
const intermediaryTokens = [sUSDC, WSIZE];
const fees = [500, 3000, 10000];

type ExactInputSingle = {
    tokenIn: Address;
    tokenOut: Address;
    fee: number;
    recipient: Address;
    deadline: bigint;
    amountIn: bigint;
    amountOutMinimum: bigint;
    sqrtPriceLimitX96: bigint;
};

type ExactInputParams = {
    path: Hex;
    recipient: Address;
    deadline: bigint;
    amountIn: bigint;
    amountOutMinimum: bigint;
};

export const exactInputSingleSimulator = async (
    params: ExactInputSingle, 
    publicClient: pubClient,
    signClient: sigClient
): Promise<bigint> => {
    const quoteParams = {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        fee: params.fee,
        sqrtPriceLimitX96: 0n 
    };

    try {
        const result = await publicClient.readContract({
            abi: quoterV2Abi,
            address: quoterV2Address,
            functionName: "quoteExactInputSingle",
            args: [quoteParams],
        });
        const [amountOut] = result;
        return amountOut as bigint;
    } catch (e) {
        try {
            const result = await signedReadContract(signClient, {
                abi: quoterV2Abi,
                address: quoterV2Address,
                functionName: "quoteExactInputSingle",
                args: [quoteParams],
            });
            const [amountOut] = result as any;
            return amountOut as bigint;
        } catch (fallbackError) {
            console.error("QuoterV2 Single simulation failed: ", fallbackError);
            return 0n; 
        }
    }
};

export const exactInputMultipeSimulator = async (
    params: ExactInputParams, 
    publicClient: pubClient,
    signClient: sigClient
): Promise<bigint> => {
    try {
        const result = await publicClient.readContract({
            abi: quoterV2Abi,
            address: quoterV2Address,
            functionName: "quoteExactInput",
            args: [params.path, params.amountIn],
        });
        const [amountOut] = result;
        return amountOut as bigint;
    } catch (e) {
        try {
            const result = await signedReadContract(signClient, {
                abi: quoterV2Abi,
                address: quoterV2Address,
                functionName: "quoteExactInput",
                args: [params.path, params.amountIn],
            });
            const [amountOut] = result as any;
            return amountOut as bigint;
        } catch (fallbackError) {
            console.error("QuoterV2 Multi-hop simulation failed: ", fallbackError);
            return 0n;
        }
    }
};

export const exactInput = async (
    tokenIn: string,
    tokenOut: string,
    fee: number,
    recipient: Address,
    deadline: bigint,
    amountIn: bigint,
    amountOutMinimum: bigint,
    sqrtPriceLimitX96: bigint,
    publicClient: pubClient,
    signClient: sigClient,
): Promise<`0x${string}`> => {
    const isNativeIn = tokenIn === NATIVE_TOKEN;
    const isNativeOut = tokenOut === NATIVE_TOKEN;
    const actualIn = isNativeIn ? WSIZE : (tokenIn as Address);
    const actualOut = isNativeOut ? WSIZE : (tokenOut as Address);
    const nativeValue = isNativeIn ? amountIn : 0n;

    const swapRecipient = isNativeOut ? zeroAddress : recipient;

    try {
        const directFeesToCheck = [fee, ...fees.filter((f) => f !== fee)];
        let matchedDirectFee: number | null = null;
        for (const f of directFeesToCheck) {
            if (await poolAvailableInFactory(actualIn, actualOut, f, publicClient)) {
                matchedDirectFee = f;
                break;
            }
        }

        if (matchedDirectFee !== null) {
            const params: ExactInputSingle = {
                tokenIn: actualIn,
                tokenOut: actualOut,
                fee: matchedDirectFee,
                recipient: swapRecipient,
                deadline,
                amountIn,
                amountOutMinimum: 0n,
                sqrtPriceLimitX96,
            };

            const expectedAmountOut = await exactInputSingleSimulator(params, publicClient, signClient);
            if (expectedAmountOut < amountOutMinimum) {
                showLog("Slippage is too high based on simulation!", "error");
                throw new Error("Slippage too high!");
            }
            params.amountOutMinimum = amountOutMinimum;

            let hash;
            if (isNativeOut) {
                const swapData = encodeFunctionData({ abi, functionName: "exactInputSingle", args: [params] });
                const unwrapData = encodeFunctionData({ abi, functionName: "unwrapWETH9", args: [amountOutMinimum, recipient] });
                hash = await signClient.writeContract({
                    abi, address, functionName: "multicall", args: [[swapData, unwrapData] as Hex[]], value: nativeValue, gas: 1500000n
                });
            } else {
                hash = await signClient.writeContract({
                    abi, address, functionName: "exactInputSingle", args: [params], value: nativeValue, gas: 1000000n
                });
            }

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'reverted') {
                showLog("Transaction reverted by the network.", "error");
                throw new Error("Transaction reverted");
            }
            return receipt.transactionHash;
        } else {
            showLog("Searching for Multi-hop path...", "info");

            let bestIntermediary: Address | null = null;
            let fee1 = 0;
            let fee2 = 0;

            for (const intermediary of intermediaryTokens) {
                if (
                    intermediary.toLowerCase() === actualIn.toLowerCase() ||
                    intermediary.toLowerCase() === actualOut.toLowerCase()
                ) {
                    continue;
                }
                let foundLeg1 = false;
                let foundLeg2 = false;
                for (const f of fees) {
                    if (await poolAvailableInFactory(actualIn, intermediary, f, publicClient)) { fee1 = f; foundLeg1 = true; break; }
                }
                for (const f of fees) {
                    if (await poolAvailableInFactory(intermediary, actualOut, f, publicClient)) { fee2 = f; foundLeg2 = true; break; }
                }
                if (foundLeg1 && foundLeg2) { bestIntermediary = intermediary; break; }
            }

            if (!bestIntermediary) {
                showLog("No valid multi-hop path found!", "error");
                throw new Error("No valid multi-hop path found!");
            }

            const encodedPath: Hex = encodePacked(
                ["address", "uint24", "address", "uint24", "address"],
                [actualIn, fee1, bestIntermediary, fee2, actualOut],
            );

            const params: ExactInputParams = {
                path: encodedPath, recipient: swapRecipient, deadline, amountIn, amountOutMinimum: 0n,
            };

            const expectedAmountOut = await exactInputMultipeSimulator(params, publicClient, signClient);
            if (expectedAmountOut < amountOutMinimum) {
                showLog("Slippage is too high based on simulation!", "error");
                throw new Error("Slippage too high!");
            }

            params.amountOutMinimum = amountOutMinimum;

            let hash;
            if (isNativeOut) {
                const swapData = encodeFunctionData({ abi, functionName: "exactInput", args: [params] });
                const unwrapData = encodeFunctionData({ abi, functionName: "unwrapWETH9", args: [amountOutMinimum, recipient] });
                hash = await signClient.writeContract({
                    abi, address, functionName: "multicall", args: [[swapData, unwrapData] as Hex[]], value: nativeValue, gas: 2000000n
                });
            } else {
                hash = await signClient.writeContract({
                    abi, address, functionName: "exactInput", args: [params], value: nativeValue, gas: 1500000n
                });
            }

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'reverted') {
                showLog("Transaction reverted by the network.", "error");
                throw new Error("Transaction reverted");
            }
            return receipt.transactionHash;
        }
    } catch (e) {
        console.error("Swap Error:", e);
        throw e;
    }
};

type ExactOutputSingle = {
    tokenIn: Address;
    tokenOut: Address;
    fee: number;
    recipient: Address;
    deadline: bigint;
    amountOut: bigint;
    amountInMaximum: bigint;
    sqrtPriceLimitX96: bigint;
};

type ExactOutputParams = {
    path: Hex;
    recipient: Address;
    deadline: bigint;
    amountOut: bigint;
    amountInMaximum: bigint;
};

export const exactOutputSingleSimulator = async (
    params: ExactOutputSingle,
    publicClient: pubClient,
    signClient: sigClient
): Promise<bigint> => {
    const quoteParams = {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amount: params.amountOut, 
        fee: params.fee,
        sqrtPriceLimitX96: params.sqrtPriceLimitX96 
    };

    try {
        const result = await publicClient.readContract({
            abi: quoterV2Abi,
            address: quoterV2Address, 
            functionName: "quoteExactOutputSingle",
            args: [quoteParams],
        });
        const [amountIn] = result as any;
        return amountIn as bigint;
    } catch (e) {
        try {
            const result = await signedReadContract(signClient, {
                abi: quoterV2Abi,
                address: quoterV2Address, 
                functionName: "quoteExactOutputSingle",
                args: [quoteParams],
            });
            const [amountIn] = result as any;
            return amountIn as bigint;
        } catch (fallbackError) {
            console.error("QuoterV2 ExactOutput Single simulation failed: ", fallbackError);
            return 0n;
        }
    }
};

export const exactOutputMultipleSimulator = async (
    params: ExactOutputParams, 
    publicClient: pubClient,
    signClient: sigClient
): Promise<bigint> => {
    try {
        const result = await publicClient.readContract({
            abi: quoterV2Abi,
            address: quoterV2Address,
            functionName: "quoteExactOutput",
            args: [params.path, params.amountOut],
        });
        const [amountIn] = result as any;
        return amountIn as bigint;
    } catch (e) {
        try {
            const result = await signedReadContract(signClient, {
                abi: quoterV2Abi,
                address: quoterV2Address,
                functionName: "quoteExactOutput",
                args: [params.path, params.amountOut],
            });
            const [amountIn] = result as any;
            return amountIn as bigint;
        } catch (fallbackError) {
            console.error("QuoterV2 ExactOutput Multi-hop simulation failed: ", fallbackError);
            return 0n;
        }
    }
};

export const exactOutput = async (
    tokenIn: string,
    tokenOut: string,
    fee: number,
    recipient: Address,
    deadline: bigint,
    amountOut: bigint,
    amountInMaximum: bigint,
    sqrtPriceLimitX96: bigint,
    publicClient: pubClient,
    signClient: sigClient
): Promise<`0x${string}`> => {
    const isNativeIn = tokenIn === NATIVE_TOKEN;
    const isNativeOut = tokenOut === NATIVE_TOKEN;
    const actualIn = isNativeIn ? WSIZE : (tokenIn as Address);
    const actualOut = isNativeOut ? WSIZE : (tokenOut as Address);

    const nativeValue = isNativeIn ? amountInMaximum : 0n;
    const swapRecipient = isNativeOut ? zeroAddress : recipient;

    try {
        const directFeesToCheck = [fee, ...fees.filter((f) => f !== fee)];
        let matchedDirectFee: number | null = null;
        for (const f of directFeesToCheck) {
            if (await poolAvailableInFactory(actualIn, actualOut, f, publicClient)) {
                matchedDirectFee = f;
                break;
            }
        }

        if (matchedDirectFee !== null) {
            const params: ExactOutputSingle = {
                tokenIn: actualIn, tokenOut: actualOut, fee: matchedDirectFee,
                recipient: swapRecipient, deadline, amountOut,
                amountInMaximum: maxUint256, sqrtPriceLimitX96,
            };

            const expectedAmountIn = await exactOutputSingleSimulator(params, publicClient, signClient);

            if (expectedAmountIn === 0n || expectedAmountIn > amountInMaximum) {
                showLog("Slippage too high or simulation failed!", "error");
                throw new Error("Slippage too high or simulation failed!");
            }

            params.amountInMaximum = amountInMaximum;

            let hash;
            const calls: Hex[] = [];
            calls.push(encodeFunctionData({ abi, functionName: "exactOutputSingle", args: [params] }));

            if (isNativeOut) calls.push(encodeFunctionData({ abi, functionName: "unwrapWETH9", args: [amountOut, recipient] }));
            if (isNativeIn) calls.push(encodeFunctionData({ abi, functionName: "refundETH", args: [] }));

            if (calls.length > 1) {
                hash = await signClient.writeContract({
                    abi, address, functionName: "multicall", args: [calls], value: nativeValue, gas: 1500000n
                });
            } else {
                hash = await signClient.writeContract({
                    abi, address, functionName: "exactOutputSingle", args: [params], value: nativeValue, gas: 1000000n
                });
            }

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'reverted') {
                showLog("Transaction reverted by the network.", "error");
                throw new Error("Transaction reverted");
            }
            return receipt.transactionHash;

        } else {
            showLog("Searching for Multi-hop path...", "info");

            let bestIntermediary: Address | null = null;
            let fee1: number = 0; let fee2: number = 0;

            for (const intermediary of intermediaryTokens) {
                if (
                    intermediary.toLowerCase() === actualIn.toLowerCase() ||
                    intermediary.toLowerCase() === actualOut.toLowerCase()
                ) {
                    continue;
                }
                let foundLeg1 = false; let foundLeg2 = false;
                for (const f of fees) {
                    if (await poolAvailableInFactory(actualIn, intermediary, f, publicClient)) { fee1 = f; foundLeg1 = true; break; }
                }
                for (const f of fees) {
                    if (await poolAvailableInFactory(intermediary, actualOut, f, publicClient)) { fee2 = f; foundLeg2 = true; break; }
                }
                if (foundLeg1 && foundLeg2) { bestIntermediary = intermediary; break; }
            }

            if (!bestIntermediary) {
                showLog("No valid multi-hop path found!", "error");
                throw new Error("No valid multi-hop path found!");
            }

            const encodedPath: Hex = encodePacked(
                ["address", "uint24", "address", "uint24", "address"],
                [actualOut, fee2, bestIntermediary, fee1, actualIn],
            );

            const params: ExactOutputParams = {
                path: encodedPath, recipient: swapRecipient, deadline, amountOut, amountInMaximum: maxUint256,
            };

            const expectedAmountIn = await exactOutputMultipleSimulator(params, publicClient, signClient);
            if (expectedAmountIn === 0n || expectedAmountIn > amountInMaximum) {
                showLog("Slippage too high or simulation failed!", "error");
                throw new Error("Slippage too high or simulation failed!");
            }

            params.amountInMaximum = amountInMaximum;

            let hash;
            const calls: Hex[] = [];
            calls.push(encodeFunctionData({ abi, functionName: "exactOutput", args: [params] }));

            if (isNativeOut) calls.push(encodeFunctionData({ abi, functionName: "unwrapWETH9", args: [amountOut, recipient] }));
            if (isNativeIn) calls.push(encodeFunctionData({ abi, functionName: "refundETH", args: [] }));

            if (calls.length > 1) {
                hash = await signClient.writeContract({
                    abi, address, functionName: "multicall", args: [calls], value: nativeValue, gas: 2000000n
                });
            } else {
                hash = await signClient.writeContract({
                    abi, address, functionName: "exactOutput", args: [params], value: nativeValue, gas: 1500000n
                });
            }

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'reverted') {
                showLog("Transaction reverted by the network.", "error");
                throw new Error("Transaction reverted");
            }
            return receipt.transactionHash;
        }
    } catch (e) {
        console.error("Swap Error:", e);
        throw e;
    }
};

// ==========================================
//                 Auto-Quoting
// ==========================================

export type QuoteResult = {
    amount: bigint;
    feeUsed: number;
    routeLabel: string;
    isMultiHop: boolean;
    error?: boolean;
};

const tokenLabel = (addr: Address): string => {
    if (addr.toLowerCase() === sUSDC.toLowerCase()) return "sUSDC";
    if (addr.toLowerCase() === WSIZE.toLowerCase()) return "WSIZE";
    return `${addr.slice(0, 6)}...`;
};

export const getBestQuoteForInput = async (
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    defaultFee: number,
    publicClient: pubClient,
    signClient: sigClient
): Promise<QuoteResult> => {
    const actualIn = tokenIn === NATIVE_TOKEN ? WSIZE : (tokenIn as Address);
    const actualOut = tokenOut === NATIVE_TOKEN ? WSIZE : (tokenOut as Address);

    try {
        const directFeesToCheck = [defaultFee, ...fees.filter((f) => f !== defaultFee)];
        for (const f of directFeesToCheck) {
            if (await poolAvailableInFactory(actualIn, actualOut, f, publicClient)) {
                const params: ExactInputSingle = {
                    tokenIn: actualIn, tokenOut: actualOut, fee: f, amountIn,
                    amountOutMinimum: 0n, sqrtPriceLimitX96: 0n,
                    recipient: zeroAddress, deadline: 0n
                };
                const amount = await exactInputSingleSimulator(params, publicClient, signClient);
                return {
                    amount,
                    feeUsed: f,
                    routeLabel: `Direct V3 • ${f / 10000}%`,
                    isMultiHop: false,
                };
            }
        }

        for (const intermediary of intermediaryTokens) {
            if (
                intermediary.toLowerCase() === actualIn.toLowerCase() ||
                intermediary.toLowerCase() === actualOut.toLowerCase()
            ) {
                continue;
            }
            let fee1 = 0; let fee2 = 0;
            let foundLeg1 = false; let foundLeg2 = false;
            for (const f of fees) {
                if (await poolAvailableInFactory(actualIn, intermediary, f, publicClient)) {
                    fee1 = f; foundLeg1 = true; break;
                }
            }
            for (const f of fees) {
                if (await poolAvailableInFactory(intermediary, actualOut, f, publicClient)) {
                    fee2 = f; foundLeg2 = true; break;
                }
            }
            if (foundLeg1 && foundLeg2) {
                const encodedPath: Hex = encodePacked(
                    ["address", "uint24", "address", "uint24", "address"],
                    [actualIn, fee1, intermediary, fee2, actualOut]
                );
                const params: ExactInputParams = {
                    path: encodedPath, amountIn, amountOutMinimum: 0n,
                    recipient: zeroAddress, deadline: 0n
                };
                const amount = await exactInputMultipeSimulator(params, publicClient, signClient);
                return {
                    amount,
                    feeUsed: fee1,
                    routeLabel: `Multi-hop via ${tokenLabel(intermediary)}`,
                    isMultiHop: true,
                };
            }
        }

        return { amount: 0n, feeUsed: defaultFee, routeLabel: "No route", isMultiHop: false };
    } catch (e) {
        return { amount: 0n, feeUsed: defaultFee, routeLabel: "RPC Error", isMultiHop: false, error: true };
    }
};

export const getBestQuoteForOutput = async (
    tokenIn: string,
    tokenOut: string,
    amountOut: bigint,
    defaultFee: number,
    publicClient: pubClient,
    signClient: sigClient
): Promise<QuoteResult> => {
    const actualIn = tokenIn === NATIVE_TOKEN ? WSIZE : (tokenIn as Address);
    const actualOut = tokenOut === NATIVE_TOKEN ? WSIZE : (tokenOut as Address);

    try {
        const directFeesToCheck = [defaultFee, ...fees.filter((f) => f !== defaultFee)];
        for (const f of directFeesToCheck) {
            if (await poolAvailableInFactory(actualIn, actualOut, f, publicClient)) {
                const params: ExactOutputSingle = {
                    tokenIn: actualIn, tokenOut: actualOut, fee: f, amountOut,
                    amountInMaximum: maxUint256, sqrtPriceLimitX96: 0n,
                    recipient: zeroAddress, deadline: 0n
                };
                const amount = await exactOutputSingleSimulator(params, publicClient, signClient);
                return {
                    amount,
                    feeUsed: f,
                    routeLabel: `Direct V3 • ${f / 10000}%`,
                    isMultiHop: false,
                };
            }
        }

        for (const intermediary of intermediaryTokens) {
            if (
                intermediary.toLowerCase() === actualIn.toLowerCase() ||
                intermediary.toLowerCase() === actualOut.toLowerCase()
            ) {
                continue;
            }
            let fee1 = 0; let fee2 = 0;
            let foundLeg1 = false; let foundLeg2 = false;
            for (const f of fees) {
                if (await poolAvailableInFactory(actualIn, intermediary, f, publicClient)) {
                    fee1 = f; foundLeg1 = true; break;
                }
            }
            for (const f of fees) {
                if (await poolAvailableInFactory(intermediary, actualOut, f, publicClient)) {
                    fee2 = f; foundLeg2 = true; break;
                }
            }
            if (foundLeg1 && foundLeg2) {
                const encodedPath: Hex = encodePacked(
                    ["address", "uint24", "address", "uint24", "address"],
                    [actualOut, fee2, intermediary, fee1, actualIn]
                );
                const params: ExactOutputParams = {
                    path: encodedPath, amountOut, amountInMaximum: maxUint256,
                    recipient: zeroAddress, deadline: 0n
                };
                const amount = await exactOutputMultipleSimulator(params, publicClient, signClient);
                return {
                    amount,
                    feeUsed: fee1,
                    routeLabel: `Multi-hop via ${tokenLabel(intermediary)}`,
                    isMultiHop: true,
                };
            }
        }

        return { amount: 0n, feeUsed: defaultFee, routeLabel: "No route", isMultiHop: false };
    } catch (e) {
        return { amount: 0n, feeUsed: defaultFee, routeLabel: "RPC Error", isMultiHop: false, error: true };
    }
};

export const getQuoteForInput = async (
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    defaultFee: number,
    publicClient: pubClient,
    signClient: sigClient
): Promise<bigint> => {
    const res = await getBestQuoteForInput(tokenIn, tokenOut, amountIn, defaultFee, publicClient, signClient);
    return res.amount;
};

export const getQuoteForOutput = async (
    tokenIn: string,
    tokenOut: string,
    amountOut: bigint,
    defaultFee: number,
    publicClient: pubClient,
    signClient: sigClient
): Promise<bigint> => {
    const res = await getBestQuoteForOutput(tokenIn, tokenOut, amountOut, defaultFee, publicClient, signClient);
    return res.amount;
};
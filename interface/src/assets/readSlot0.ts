import type { Address } from "viem";
import type { pubClient } from "./clients";

export const slot0Abi = [
    {
        inputs: [],
        name: "slot0",
        outputs: [
            { internalType: "uint160", name: "sqrtPriceX96", type: "uint160" },
            { internalType: "int24", name: "tick", type: "int24" },
            {
                internalType: "uint16",
                name: "observationIndex",
                type: "uint16",
            },
            {
                internalType: "uint16",
                name: "observationCardinality",
                type: "uint16",
            },
            {
                internalType: "uint16",
                name: "observationCardinalityNext",
                type: "uint16",
            },
            { internalType: "uint8", name: "feeProtocol", type: "uint8" },
            { internalType: "bool", name: "unlocked", type: "bool" },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const;

const Q192 = 2n ** 192n;
const PRECISION = 10n ** 18n;

export const readPriceFromSlot0 = async (
    pair: Address,
    publicClient: pubClient,
    decimals0: number,
    decimals1: number
): Promise<bigint> => {

    const [sqrtPriceX96] = await publicClient.readContract({
        abi: slot0Abi,
        address: pair,
        functionName: "slot0",
    });


    // price(token1/token0) with 18 decimals precision
    let price = (
        sqrtPriceX96 *
        sqrtPriceX96 *
        PRECISION
    ) / Q192;


    // adjust token decimals
    if (decimals0 > decimals1) {
        price = price * (10n ** BigInt(decimals0 - decimals1));
    } 
    else if (decimals1 > decimals0) {
        price = price / (10n ** BigInt(decimals1 - decimals0));
    }


    return price;
};

export const readTickFromSlot0 = async (
    pair: Address,
    publicClient: pubClient
): Promise<number> => {

    const [, tick,,,,,] = await publicClient.readContract({
        abi: slot0Abi,
        address: pair,
        functionName: "slot0",
    });

    return tick;
};

export const readRawSqrtPriceX96 = async(pair:Address,publicClient:pubClient):Promise<bigint> =>{
    const [sqrtPriceX96] = await publicClient.readContract({
        abi:slot0Abi,
        address:pair,
        functionName:'slot0'
    });
    return sqrtPriceX96;
}
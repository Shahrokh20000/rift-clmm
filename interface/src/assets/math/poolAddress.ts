import {
    type Address,
    encodePacked,
    keccak256,
    getAddress,
    zeroAddress,
} from "viem";
import { sortAddresses } from "./sortAddress";
import type { pubClient } from "../clients";

const abi = [
    {
        type: "constructor",
        inputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "createPool",
        inputs: [
            {
                name: "tokenA",
                type: "address",
                internalType: "address",
            },
            {
                name: "tokenB",
                type: "address",
                internalType: "address",
            },
            { name: "fee", type: "uint24", internalType: "uint24" },
        ],
        outputs: [{ name: "pool", type: "address", internalType: "address" }],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "enableFeeAmount",
        inputs: [
            { name: "fee", type: "uint24", internalType: "uint24" },
            {
                name: "tickSpacing",
                type: "int24",
                internalType: "int24",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "feeAmountTickSpacing",
        inputs: [{ name: "", type: "uint24", internalType: "uint24" }],
        outputs: [{ name: "", type: "int24", internalType: "int24" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getPool",
        inputs: [
            { name: "", type: "address", internalType: "address" },
            { name: "", type: "address", internalType: "address" },
            { name: "", type: "uint24", internalType: "uint24" },
        ],
        outputs: [{ name: "", type: "address", internalType: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "owner",
        inputs: [],
        outputs: [{ name: "", type: "address", internalType: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "parameters",
        inputs: [],
        outputs: [
            {
                name: "factory",
                type: "address",
                internalType: "address",
            },
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
            {
                name: "tickSpacing",
                type: "int24",
                internalType: "int24",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "poolBytecodeHash",
        inputs: [],
        outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
        stateMutability: "pure",
    },
    {
        type: "function",
        name: "setOwner",
        inputs: [
            {
                name: "_owner",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "event",
        name: "FeeAmountEnabled",
        inputs: [
            {
                name: "fee",
                type: "uint24",
                indexed: true,
                internalType: "uint24",
            },
            {
                name: "tickSpacing",
                type: "int24",
                indexed: true,
                internalType: "int24",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "OwnerChanged",
        inputs: [
            {
                name: "oldOwner",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "newOwner",
                type: "address",
                indexed: true,
                internalType: "address",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "PoolCreated",
        inputs: [
            {
                name: "token0",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "token1",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "fee",
                type: "uint24",
                indexed: true,
                internalType: "uint24",
            },
            {
                name: "tickSpacing",
                type: "int24",
                indexed: false,
                internalType: "int24",
            },
            {
                name: "pool",
                type: "address",
                indexed: false,
                internalType: "address",
            },
        ],
        anonymous: false,
    },
] as const;

const POOL_INIT_CODE_HASH =
    "0x6fc98a0231a3c7eb950083a093dbfff2e4ee3d4f11142855c87b26fee365281a" as const;
const factory: Address = "0x95151b5D611dcD241b58cc5D0C86eBFDC7d88e76" as const;

export const computePoolAddress = (
    tokenA: Address,
    tokenB: Address,
    fee: number,
): Address => {
    const [token0, token1] = sortAddresses(tokenA, tokenB);

    const salt = keccak256(
        encodePacked(["address", "address", "uint24"], [token0, token1, fee]),
    );

    const hash = keccak256(
        encodePacked(
            ["bytes1", "address", "bytes32", "bytes32"],
            ["0xff", factory, salt, POOL_INIT_CODE_HASH],
        ),
    );

    return getAddress(`0x${hash.slice(-40)}`);
};

export const poolAvailableInFactory = async (
    tokenA: Address,
    tokenB: Address,
    fee: number,
    publicClient: pubClient,
): Promise<Boolean> => {
    const [token0, token1] = sortAddresses(tokenA, tokenB);

    const returnedAddressFromFactory: Address = await publicClient.readContract(
        {
            abi,
            address: factory,
            functionName: "getPool",
            args: [token0, token1, fee],
        },
    );
    if (returnedAddressFromFactory === zeroAddress) return false;
    else return true;
};

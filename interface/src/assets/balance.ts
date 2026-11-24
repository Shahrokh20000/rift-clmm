import { erc20Abi, type Address } from "viem";
import type { pubClient, sigClient } from "./clients";
import { showLog } from "./log";
import { signedReadContract } from "seismic-viem";

const src20Abi = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

export const balanceOf = async (
    address: Address,
    user: Address,
    publicClient: pubClient,
    signClient: sigClient,
): Promise<bigint> => {
    try {
        return (await publicClient.readContract({
            abi: erc20Abi,
            address,
            functionName: "balanceOf",
            args: [user],
        })) as bigint;
    } catch (e) {
        try {
            const bal =  await signedReadContract(signClient, {
                abi: src20Abi,
                address,
                functionName: "balanceOf",
                args: [user],
            }) as bigint;

            return bal;
        } catch (fallbackError) {
            console.log("SRC20 balanceOf failed:", fallbackError);
            showLog("Failed to fetch Shielded Balance", "error");
            return 0n;
        }
    }
};

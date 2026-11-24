import { erc20Abi, type Address } from "viem";
import type { pubClient, sigClient } from "./clients";
import { showLog } from "./log";
import { signedReadContract } from "seismic-viem";

const src20ApproveAbi = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'suint256' } 
        ],
        outputs: [{ name: '', type: 'bool' }]
    }
] as const;

export const approve = async (
    token: Address,
    to: Address,
    amount: bigint,
    signClient: sigClient,
    publicClient: pubClient
): Promise<boolean> => {
    try {
        const hash = await signClient.writeContract({
            abi: erc20Abi,
            address: token,
            functionName: 'approve',
            args: [to, amount],
            gas: 1000000n
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'reverted') {
            throw new Error("Standard ERC20 approve reverted"); 
        }

        const symbol = await publicClient.readContract({
            abi: erc20Abi,
            address: token,
            functionName: 'symbol',
        }).catch(() => "Token"); 

        showLog(`Approved ${symbol}`, "success");
        console.log('Approved successfully (ERC20): ', receipt);
        return true;

    } catch (e: any) {
        console.log('Standard approve failed. Attempting SRC20 Fallback...', e.message);

        try {
            const fallbackHash = await signClient.writeContract({
                abi: src20ApproveAbi,
                address: token,
                functionName: 'approve',
                args: [to, amount],
                gas: 1000000n
            });

            const fallbackReceipt = await publicClient.waitForTransactionReceipt({ hash: fallbackHash });

            if (fallbackReceipt.status === 'reverted') {
                console.log('SRC20 Approve transaction reverted on-chain!');
                return false;
            }

            const symbol = await publicClient.readContract({
                abi: erc20Abi,
                address: token,
                functionName: 'symbol',
            }).catch(() => "Shielded Token");

            showLog(`Approved ${symbol} (SRC20)`, "success");
            console.log('Approved successfully (SRC20): ', fallbackReceipt);
            return true;

        } catch (fallbackError) {
            console.log('Both ERC20 and SRC20 Approve execution failed: ', fallbackError);
            return false;
        }
    }
}

export const checkAllowance = async (
    token: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`,
    pubClient: pubClient,
    sigClient: sigClient,
): Promise<bigint> => {
    try {
        return (await pubClient.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "allowance",
            args: [owner, spender],
        })) as bigint;
    } catch (e) {
        try {
            const result = await signedReadContract(sigClient, {
                address: token,
                abi: erc20Abi,
                functionName: "allowance",
                args: [owner, spender],
            });
            return result as bigint;
        } catch (fallbackError) {
            console.error("Failed to read allowance:", fallbackError);
            return 0n;
        }
    }
};
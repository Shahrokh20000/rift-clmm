import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createWalletClient, http, parseUnits, publicActions } from "npm:viem";
import { privateKeyToAccount } from "npm:viem/accounts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const TOKENS: Record<
    string,
    { name: string; decimals: number; amount: string }
> = {
    "0x790701048922e265105fd6a4467a2901c2201c43": {
        name: "sUSDC",
        decimals: 6,
        amount: "0.1",
    },
    "0x63130c77500cebf7f6b9f01545fc4f3925dfe007": {
        name: "RFT",
        decimals: 18,
        amount: "10",
    },
    "0xc59fb7a8d9bf1c5863d000724c420f701b349a92": {
        name: "GMIC",
        decimals: 18,
        amount: "10",
    },
};

const erc20Abi = [
    {
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
] as const;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing Authorization header");

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        const supabase = createClient(
            supabaseUrl,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? supabaseAnonKey,
        );

        const token = authHeader.replace("Bearer ", "");
        const {
            data: { user },
            error: authError,
        } = await createClient(supabaseUrl, supabaseAnonKey).auth.getUser(
            token,
        );

        if (authError || !user)
            throw new Error("Invalid or expired Discord session");

        const discordId = user.identities?.[0]?.id || user.id;
        const { walletAddress, tokenCa } = await req.json();
        const tokenInfo = TOKENS[tokenCa.toLowerCase()];

        if (!tokenInfo) throw new Error("Invalid token address requested");

        const { data: lastClaim, error: fetchError } = await supabase
            .from("faucet_claims")
            .select("last_claim_at")
            .eq("token_ca", tokenCa.toLowerCase())
            .or(`discord_id.eq.${discordId},wallet_address.eq.${walletAddress}`)
            .order("last_claim_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchError)
            throw new Error(`DB Fetch Error: ${fetchError.message}`);

        if (lastClaim && lastClaim.last_claim_at) {
            const lastClaimTime = new Date(lastClaim.last_claim_at).getTime();
            const now = new Date().getTime();
            const hoursSinceLastClaim =
                (now - lastClaimTime) / (1000 * 60 * 60);

            if (hoursSinceLastClaim < 24) {
                const hoursLeft = (24 - hoursSinceLastClaim).toFixed(1);
                throw new Error(
                    `You have already claimed ${tokenInfo.name}. Try again in ${hoursLeft} hours.`,
                );
            }
        }

        const RPC_URL = "https://testnet-3.seismictest.net/rpc";
        const privateKey = Deno.env.get("FAUCET_PRIVATE_KEY") as `0x${string}`;
        if (!privateKey)
            throw new Error("Faucet private key is not configured on server");

        const account = privateKeyToAccount(privateKey);
        const client = createWalletClient({
            account,
            transport: http(RPC_URL),
        }).extend(publicActions);

        const amountToTransfer = parseUnits(
            tokenInfo.amount,
            tokenInfo.decimals,
        );

        // Explicit gas limit to avoid RPC gas-estimation mismatch on Seismic Testnet
        const txHash = await client.writeContract({
            address: tokenCa as `0x${string}`,
            abi: erc20Abi,
            functionName: "transfer",
            args: [walletAddress as `0x${string}`, amountToTransfer],
            gas: 100000n,
        });

        const { error: insertError } = await supabase
            .from("faucet_claims")
            .insert([
                {
                    discord_id: String(discordId),
                    wallet_address: String(walletAddress),
                    token_ca: tokenCa.toLowerCase(),
                    last_claim_at: new Date().toISOString(),
                },
            ]);

        if (insertError)
            throw new Error(`DB Insert Error: ${insertError.message}`);

        return new Response(
            JSON.stringify({ success: true, txHash, token: tokenInfo.name }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

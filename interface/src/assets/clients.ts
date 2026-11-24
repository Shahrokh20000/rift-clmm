import {
    createShieldedWalletClient,
    createShieldedPublicClient,
    seismicTestnet,
} from "seismic-viem";
import type { customAccount } from "./account";
import { fallback, http, webSocket, type Transport } from "viem";

export const updatedSeismicTestnet = {
    ...seismicTestnet,
    rpcUrls: {
        ...seismicTestnet.rpcUrls,
        default: {
            http: [import.meta.env.VITE_SEISMIC_RPC_URL || "https://testnet-3.seismictest.net/rpc"],
        },
        public: {
            http: [import.meta.env.VITE_SEISMIC_RPC_URL || "https://testnet-3.seismictest.net/rpc"],
        },
    },
};

export const createSignitureClient = async (acc: customAccount) => {
    return await createShieldedWalletClient({
        chain: updatedSeismicTestnet,
        transport: fallback(
            updatedSeismicTestnet.rpcUrls.default.http.map((rpcUrl) =>
                http(rpcUrl, { timeout: 10_000, retryCount: 1 }),
            ),
            {
                rank: false,
                retryCount: 2,
                retryDelay: 800,
            },
        ) as Transport,
        account: acc,
    });
};

export const createPubClient = async () => {
    return await createShieldedPublicClient({
        chain: updatedSeismicTestnet,
        transport: fallback(
            updatedSeismicTestnet.rpcUrls.default.http.map((rpcUrl) =>
                http(rpcUrl, { timeout: 10_000, retryCount: 1 }),
            ),
            {
                rank: false,
                retryCount: 2,
                retryDelay: 800,
            },
        ) as Transport,
    });
};

export const createWsClient = async () => {
    return await createShieldedPublicClient({
        chain: updatedSeismicTestnet,
        transport: fallback(
            (seismicTestnet.rpcUrls.default.webSocket ?? []).map((rpcUrl) =>
                webSocket(rpcUrl, {keepAlive: true}),
            ),
            {
                retryCount: 5,
                retryDelay: 1250,
            },
        ) as Transport,
    });
};

export type sigClient = Awaited<ReturnType<typeof createSignitureClient>>;
export type pubClient = Awaited<ReturnType<typeof createPubClient>>;
export type socketClient = Awaited<ReturnType<typeof createWsClient>>;
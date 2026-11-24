// ==========================================
// main.ts
// ==========================================

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { supabase, supabaseUrl } from "./assets/supabase.ts";
import { approve, checkAllowance } from "./assets/Approve.ts";
import {
    erc20Abi,
    formatUnits,
    parseUnits,
    maxUint256,
    zeroAddress,
    maxUint128,
} from "viem";
import { showLog } from "./assets/log";
import {
    createPubClient,
    createSignitureClient,
    type pubClient,
    type sigClient,
} from "./assets/clients.ts";
import { type customAccount, getAcc } from "./assets/account.ts";
import {
    exactInput,
    exactOutput,
    getBestQuoteForInput,
    getBestQuoteForOutput,
    type QuoteResult,
} from "./assets/contract-swap.ts";
import { balanceOf } from "./assets/balance.ts";
import { sortAddresses } from "./assets/math/sortAddress.ts";
import {
    getLiquidityForAmount0,
    getLiquidityForAmount1,
    getAmount0ForLiquidity,
    getAmount1ForLiquidity,
} from "./assets/math/liquidityMath.ts";
import {
    collectLiquidityRewards,
    createPool,
    decreaseLiquidity,
    increaseLiquidity,
    mint,
} from "./assets/contract-add-liquidity.ts";
import { readRawSqrtPriceX96 } from "./assets/readSlot0.ts";
import { getPoolWithDirectCall } from "./assets/getPoolDirectly.ts";
import {
    positionSvg,
    tokenIds,
    type positionDataType,
    positionData,
} from "./assets/my-positions.ts";
import { getSqrtRatioAtTick } from "./assets/math/TickMath.ts";
import { getDecimal } from "./assets/decimal.ts";

// ==========================================
// --- Helpers for Native & Core Tokens ---
// ==========================================
export const NATIVE_TOKEN = "0xnative";
export const WSIZE = "0x2F3A25941AB75Ef97c97749343d7c71F09762e48";
export const SUSDC_CA = "0x790701048922e265105fd6a4467a2901c2201c43";
export const RFT_CA = "0x63130c77500Cebf7f6B9f01545Fc4F3925dFe007";
export const GMIC_CA = "0xc59fb7a8D9bf1c5863D000724c420F701B349A92";

export const POPULAR_POOLS_MAP: Record<
    string,
    {
        symA: string;
        caA: string;
        symB: string;
        caB: string;
        fee: number;
    }
> = {
    "0x96906aa4928212b4665d298788f3c7ad7e550326": {
        symA: "RFT",
        caA: RFT_CA,
        symB: "GMIC",
        caB: GMIC_CA,
        fee: 3000,
    },
    "0x003f091ccdb1b39ad4dc29edaf606bef692cc482": {
        symA: "RFT",
        caA: RFT_CA,
        symB: "sUSDC",
        caB: SUSDC_CA,
        fee: 3000,
    },
    "0xaaafd1a44a3f2de131bfa2721138cd08ac55a01b": {
        symA: "GMIC",
        caA: GMIC_CA,
        symB: "sUSDC",
        caB: SUSDC_CA,
        fee: 3000,
    },
};

const getCleanTokenSymbol = (el: HTMLElement | null, fallback = ""): string => {
    if (!el) return fallback;
    const symbolSpan = el.querySelector(".token-symbol-text");
    if (symbolSpan && symbolSpan.textContent) {
        return symbolSpan.textContent.trim();
    }
    const raw = el.textContent?.trim() || "";
    if (!raw || raw.toLowerCase() === "select token") {
        return fallback;
    }
    return raw;
};

const getTokenBalance = async (
    token: string,
    user: `0x${string}`,
    pubClient: pubClient,
    sigClient: sigClient,
): Promise<bigint> => {
    if (token === NATIVE_TOKEN || token.toLowerCase() === WSIZE.toLowerCase()) {
        return await pubClient.getBalance({ address: user });
    }
    return await balanceOf(token as `0x${string}`, user, pubClient, sigClient);
};

const getTokenAllowance = async (
    token: string,
    owner: `0x${string}`,
    spender: `0x${string}`,
    pubClient: pubClient,
    sigClient: sigClient,
): Promise<bigint> => {
    if (token === NATIVE_TOKEN || token.toLowerCase() === WSIZE.toLowerCase()) {
        return maxUint256; // Native token does not require allowance
    }
    return await checkAllowance(
        token as `0x${string}`,
        owner,
        spender,
        pubClient,
        sigClient,
    );
};

// ==========================================
// --- Bulletproof Math Engine ---
// ==========================================
const mathSqrt = (y: bigint): bigint => {
    if (y < 0n) throw new Error("Negative square root");
    if (y < 2n) return y;
    let z = y / 2n + 1n;
    let x = y;
    while (x > z) {
        x = z;
        z = (y / x + x) / 2n;
    }
    return x;
};

// Get valid tick spacing based on fee tier
const getTickSpacing = (fee: number) =>
    fee === 10000 ? 200 : fee === 3000 ? 60 : 10;
const MAX_TICK = 887272;

// Convert custom price to valid Uniswap V3 tick
const priceToTick = (
    priceStr: string,
    decA: number,
    decB: number,
    isTokenA0: boolean,
    fee: number,
): number => {
    const spacing = getTickSpacing(fee);
    const minValid = -Math.floor(MAX_TICK / spacing) * spacing;
    const maxValid = Math.floor(MAX_TICK / spacing) * spacing;
    if (!priceStr || priceStr === "0") return minValid;
    if (priceStr === "∞" || priceStr === "99999999999999999") return maxValid;

    const sqrt = getSqrtPriceFromUI(priceStr, decA, decB, isTokenA0);
    if (sqrt <= 0n) return minValid;
    const Q96 = 2n ** 96n;
    const sq = Number(sqrt) / Number(Q96);
    const pRaw = sq * sq;
    if (!Number.isFinite(pRaw) || pRaw <= 0) return minValid;
    const exactTick = Math.log(pRaw) / Math.log(1.0001);

    // Round to nearest valid tick spacing multiple and clamp to protocol bounds
    const rounded = Math.round(exactTick / spacing) * spacing;
    return Math.max(minValid, Math.min(maxValid, rounded));
};

const toSafeString = (numStr: string): string => {
    if (!numStr.includes("e") && !numStr.includes("E")) return numStr;
    const num = Number(numStr);
    if (!Number.isFinite(num)) return "0";
    return num.toFixed(18).replace(/\.?0+$/, "") || "0";
};

const safeParseUnits = (valueStr: string, decimals: number): bigint => {
    const normalized = toSafeString((valueStr || "").trim());
    if (!normalized || normalized === "." || Number(normalized) <= 0) return 0n;
    const [wholeRaw, fracRaw = ""] = normalized.split(".");
    const whole = wholeRaw.replace(/[^0-9]/g, "") || "0";
    const frac = fracRaw.replace(/[^0-9]/g, "").slice(0, decimals);
    const cleanStr = frac.length > 0 ? `${whole}.${frac}` : whole;
    return parseUnits(cleanStr, decimals);
};

// Convert UI display price string to SqrtPriceX96 for on-chain calls
const getSqrtPriceFromUI = (
    priceStr: string,
    decA: number,
    decB: number,
    isTokenA0: boolean,
): bigint => {
    if (
        !priceStr ||
        priceStr === "0" ||
        priceStr === "∞" ||
        priceStr === "99999999999999999" ||
        priceStr === "--"
    )
        return 0n;
    const num = Number(priceStr);
    if (!Number.isFinite(num) || num <= 0) return 0n;
    const amountB = safeParseUnits(priceStr, decB);
    if (amountB <= 0n) return 0n;
    const amountA = parseUnits("1", decA);
    const amount0 = isTokenA0 ? amountA : amountB;
    const amount1 = isTokenA0 ? amountB : amountA;
    if (amount0 <= 0n) return 0n;
    const Q192 = 2n ** 192n;
    return mathSqrt((amount1 * Q192) / amount0);
};

// Convert on-chain SqrtPriceX96 to UI display price string
const getDisplayPriceFromSqrtX96 = (
    sqrtPriceX96: bigint,
    decA: number,
    decB: number,
    isTokenA0: boolean,
): string => {
    if (sqrtPriceX96 === 0n) return "0";
    const Q192 = 2n ** 192n;
    const precision = 10n ** 18n;

    // P_raw = reserve1 / reserve0
    const priceRaw = (sqrtPriceX96 * sqrtPriceX96 * precision) / Q192;

    const dec0 = isTokenA0 ? decA : decB;
    const dec1 = isTokenA0 ? decB : decA;

    const shift = BigInt(dec0) - BigInt(dec1);
    let finalPriceBigInt;
    if (shift >= 0n) {
        finalPriceBigInt = priceRaw * 10n ** shift;
    } else {
        finalPriceBigInt = priceRaw / 10n ** -shift;
    }

    let priceNum = Number(finalPriceBigInt) / Number(precision);
    if (!isTokenA0) priceNum = 1 / priceNum;

    if (priceNum >= 1e20 || priceNum <= 1e-6) {
        return toSafeString(priceNum.toString());
    } else {
        return priceNum.toFixed(6).replace(/\.?0+$/, "");
    }
};

// --- Types & Interfaces ---
type TokenSide = "from" | "to" | "pool-a" | "pool-b" | null;
type PoolSubView = "dashboard" | "new-position" | "my-positions";

interface Token {
    symbol: string;
    name: string;
    address: string;
}

// --- DOM Elements ---
const navDashboardBtn = document.getElementById(
    "nav-dashboard",
) as HTMLAnchorElement;
const navSwapBtn = document.getElementById("nav-swap") as HTMLAnchorElement;
const navPoolBtn = document.getElementById("nav-pool") as HTMLAnchorElement;
const navFaucetBtn = document.getElementById("nav-faucet") as HTMLAnchorElement;

const viewPool = document.getElementById("view-pool") as HTMLDivElement;

const allNavItems = document.querySelectorAll(".nav-item");
const allViews = document.querySelectorAll(".view-section");

const headerConnectBtn = document.getElementById(
    "header-connect-btn",
) as HTMLButtonElement;
const walletDropdown = document.getElementById(
    "wallet-dropdown",
) as HTMLDivElement;
const displayAddress = document.getElementById(
    "display-address",
) as HTMLSpanElement;
const displayPk = document.getElementById("display-pk") as HTMLSpanElement;
const togglePkVisibilityBtn = document.getElementById(
    "toggle-pk-visibility",
) as HTMLSpanElement;
const disconnectBtn = document.getElementById(
    "disconnect-btn",
) as HTMLButtonElement;
const copyIcons = document.querySelectorAll(".copy-icon");

const networkBtn = document.getElementById("network-btn") as HTMLButtonElement;
const networkDropdown = document.getElementById(
    "network-dropdown",
) as HTMLDivElement;
const mobileMenuBtn = document.getElementById(
    "mobile-menu-btn",
) as HTMLButtonElement;
const closeMobileMenuBtn = document.getElementById(
    "close-mobile-menu-btn",
) as HTMLButtonElement;
const navLinks = document.getElementById("nav-links") as HTMLElement;
const mobileOverlay = document.getElementById(
    "mobile-overlay",
) as HTMLDivElement;

const mainActionBtn = document.getElementById(
    "main-action-btn",
) as HTMLButtonElement;
const switchBtn = document.getElementById("switch-btn") as HTMLButtonElement;

const fromAmountInput = document.getElementById(
    "from-amount",
) as HTMLInputElement;
const toAmountInput = document.getElementById("to-amount") as HTMLInputElement;
const fromTokenBtn = document.getElementById(
    "from-token-select",
) as HTMLButtonElement;
const toTokenBtn = document.getElementById(
    "to-token-select",
) as HTMLButtonElement;
const fromTokenSymbol = document.getElementById(
    "from-token-symbol",
) as HTMLSpanElement;
const toTokenSymbol = document.getElementById(
    "to-token-symbol",
) as HTMLSpanElement;

const claimSusdcBtn = document.getElementById(
    "claim-susdc-btn",
) as HTMLButtonElement;
const claimRftBtn = document.getElementById(
    "claim-rft-btn",
) as HTMLButtonElement;
const claimGmicBtn = document.getElementById(
    "claim-gmic-btn",
) as HTMLButtonElement;

const connectModal = document.getElementById("connect-modal") as HTMLDivElement;
const closeConnectModalBtn = document.getElementById(
    "close-connect",
) as HTMLButtonElement;
const pkInput = document.getElementById("pk-input") as HTMLInputElement;
const generatePkBtn = document.getElementById(
    "generate-pk-btn",
) as HTMLButtonElement;
const confirmConnectBtn = document.getElementById(
    "confirm-connect-btn",
) as HTMLButtonElement;

const settingsModal = document.getElementById(
    "settings-modal",
) as HTMLDivElement;
const settingsBtn = document.getElementById(
    "settings-btn",
) as HTMLButtonElement;
const closeSettingsModalBtn = document.getElementById(
    "close-settings",
) as HTMLButtonElement;
const slippageInput = document.getElementById(
    "slippage-input",
) as HTMLInputElement;
const deadlineInput = document.getElementById(
    "deadline-input",
) as HTMLInputElement;
const poolFeeInput = document.getElementById(
    "pool-fee-input",
) as HTMLSelectElement;
const advancedBtn = document.getElementById(
    "advanced-toggle-btn",
) as HTMLButtonElement;

const tokenModal = document.getElementById("token-modal") as HTMLDivElement;
const closeTokenModalBtn = document.getElementById(
    "close-token-modal",
) as HTMLButtonElement;
const tokenSearchInput = document.getElementById(
    "token-search-input",
) as HTMLInputElement;
const clearSearchBtn = document.getElementById(
    "clear-search-btn",
) as HTMLButtonElement;
const tokenListContainer = document.getElementById(
    "token-list",
) as HTMLDivElement;
const tokenSearchLoading = document.getElementById(
    "token-search-loading",
) as HTMLDivElement;
const noTokenFound = document.getElementById(
    "no-token-found",
) as HTMLDivElement;

const fromBalanceDisplay = document.getElementById(
    "from-balance",
) as HTMLSpanElement;
const toBalanceDisplay = document.getElementById(
    "to-balance",
) as HTMLSpanElement;

const successModal = document.getElementById("success-modal") as HTMLDivElement;
const closeSuccessBtn = document.getElementById(
    "close-success-btn",
) as HTMLButtonElement;
const shareXBtn = document.getElementById("share-x-btn") as HTMLButtonElement;
const successTitle = document.getElementById(
    "success-title",
) as HTMLHeadingElement;
const successSound = new Audio(
    "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
);

const poolTokenABtn = document.getElementById(
    "pool-token-a-btn",
) as HTMLButtonElement;
const poolTokenBBtn = document.getElementById(
    "pool-token-b-btn",
) as HTMLButtonElement;
const poolTokenASymbol = document.getElementById(
    "pool-token-a-symbol",
) as HTMLSpanElement;
const poolTokenBSymbol = document.getElementById(
    "pool-token-b-symbol",
) as HTMLSpanElement;
const poolDisplaySymbolA = document.getElementById(
    "pool-display-symbol-a",
) as HTMLSpanElement;
const poolDisplaySymbolB = document.getElementById(
    "pool-display-symbol-b",
) as HTMLSpanElement;
const poolAmountA = document.getElementById(
    "pool-amount-a",
) as HTMLInputElement;
const poolAmountB = document.getElementById(
    "pool-amount-b",
) as HTMLInputElement;
const depositWrapperA = document.getElementById(
    "deposit-wrapper-a",
) as HTMLDivElement;
const depositWrapperB = document.getElementById(
    "deposit-wrapper-b",
) as HTMLDivElement;
const poolBalanceA = document.getElementById(
    "pool-balance-a",
) as HTMLSpanElement;
const poolBalanceB = document.getElementById(
    "pool-balance-b",
) as HTMLSpanElement;

closeSuccessBtn?.addEventListener("click", () => {
    closeModal(successModal);
});

// --- State Variables ---
let isConnected = false;
let isAdvanced = false;
let currentPk = "";
let currentAddress = "";
let isPkVisible = false;
let lastEditedField: "from" | "to" = "from";
let isPoolExists = false;
let selectedFee = 3000;
let currentPoolAddress: `0x${string}` | null = null;
let currentRangeState: "IN_RANGE" | "BELOW_RANGE" | "ABOVE_RANGE" | null = null;
let account: customAccount;
let signClient: sigClient;
let lastSuccessData: SuccessModalData | null = null;

let currentDecA = 18;
let currentDecB = 18;
let cachedFromBalanceRaw = 0n;
let cachedFromDecimals = 18;
let cachedPoolBalARaw = 0n;
let cachedPoolBalBRaw = 0n;
let lastQuoteResult: QuoteResult | null = null;
let isRateInverted = false;
let quoteRequestSeq = 0;

let activeTokenSelectionSide: TokenSide = null;
const publicClient: pubClient = await createPubClient();

const openModal = (modal: HTMLDivElement) => modal.classList.remove("hidden");
const closeModal = (modal: HTMLDivElement) => modal.classList.add("hidden");

const shortenAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

// --- URL Bar SPA Router Helpers ---
const updateBrowserUrl = (path: string, replace = false) => {
    if (window.location.pathname === path) return;
    if (replace) {
        window.history.replaceState({ path }, "", path);
    } else {
        window.history.pushState({ path }, "", path);
    }
};

const getColorFromAddress = (address: string, symbol = "") => {
    const cleanAddr = (address || "").toLowerCase();
    const cleanSym = (symbol || "").toLowerCase();

    if (
        cleanAddr === NATIVE_TOKEN.toLowerCase() ||
        cleanAddr === WSIZE.toLowerCase() ||
        cleanSym === "size" ||
        cleanSym === "wsize"
    ) {
        return "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)";
    }
    if (
        cleanAddr === SUSDC_CA.toLowerCase() ||
        cleanSym === "susdc" ||
        cleanSym === "usdc"
    ) {
        return "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)";
    }
    if (cleanAddr === RFT_CA.toLowerCase() || cleanSym === "rft") {
        return "linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)";
    }
    if (cleanAddr === GMIC_CA.toLowerCase() || cleanSym === "gmic") {
        return "linear-gradient(135deg, #10b981 0%, #047857 100%)";
    }

    let hash = 0;
    for (let i = 0; i < cleanAddr.length; i++) {
        hash = cleanAddr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
};

const escapeHtml = (str: string): string => {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

const getTokenLogoFilename = (symbol: string, address = ""): string => {
    const cleanSym = (symbol || "").trim().toLowerCase();
    const cleanAddr = (address || "").trim().toLowerCase();
    if (
        cleanSym === "size" ||
        cleanSym === "wsize" ||
        cleanAddr === NATIVE_TOKEN.toLowerCase() ||
        cleanAddr === WSIZE.toLowerCase()
    ) {
        return "size";
    }
    if (cleanSym === "rft" || cleanAddr === RFT_CA.toLowerCase()) {
        return "rift";
    }
    return cleanSym;
};

const buildTokenIconInnerHtml = (symbol: string, address = ""): string => {
    const rawSym = (symbol || "?").trim();
    const safeSym = escapeHtml(rawSym);
    const char = escapeHtml(rawSym.charAt(0).toUpperCase());
    const fileKey = getTokenLogoFilename(rawSym, address);
    const knownLogos = new Set(["gmic", "rift", "size", "susdc"]);

    if (knownLogos.has(fileKey)) {
        return `<img src="/token-logo/${fileKey}.png" alt="${safeSym}" class="token-logo-img" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" /><span class="token-fallback-char" style="display:none;">${char}</span>`;
    }
    return `<span class="token-fallback-char">${char}</span>`;
};

const setTokenIconElement = (
    el: HTMLElement | null,
    symbol: string,
    address: string,
    customColor?: string,
) => {
    if (!el) return;
    const bgColor = customColor || getColorFromAddress(address, symbol);
    el.style.background = bgColor;
    el.style.color = "white";
    el.style.overflow = "hidden";
    el.style.padding = "0";
    el.innerHTML = buildTokenIconInnerHtml(symbol, address);
};

const buildSelectedTokenHtml = (symbol: string, address: string) => {
    const tokenColor = getColorFromAddress(address, symbol);
    const safeSym = escapeHtml(symbol);

    return `
        <div class="flex-align-center-gap8">
            <div class="token-icon token-icon-sm m-0" style="background: ${tokenColor}; color: white; overflow: hidden; padding: 0;">
                ${buildTokenIconInnerHtml(symbol, address)}
            </div>
            <span class="token-symbol-text">${safeSym}</span>
        </div>
    `;
};

// --- Interface for Strict Type Checking ---
export interface SuccessTokenData {
    symbol: string;
    amount?: string | number; // Optional in PoolCreated
    address: string;
}

export interface SuccessModalData {
    title: string;
    actionType:
        | "Swap"
        | "AddLiquidity"
        | "RemoveLiquidity"
        | "Collect"
        | "Faucet"
        | "PoolCreated"; // Added PoolCreated action type
    tokens: SuccessTokenData[];
    txHash?: string; // Optional transaction hash for explorer link
}

// --- Dynamic Receipt Generator ---
export const showSuccessDialog = (data: SuccessModalData) => {
    lastSuccessData = data;
    successTitle.textContent = data.title;
    const receiptBox = document.getElementById(
        "success-message",
    ) as HTMLDivElement;
    const explorerLink = document.getElementById(
        "success-explorer-link",
    ) as HTMLAnchorElement;

    // Manage explorer link visibility
    if (data.txHash) {
        // Set testnet explorer transaction URL
        explorerLink.href = `https://seismic-testnet.socialscan.io/tx/${data.txHash}`;
        explorerLink.classList.remove("d-none");
    } else {
        explorerLink.classList.add("d-none");
    }

    // Helper for token icon HTML
    const getTokenIconHtml = (token: SuccessTokenData) => {
        const bgColor = getColorFromAddress(token.address, token.symbol);

        return `<div class="token-icon token-icon-xs m-0" style="background: ${bgColor}; color: white; overflow: hidden; padding: 0;">${buildTokenIconInnerHtml(token.symbol, token.address)}</div>`;
    };

    // Helper for receipt row HTML
    const getRowHtml = (token: SuccessTokenData) => `
        <div class="d-flex justify-between items-center w-full my-05rem">
            <div class="flex-align-center-gap8">
                ${getTokenIconHtml(token)}
                <span class="font-semibold-1-1">${escapeHtml(token.symbol)}</span>
            </div>
            <span class="font-semibold-1-1 text-primary-color">${escapeHtml(String(token.amount || ""))}</span>
        </div>
    `;

    // Render receipt layout based on action type
    let receiptHtml = "";

    if (data.actionType === "Swap") {
        receiptHtml += `<span class="receipt-label">You swapped</span>`;
        receiptHtml += getRowHtml(data.tokens[0]);
        receiptHtml += `
            <div class="text-center w-full text-secondary-color" style="margin: -4px 0;">
                <span class="material-icons-round" style="font-size: 16px; opacity: 0.5;">arrow_downward</span>
            </div>
        `;
        receiptHtml += getRowHtml(data.tokens[1]);
    } else if (data.actionType === "AddLiquidity") {
        receiptHtml += `<span class="receipt-label">You added liquidity</span>`;
        data.tokens.forEach((t) => (receiptHtml += getRowHtml(t)));
    } else if (
        data.actionType === "RemoveLiquidity" ||
        data.actionType === "Faucet"
    ) {
        receiptHtml += `<span class="receipt-label">You received</span>`;
        data.tokens.forEach((t) => (receiptHtml += getRowHtml(t)));
    } else if (data.actionType === "Collect") {
        receiptHtml += `<span class="receipt-label">Fees collected</span>`;
        data.tokens.forEach((t) => (receiptHtml += getRowHtml(t)));
    } else if (data.actionType === "PoolCreated") {
        // Custom layout for newly created pool
        receiptHtml += `<span class="receipt-label">New Pool Initiated</span>`;
        receiptHtml += `
            <div class="d-flex items-center justify-center w-full my-05rem gap-2">
                <div class="d-flex pair-icons-stack">
                    ${getTokenIconHtml(data.tokens[0])}
                    <div class="pool-icon-overlap">${getTokenIconHtml(data.tokens[1])}</div>
                </div>
                <span class="font-semibold-1-1" style="margin-left: 8px;">
                    ${escapeHtml(data.tokens[0].symbol)} / ${escapeHtml(data.tokens[1].symbol)}
                </span>
            </div>
        `;
    }

    receiptBox.innerHTML = receiptHtml;

    successSound.currentTime = 0;
    successSound
        .play()
        .catch((e) => console.log("Audio prevented by browser", e));

    openModal(successModal);
};

// --- Share on X (Twitter) Logic ---
shareXBtn?.addEventListener("click", () => {
    const t0 = lastSuccessData?.tokens[0];
    const t1 = lastSuccessData?.tokens[1];
    const siteUrl = "https://riftprotocol.xyz";
    let tweetText =
        `Exploring confidential concentrated liquidity on @riftprotocolxyz V3! ⚡🔒\n\nExperience private DeFi on Seismic:\n${siteUrl}`;

    if (lastSuccessData) {
        switch (lastSuccessData.actionType) {
            case "Swap":
                tweetText = `Just swapped ${t0?.amount || ""} $${t0?.symbol || ""} for ${t1?.amount || ""} $${t1?.symbol || ""} with confidential execution on @riftprotocolxyz V3! ⚡🔒\n\nExperience private DeFi on Seismic:\n${siteUrl}`;
                break;
            case "AddLiquidity":
                tweetText = `Just provided concentrated liquidity (${t0?.amount || ""} $${t0?.symbol || ""} + ${t1?.amount || ""} $${t1?.symbol || ""}) on @riftprotocolxyz V3! 💧🛡️\n\nEarn yield with shielded LP positions:\n${siteUrl}`;
                break;
            case "RemoveLiquidity":
                tweetText = `Successfully managed my concentrated liquidity position (${t0?.symbol || ""}/${t1?.symbol || ""}) on @riftprotocolxyz V3! ⚡🔒\n\nExplore confidential DeFi on Seismic:\n${siteUrl}`;
                break;
            case "Collect":
                tweetText = `Just harvested my LP yield (${t0?.amount || "0"} $${t0?.symbol || ""} & ${t1?.amount || "0"} $${t1?.symbol || ""}) on @riftprotocolxyz V3! 🌾✨\n\nPut your capital to work privately:\n${siteUrl}`;
                break;
            case "Faucet":
                tweetText = `Just claimed ${t0?.amount || ""} $${t0?.symbol || ""} from the @riftprotocolxyz Testnet Faucet! 🚰⚡\n\nTest confidential V3 swaps & LPing now:\n${siteUrl}`;
                break;
            case "PoolCreated":
                tweetText = `Just initialized a new confidential V3 liquidity pool ($${t0?.symbol || ""} / $${t1?.symbol || ""}) on @riftprotocolxyz! 🚀🌊\n\nTrade and LP privately on Seismic:\n${siteUrl}`;
                break;
        }
    }

    const xIntentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(xIntentUrl, "_blank", "noopener,noreferrer");
});

const toggleMobileMenu = (forceClose = false) => {
    if (forceClose) {
        navLinks.classList.remove("open");
        mobileOverlay.classList.remove("active");
    } else {
        navLinks.classList.toggle("open");
        mobileOverlay.classList.toggle("active");
    }
};

const loadCustomTokens = () => {
    try {
        const savedTokens = JSON.parse(
            localStorage.getItem("customTokens") || "[]",
        );
        savedTokens.forEach((token: Token) => {
            const exists = Array.from(
                tokenListContainer.querySelectorAll(".token-list-item"),
            ).some(
                (el) =>
                    el.getAttribute("data-address")?.toLowerCase() ===
                    token.address.toLowerCase(),
            );
            if (exists) return;

            const div = document.createElement("div");
            div.className = "token-list-item";
            div.setAttribute("data-symbol", token.symbol);
            div.setAttribute("data-address", token.address);
            const bgColor = getColorFromAddress(token.address, token.symbol);
            const shortAddr = shortenAddress(token.address);

            const safeSym = escapeHtml(token.symbol);
            const safeName = escapeHtml(token.name);
            const safeAddr = escapeHtml(token.address);

            div.innerHTML = `
                <div class="token-icon ts-token-icon" style="background: ${bgColor}; color: white; overflow: hidden; padding: 0;">
                    ${buildTokenIconInnerHtml(token.symbol, token.address)}
                </div>
                <div class="token-info ts-token-info-wrapper">
                    <div class="ts-token-header">
                        <span class="token-symbol">${safeSym}</span>
                        <span class="material-icons-round delete-token-btn token-action-icon ts-token-delete-btn" data-address="${safeAddr}" title="Remove Token">delete_outline</span>
                    </div>
                    <div class="ts-token-meta">
                        <span class="token-name">${safeName}</span>
                        <span class="ts-token-dot">•</span>
                        <span class="ts-token-address">${shortAddr}</span>
                        <span class="material-icons-round copy-ca-btn token-action-icon ts-token-copy-btn" data-ca="${safeAddr}" title="Copy Address">content_copy</span>
                    </div>
                </div>
            `;
            tokenListContainer.appendChild(div);
        });
    } catch (e) {
        console.error("Corrupted local storage data. Clearing...", e);
        localStorage.removeItem("customTokens");
    }
};

const viewToPathMap: Record<string, string> = {
    "view-dashboard": "/dashboard",
    "view-swap": "/swap",
    "view-pool": "/pool",
    "view-faucet": "/faucet",
};

const switchView = (targetViewId: string, navBtnId: string, syncUrl = true) => {
    allViews.forEach((view) => view.classList.add("d-none"));
    allNavItems.forEach((item) => item.classList.remove("active"));
    document.getElementById(targetViewId)?.classList.remove("d-none");
    document.getElementById(navBtnId)?.classList.add("active");
    localStorage.setItem("rift_active_view", targetViewId);
    localStorage.setItem("rift_active_nav", navBtnId);

    if (syncUrl && targetViewId !== "view-pool") {
        const targetPath = viewToPathMap[targetViewId] || "/swap";
        updateBrowserUrl(targetPath);
    }

    toggleMobileMenu(true);
};

const resolveDecimalsCached = async (
    address: string,
    cache: Record<string, number>,
): Promise<number> => {
    if (!address || address === NATIVE_TOKEN) return 18;
    const lower = address.toLowerCase();
    if (lower === SUSDC_CA.toLowerCase()) return 6;
    if (lower === RFT_CA.toLowerCase() || lower === GMIC_CA.toLowerCase() || lower === WSIZE.toLowerCase()) {
        return 18;
    }
    if (cache[lower] !== undefined) return cache[lower];
    try {
        const dec = Number(await getDecimal(address as `0x${string}`, publicClient)) || 18;
        cache[lower] = dec;
        return dec;
    } catch {
        return 18;
    }
};

const swapDecimalsCache: Record<string, number> = {};

const updateBalances = async () => {
    const swapHalfBtn = document.getElementById("swap-half-btn");
    const swapMaxBtn = document.getElementById("swap-max-btn");
    const walletNativeEl = document.getElementById("wallet-native-balance");

    if (!isConnected || !account) {
        cachedFromBalanceRaw = 0n;
        cachedPoolBalARaw = 0n;
        cachedPoolBalBRaw = 0n;
        swapHalfBtn?.classList.add("d-none");
        swapMaxBtn?.classList.add("d-none");
        if (walletNativeEl) walletNativeEl.textContent = "0 SIZE";
        return;
    }

    const fromCa = fromAmountInput.getAttribute("data-ca") as string;
    const toCa = toAmountInput.getAttribute("data-ca") as string;
    const poolCaA = poolTokenABtn.getAttribute("data-ca") as string;
    const poolCaB = poolTokenBBtn.getAttribute("data-ca") as string;

    const isValidAddress = (addr: string | null) => {
        return (
            addr &&
            (addr === NATIVE_TOKEN ||
                (addr.startsWith("0x") &&
                    addr.length === 42 &&
                    addr !== zeroAddress))
        );
    };

    try {
        const nativeBal = await publicClient.getBalance({ address: account.address });
        if (walletNativeEl) {
            walletNativeEl.textContent = `${parseFloat(Number(formatUnits(nativeBal, 18)).toFixed(4))} SIZE`;
        }
    } catch {
        // Ignore transient native balance check errors
    }

    try {
        if (isValidAddress(fromCa) && isValidAddress(toCa)) {
            const [decFrom, decTo, balFrom, balTo] = await Promise.all([
                resolveDecimalsCached(fromCa, swapDecimalsCache),
                resolveDecimalsCached(toCa, swapDecimalsCache),
                getTokenBalance(
                    fromCa!,
                    account.address,
                    publicClient,
                    signClient,
                ),
                getTokenBalance(
                    toCa!,
                    account.address,
                    publicClient,
                    signClient,
                ),
            ]);
            cachedFromBalanceRaw = balFrom;
            cachedFromDecimals = decFrom;
            fromBalanceDisplay.textContent = parseFloat(
                Number(formatUnits(balFrom, decFrom)).toFixed(4),
            ).toString();
            toBalanceDisplay.textContent = parseFloat(
                Number(formatUnits(balTo, decTo)).toFixed(4),
            ).toString();
            if (balFrom > 0n) {
                swapHalfBtn?.classList.remove("d-none");
                swapMaxBtn?.classList.remove("d-none");
            } else {
                swapHalfBtn?.classList.add("d-none");
                swapMaxBtn?.classList.add("d-none");
            }
        }
    } catch (error) {
        console.error("Failed to update Swap balances:", error);
    }

    try {
        if (isValidAddress(poolCaA) && isValidAddress(poolCaB)) {
            const [decPoolA, decPoolB, balPoolA, balPoolB] = await Promise.all([
                resolveDecimalsCached(poolCaA, swapDecimalsCache),
                resolveDecimalsCached(poolCaB, swapDecimalsCache),
                getTokenBalance(
                    poolCaA!,
                    account.address,
                    publicClient,
                    signClient,
                ),
                getTokenBalance(
                    poolCaB!,
                    account.address,
                    publicClient,
                    signClient,
                ),
            ]);
            cachedPoolBalARaw = balPoolA;
            cachedPoolBalBRaw = balPoolB;
            poolBalanceA.textContent = parseFloat(
                Number(formatUnits(balPoolA, decPoolA)).toFixed(4),
            ).toString();
            poolBalanceB.textContent = parseFloat(
                Number(formatUnits(balPoolB, decPoolB)).toFixed(4),
            ).toString();
        }
    } catch (error) {
        console.error("Failed to update Pool balances:", error);
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    loadCustomTokens();

    const poolDashboard = document.getElementById(
        "pool-dashboard",
    ) as HTMLDivElement;
    const poolNewPosition = document.getElementById(
        "pool-new-position",
    ) as HTMLDivElement;
    const btnNewPosition = document.getElementById(
        "btn-new-position",
    ) as HTMLButtonElement;
    const btnBackToPool = document.getElementById(
        "btn-back-to-pool",
    ) as HTMLButtonElement;
    const btnMyPositions = document.getElementById(
        "btn-my-positions",
    ) as HTMLButtonElement;
    const poolPositionsPage = document.getElementById(
        "pool-positions-page",
    ) as HTMLDivElement;
    const btnBackFromPositions = document.getElementById(
        "btn-back-from-positions",
    ) as HTMLButtonElement;
    const poolManagePosition = document.getElementById(
        "pool-manage-position",
    ) as HTMLDivElement;
    const btnBackToList = document.getElementById(
        "btn-back-to-list",
    ) as HTMLButtonElement;
    const popularPoolsList = document.getElementById(
        "popular-pools-list",
    ) as HTMLDivElement;
    const feeCards = document.querySelectorAll(".fee-card");

    const setFeeTierUI = (feeAmount: number) => {
        selectedFee = feeAmount;
        feeCards.forEach((c) => {
            const cardFee = Number(c.getAttribute("data-fee"));
            if (cardFee === feeAmount) {
                c.classList.add("active");
                c.querySelector(".check-icon")?.classList.remove("d-none");
            } else {
                c.classList.remove("active");
                c.querySelector(".check-icon")?.classList.add("d-none");
            }
        });
    };

    const applyPoolPairSelection = (
        symA: string,
        caA: string,
        symB: string,
        caB: string,
        fee = 3000,
    ) => {
        const htmlA = buildSelectedTokenHtml(symA, caA);
        const htmlB = buildSelectedTokenHtml(symB, caB);

        poolTokenASymbol.innerHTML = htmlA;
        poolTokenABtn.setAttribute("data-ca", caA);
        poolDisplaySymbolA.innerHTML = htmlA;
        poolAmountA.setAttribute("data-ca", caA);

        poolTokenBSymbol.innerHTML = htmlB;
        poolTokenBBtn.setAttribute("data-ca", caB);
        poolDisplaySymbolB.innerHTML = htmlB;
        poolAmountB.setAttribute("data-ca", caB);

        setFeeTierUI(fee);

        localStorage.setItem(
            "rift_pool_selected_pair",
            JSON.stringify({ symA, caA, symB, caB, fee }),
        );
    };

    const setPoolSubView = (
        subView: PoolSubView,
        triggerLoadPositions = true,
        syncUrl = true,
    ) => {
        poolDashboard.classList.add("d-none");
        poolNewPosition.classList.add("d-none");
        poolPositionsPage.classList.add("d-none");
        poolManagePosition.classList.add("d-none");

        if (subView === "new-position") {
            poolNewPosition.classList.remove("d-none");
            if (syncUrl) {
                const targetPoolPath =
                    isPoolExists && currentPoolAddress
                        ? `/pool/${currentPoolAddress}`
                        : "/pool/none";
                updateBrowserUrl(targetPoolPath);
            }
        } else if (subView === "my-positions") {
            poolPositionsPage.classList.remove("d-none");
            if (syncUrl) {
                updateBrowserUrl("/pool/positions");
            }
            if (triggerLoadPositions) {
                loadUserPositions();
            }
        } else {
            poolDashboard.classList.remove("d-none");
            if (syncUrl) {
                updateBrowserUrl("/pool");
            }
        }

        localStorage.setItem("rift_pool_subview", subView);
    };

    navDashboardBtn.addEventListener("click", (e) => {
        e.preventDefault();
        switchView("view-dashboard", "nav-dashboard", true);
    });
    navSwapBtn.addEventListener("click", (e) => {
        e.preventDefault();
        switchView("view-swap", "nav-swap", true);
    });
    navPoolBtn.addEventListener("click", (e) => {
        e.preventDefault();
        switchView("view-pool", "nav-pool", false);
        setPoolSubView("dashboard", false, true);
    });
    navFaucetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        switchView("view-faucet", "nav-faucet", true);
    });

    // --- Popular Pools Click & Keyboard Handler ---
    const openPopularPoolItem = async (poolItem: HTMLElement) => {
        const poolAddr = poolItem.getAttribute("data-address") || "";
        const symA = poolItem.getAttribute("data-token-a-symbol") || "RFT";
        const caA = poolItem.getAttribute("data-token-a-address") || RFT_CA;
        const symB = poolItem.getAttribute("data-token-b-symbol") || "GMIC";
        const caB = poolItem.getAttribute("data-token-b-address") || GMIC_CA;
        const fee = Number(poolItem.getAttribute("data-fee") || "3000");

        switchView("view-pool", "nav-pool", false);
        applyPoolPairSelection(symA, caA, symB, caB, fee);

        if (poolAddr) {
            currentPoolAddress = poolAddr as `0x${string}`;
            isPoolExists = true;
        }

        setPoolSubView("new-position", false, true);
        await updateBalances();
        await checkPoolStatus();
    };

    popularPoolsList?.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        const poolItem = target.closest(".pool-list-item") as HTMLElement;
        if (!poolItem) return;
        await openPopularPoolItem(poolItem);
    });

    popularPoolsList?.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const target = e.target as HTMLElement;
        const poolItem = target.closest(".pool-list-item") as HTMLElement;
        if (!poolItem) return;
        e.preventDefault();
        await openPopularPoolItem(poolItem);
    });

    // --- Dashboard Quick Actions & Live RPC Health ---
    document.getElementById("dash-go-swap")?.addEventListener("click", () => {
        switchView("view-swap", "nav-swap", true);
    });
    document.getElementById("dash-go-pool")?.addEventListener("click", () => {
        switchView("view-pool", "nav-pool", false);
        setPoolSubView("dashboard", false, true);
    });
    document.getElementById("dash-go-faucet")?.addEventListener("click", () => {
        switchView("view-faucet", "nav-faucet", true);
    });

    const headerRpcDot = document.getElementById("header-rpc-dot");
    const dropdownRpcDot = document.getElementById("dropdown-rpc-dot");
    const dropdownRpcStatus = document.getElementById("dropdown-rpc-status");
    const retryRpcBtn = document.getElementById("retry-rpc-btn");
    const dashboardLiveBlock = document.getElementById("dashboard-live-block");
    const dashboardLiveLatency = document.getElementById("dashboard-live-latency");

    const checkRpcHealth = async () => {
        headerRpcDot?.classList.remove("offline");
        headerRpcDot?.classList.add("checking");
        dropdownRpcDot?.classList.remove("offline");
        dropdownRpcDot?.classList.add("checking");
        if (dropdownRpcStatus) dropdownRpcStatus.textContent = "Checking RPC...";

        const started = performance.now();
        try {
            const blockNum = await publicClient.getBlockNumber();
            const ms = Math.round(performance.now() - started);
            headerRpcDot?.classList.remove("checking", "offline");
            dropdownRpcDot?.classList.remove("checking", "offline");
            if (dropdownRpcStatus) {
                dropdownRpcStatus.textContent = `Block #${blockNum.toString()} (${ms}ms)`;
            }
            if (dashboardLiveBlock) {
                dashboardLiveBlock.textContent = `#${blockNum.toString()}`;
            }
            if (dashboardLiveLatency) {
                dashboardLiveLatency.textContent = `Online • ${ms}ms`;
            }
            return true;
        } catch {
            headerRpcDot?.classList.remove("checking");
            headerRpcDot?.classList.add("offline");
            dropdownRpcDot?.classList.remove("checking");
            dropdownRpcDot?.classList.add("offline");
            if (dropdownRpcStatus) {
                dropdownRpcStatus.textContent = "RPC Unreachable";
            }
            if (dashboardLiveBlock) {
                dashboardLiveBlock.textContent = "Offline";
            }
            if (dashboardLiveLatency) {
                dashboardLiveLatency.textContent = "Check Testnet RPC";
            }
            return false;
        }
    };
    retryRpcBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        checkRpcHealth();
    });
    checkRpcHealth();

    mobileMenuBtn.addEventListener("click", () => toggleMobileMenu());
    closeMobileMenuBtn.addEventListener("click", () => toggleMobileMenu(true));
    mobileOverlay.addEventListener("click", () => toggleMobileMenu(true));

    networkBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        networkDropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
        if (
            !networkDropdown.contains(e.target as Node) &&
            e.target !== networkBtn
        ) {
            networkDropdown.classList.add("hidden");
        }
    });

    mainActionBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        if (!isConnected) {
            openModal(connectModal);
            return;
        }

        const valIn = fromAmountInput.value.trim();
        const valOut = toAmountInput.value.trim();
        const tokenIn = fromAmountInput.getAttribute("data-ca") as string;
        const tokenOut = toAmountInput.getAttribute("data-ca") as string;

        if (!valIn || !valOut || Number(valIn) <= 0 || Number(valOut) <= 0) {
            showLog("Please enter valid amounts to swap.", "error");
            return;
        }
        const slippageVal = Number(slippageInput.value);
        const slippageBps = BigInt(Math.floor(slippageVal * 100));
        const deadlineMins = Number(deadlineInput.value);
        const fee = Number(poolFeeInput.value);

        const deadline = BigInt(
            Math.floor(Date.now() / 1000) + deadlineMins * 60,
        );

        try {
            mainActionBtn.disabled = true;
            const [tokenDecimals, tokenOutDecimals] = await Promise.all([
                resolveDecimalsCached(tokenIn, swapDecimalsCache),
                resolveDecimalsCached(tokenOut, swapDecimalsCache),
            ]);

            let requiredAmountIn = 0n;
            const amountInExact = safeParseUnits(valIn, tokenDecimals);

            if (lastEditedField === "from") {
                requiredAmountIn = amountInExact;
            } else {
                requiredAmountIn =
                    (amountInExact * (10000n + slippageBps)) / 10000n;
            }

            mainActionBtn.textContent = "Checking network state...";
            const routerAddress =
                "0x15D499264016C01143eb84bce319f762cFe2AB19" as `0x${string}`;

            // Check balance and allowance including native token handling
            const [balance, allowance] = await Promise.all([
                getTokenBalance(
                    tokenIn,
                    account.address,
                    publicClient,
                    signClient,
                ),
                getTokenAllowance(
                    tokenIn,
                    account.address,
                    routerAddress,
                    publicClient,
                    signClient,
                ),
            ]);

            if (balance < requiredAmountIn) {
                showLog(
                    `Insufficient balance! Need ${formatUnits(requiredAmountIn, tokenDecimals)}, but you have ${formatUnits(balance, tokenDecimals)}`,
                    "error",
                );
                return;
            }

            const cleanFromSymbol = getCleanTokenSymbol(fromTokenSymbol, "IN");
            const cleanToSymbol = getCleanTokenSymbol(toTokenSymbol, "OUT");

            if (allowance < requiredAmountIn) {
                mainActionBtn.textContent = `Approving ${cleanFromSymbol}...`;
                showLog(
                    `Requesting approval for ${cleanFromSymbol}...`,
                    "info",
                );

                const isApproved = await approve(
                    tokenIn as `0x${string}`,
                    routerAddress,
                    maxUint256,
                    signClient,
                    publicClient,
                );

                if (!isApproved) {
                    showLog("Approval failed or rejected!", "error");
                    return;
                }
                showLog("Approved successfully! Syncing...", "success");
                await new Promise((resolve) => setTimeout(resolve, 1500));
            }

            mainActionBtn.textContent = "Swapping...";
            let txHash: `0x${string}` | undefined;

            if (lastEditedField === "from") {
                const amountOutMinimum =
                    (safeParseUnits(valOut, tokenOutDecimals) *
                        (10000n - slippageBps)) /
                    10000n;
                showLog(
                    `Swapping for at least ${formatUnits(amountOutMinimum, tokenOutDecimals)}...`,
                    "info",
                );
                txHash = await exactInput(
                    tokenIn,
                    tokenOut,
                    fee,
                    account.address,
                    deadline,
                    requiredAmountIn,
                    amountOutMinimum,
                    0n,
                    publicClient,
                    signClient,
                );
            } else {
                const amountOut = safeParseUnits(valOut, tokenOutDecimals);
                showLog(
                    `Swapping max ${formatUnits(requiredAmountIn, tokenDecimals)}...`,
                    "info",
                );
                txHash = await exactOutput(
                    tokenIn,
                    tokenOut,
                    fee,
                    account.address,
                    deadline,
                    amountOut,
                    requiredAmountIn,
                    0n,
                    publicClient,
                    signClient,
                );
            }

            showSuccessDialog({
                title: "Swap Successful!",
                actionType: "Swap",
                txHash,
                tokens: [
                    {
                        symbol: cleanFromSymbol,
                        amount: valIn,
                        address: tokenIn,
                    },
                    {
                        symbol: cleanToSymbol,
                        amount: valOut,
                        address: tokenOut,
                    },
                ],
            });

            fromAmountInput.value = "";
            toAmountInput.value = "";
            document.getElementById("swap-quote-card")?.classList.add("d-none");
            document.getElementById("swap-inline-alert")?.classList.add("d-none");
            updateBalances();
        } catch (error) {
            console.error("Swap Error Detailed: ", error);
            showLog(
                "Transaction reverted or RPC unreachable. Check console for details.",
                "error",
            );
        } finally {
            mainActionBtn.disabled = false;
            mainActionBtn.textContent = isConnected ? "Swap" : "Connect Wallet";
        }
    });

    let discordSession: any = null;

    const updateFaucetChecklist = () => {
        const stepWallet = document.getElementById("faucet-step-wallet");
        const stepDiscord = document.getElementById("faucet-step-discord");
        const stepClaim = document.getElementById("faucet-step-claim");
        stepWallet?.classList.toggle("done", isConnected);
        stepDiscord?.classList.toggle("done", Boolean(discordSession));
        stepClaim?.classList.toggle("done", isConnected && Boolean(discordSession));
    };

    const connectWallet = async (pkValue: string) => {
        if (!pkValue.startsWith("0x")) pkValue = "0x" + pkValue;
        let viemAccount;
        try {
            viemAccount = privateKeyToAccount(pkValue as `0x${string}`);
        } catch (error) {
            showLog("Invalid Private Key Format.", "error");
            localStorage.removeItem("rift_user_pk");
            return;
        }

        let retries = 3;
        let success = false;
        while (retries > 0 && !success) {
            try {
                mainActionBtn.disabled = true;
                mainActionBtn.textContent = `Connecting RPC... (${4 - retries}/3)`;

                account = getAcc(pkValue as `0x${string}`);
                signClient = await createSignitureClient(account);

                isConnected = true;
                currentPk = pkValue;
                currentAddress = viemAccount.address;

                headerConnectBtn.textContent = shortenAddress(currentAddress);
                displayAddress.textContent = shortenAddress(currentAddress);
                const walletExplorerLink = document.getElementById(
                    "wallet-explorer-link",
                ) as HTMLAnchorElement | null;
                if (walletExplorerLink) {
                    walletExplorerLink.href = `https://seismic-testnet.socialscan.io/address/${currentAddress}`;
                }
                mainActionBtn.textContent = "Swap";
                mainActionBtn.disabled = false;

                localStorage.setItem("rift_user_pk", pkValue);
                closeModal(connectModal);
                if (pkInput) pkInput.value = "";

                showLog("Wallet connected successfully!", "success");
                updateFaucetChecklist?.();
                await updateBalances();

                if (
                    localStorage.getItem("rift_active_view") === "view-pool" &&
                    localStorage.getItem("rift_pool_subview") === "my-positions"
                ) {
                    await loadUserPositions();
                }

                success = true;
            } catch (error) {
                retries--;
                if (retries > 0) {
                    showLog(
                        `Network slow. Retrying in 3s... (${retries} attempts left)`,
                        "info",
                    );
                    await new Promise((res) => setTimeout(res, 3000));
                } else {
                    showLog(
                        "Seismic Testnet RPC is currently down. Try again later.",
                        "error",
                    );
                    mainActionBtn.textContent = "Connect Wallet";
                    mainActionBtn.disabled = false;
                    isConnected = false;
                }
            }
        }
    };

    headerConnectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isConnected) openModal(connectModal);
        else walletDropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
        if (
            !walletDropdown.contains(e.target as Node) &&
            e.target !== headerConnectBtn
        ) {
            walletDropdown.classList.add("hidden");
        }
    });

    const toggleModalPkBtn = document.getElementById("toggle-modal-pk-visibility");
    toggleModalPkBtn?.addEventListener("click", () => {
        const isHidden = pkInput.type === "password";
        pkInput.type = isHidden ? "text" : "password";
        const icon = toggleModalPkBtn.querySelector(".material-icons-round");
        if (icon) icon.textContent = isHidden ? "visibility_off" : "visibility";
    });

    pkInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            confirmConnectBtn.click();
        }
    });

    generatePkBtn.addEventListener("click", () => {
        pkInput.value = generatePrivateKey();
        showLog("Private key generated successfully.", "success");
    });

    confirmConnectBtn.addEventListener("click", async () => {
        const pkValue = pkInput.value.trim();
        if (!pkValue) {
            showLog("Please enter a private key.", "error");
            return;
        }
        await connectWallet(pkValue);
    });

    disconnectBtn.addEventListener("click", () => {
        isConnected = false;
        currentPk = "";
        currentAddress = "";
        cachedFromBalanceRaw = 0n;
        cachedPoolBalARaw = 0n;
        cachedPoolBalBRaw = 0n;
        currentManagePos = null;
        headerConnectBtn.textContent = "Connect Wallet";
        mainActionBtn.textContent = "Connect Wallet";
        walletDropdown.classList.add("hidden");
        localStorage.removeItem("rift_user_pk");
        showLog("Wallet disconnected.", "info");

        fromBalanceDisplay.textContent = "0.0000";
        toBalanceDisplay.textContent = "0.0000";
        poolBalanceA.textContent = "0.0000";
        poolBalanceB.textContent = "0.0000";
        document.getElementById("swap-half-btn")?.classList.add("d-none");
        document.getElementById("swap-max-btn")?.classList.add("d-none");
        const walletNativeEl = document.getElementById("wallet-native-balance");
        if (walletNativeEl) walletNativeEl.textContent = "0 SIZE";
        updateFaucetChecklist?.();
        if (!poolPositionsPage.classList.contains("d-none") || !poolManagePosition.classList.contains("d-none")) {
            setPoolSubView("my-positions", true, true);
        }
    });

    copyIcons.forEach((icon) => {
        icon.addEventListener("click", (e) => {
            const el = e.target as HTMLElement;
            const targetVar = el.getAttribute("data-copy-target");
            const targetText = el.getAttribute("data-copy-text");

            let textToCopy = "";
            if (targetText) textToCopy = targetText;
            else if (targetVar === "address") textToCopy = currentAddress;
            else if (targetVar === "pk") textToCopy = currentPk;

            if (textToCopy) {
                navigator.clipboard
                    .writeText(textToCopy)
                    .then(() => {
                        showLog(`Copied to clipboard!`, "success");
                    })
                    .catch(() => {
                        showLog("Failed to copy to clipboard", "error");
                    });
            } else {
                showLog("Nothing to copy.", "error");
            }
        });
    });

    togglePkVisibilityBtn.addEventListener("click", () => {
        isPkVisible = !isPkVisible;
        if (isPkVisible) {
            displayPk.textContent = `${currentPk.slice(0, 10)}...${currentPk.slice(-4)}`;
            displayPk.classList.remove("hidden-text");
            togglePkVisibilityBtn.textContent = "visibility_off";
        } else {
            displayPk.textContent = "********";
            displayPk.classList.add("hidden-text");
            togglePkVisibilityBtn.textContent = "visibility";
        }
    });

    const settingFeeRow = document.getElementById(
        "setting-fee-row",
    ) as HTMLDivElement;
    const poolSettingsBtn = document.getElementById(
        "pool-settings-btn",
    ) as HTMLButtonElement;

    settingsBtn.addEventListener("click", () => {
        if (settingFeeRow) settingFeeRow.classList.remove("d-none");
        openModal(settingsModal);
    });

    poolSettingsBtn?.addEventListener("click", () => {
        if (settingFeeRow) settingFeeRow.classList.add("d-none");
        openModal(settingsModal);
    });

    // Slippage Presets inside Execution Parameters modal
    const slippagePresetBtns = document.querySelectorAll(".slippage-preset-btn");
    const syncSlippagePresets = (valStr: string) => {
        const cleanVal = Number(valStr);
        slippagePresetBtns.forEach((btn) => {
            const preset = Number(btn.getAttribute("data-slippage"));
            btn.classList.toggle("active", Math.abs(preset - cleanVal) < 0.001);
        });
        const slipTrigger = document.getElementById("quote-slippage-trigger");
        if (slipTrigger) {
            slipTrigger.textContent = `(${valStr || "0.3"}% slip.)`;
        }
        renderSwapQuoteSummary();
    };

    slippagePresetBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const preset = btn.getAttribute("data-slippage") || "0.3";
            slippageInput.value = preset;
            syncSlippagePresets(preset);
        });
    });
    slippageInput.addEventListener("input", () => syncSlippagePresets(slippageInput.value));

    advancedBtn.addEventListener("click", () => {
        isAdvanced = !isAdvanced;
        slippageInput.disabled = !isAdvanced;
        deadlineInput.disabled = !isAdvanced;
        poolFeeInput.disabled = !isAdvanced;

        if (isAdvanced) {
            poolFeeInput.style.cursor = "pointer";
            advancedBtn.classList.remove("secondary-btn");
            advancedBtn.classList.add("primary-btn");
            slippageInput.focus();
        } else {
            poolFeeInput.style.cursor = "not-allowed";
            advancedBtn.classList.add("secondary-btn");
            advancedBtn.classList.remove("primary-btn");
            showLog("Settings saved and locked.", "success");
        }
        advancedBtn.textContent = isAdvanced
            ? "Advanced (Lock Settings)"
            : "Advanced (Enable Custom Edit)";
    });

    const swapQuoteCard = document.getElementById("swap-quote-card") as HTMLDivElement | null;
    const invertRateBtn = document.getElementById("invert-rate-btn") as HTMLButtonElement | null;
    const quoteRouteBadge = document.getElementById("quote-route-badge") as HTMLSpanElement | null;
    const quoteMinReceived = document.getElementById("quote-min-received") as HTMLSpanElement | null;
    const swapInlineAlert = document.getElementById("swap-inline-alert") as HTMLDivElement | null;
    const quoteSlippageTrigger = document.getElementById("quote-slippage-trigger");

    quoteSlippageTrigger?.addEventListener("click", () => {
        if (settingFeeRow) settingFeeRow.classList.remove("d-none");
        openModal(settingsModal);
    });

    const renderSwapQuoteSummary = () => {
        if (!swapQuoteCard) return;
        const valIn = Number(fromAmountInput.value.trim());
        const valOut = Number(toAmountInput.value.trim());
        if (!valIn || !valOut || valIn <= 0 || valOut <= 0 || !lastQuoteResult) {
            swapQuoteCard.classList.add("d-none");
            return;
        }
        const fromSym = getCleanTokenSymbol(fromTokenSymbol, "IN");
        const toSym = getCleanTokenSymbol(toTokenSymbol, "OUT");

        if (invertRateBtn) {
            if (!isRateInverted) {
                const rate = valOut / valIn;
                invertRateBtn.textContent = `1 ${fromSym} = ${parseFloat(rate.toFixed(6))} ${toSym}`;
            } else {
                const invRate = valIn / valOut;
                invertRateBtn.textContent = `1 ${toSym} = ${parseFloat(invRate.toFixed(6))} ${fromSym}`;
            }
        }
        if (quoteRouteBadge) {
            quoteRouteBadge.textContent = lastQuoteResult.routeLabel;
        }
        if (quoteMinReceived) {
            const slip = Number(slippageInput.value) || 0.3;
            const minOut = valOut * (1 - slip / 100);
            quoteMinReceived.textContent = `${parseFloat(minOut.toFixed(6))} ${toSym}`;
        }
        swapQuoteCard.classList.remove("d-none");
    };

    invertRateBtn?.addEventListener("click", () => {
        isRateInverted = !isRateInverted;
        renderSwapQuoteSummary();
    });

    // Quick 50% / MAX fill buttons for Swap
    const fillSwapBalance = (fraction: "half" | "max") => {
        if (!isConnected || cachedFromBalanceRaw <= 0n) return;
        const fromCa = fromAmountInput.getAttribute("data-ca") || "";
        let usable = cachedFromBalanceRaw;
        if (fraction === "half") {
            usable = cachedFromBalanceRaw / 2n;
        } else if (fromCa === NATIVE_TOKEN) {
            const gasReserve = parseUnits("0.005", 18);
            usable = cachedFromBalanceRaw > gasReserve ? cachedFromBalanceRaw - gasReserve : cachedFromBalanceRaw;
        }
        const formatted = formatUnits(usable, cachedFromDecimals);
        fromAmountInput.value = parseFloat(Number(formatted).toFixed(6)).toString();
        fromAmountInput.dispatchEvent(new Event("input"));
    };
    document.getElementById("swap-half-btn")?.addEventListener("click", () => fillSwapBalance("half"));
    document.getElementById("swap-max-btn")?.addEventListener("click", () => fillSwapBalance("max"));

    switchBtn.addEventListener("click", () => {
        const tempSymbol = fromTokenSymbol.innerHTML;
        fromTokenSymbol.innerHTML = toTokenSymbol.innerHTML;
        toTokenSymbol.innerHTML = tempSymbol;

        const tempCa = fromAmountInput.getAttribute("data-ca");
        fromAmountInput.setAttribute(
            "data-ca",
            toAmountInput.getAttribute("data-ca") || "",
        );
        toAmountInput.setAttribute("data-ca", tempCa || "");

        const tempVal = fromAmountInput.value;
        fromAmountInput.value = toAmountInput.value;
        toAmountInput.value = tempVal;

        switchBtn.style.transform = "rotate(180deg)";
        setTimeout(() => {
            switchBtn.style.transform = "";
        }, 300);

        fromAmountInput.dispatchEvent(new Event("input"));
        updateBalances();
    });

    const fromLoading = document.getElementById(
        "from-loading",
    ) as HTMLDivElement;
    const toLoading = document.getElementById("to-loading") as HTMLDivElement;
    let quoteTimeout: ReturnType<typeof setTimeout>;

    fromAmountInput.addEventListener("input", () => {
        lastEditedField = "from";
        clearTimeout(quoteTimeout);
        const val = fromAmountInput.value.trim();
        swapInlineAlert?.classList.add("d-none");

        if (!val || Number(val) <= 0) {
            toAmountInput.value = "";
            toLoading.classList.add("d-none");
            lastQuoteResult = null;
            swapQuoteCard?.classList.add("d-none");
            return;
        }

        const currentReq = ++quoteRequestSeq;
        toLoading.classList.remove("d-none");
        toAmountInput.value = "";
        swapQuoteCard?.classList.add("d-none");

        quoteTimeout = setTimeout(async () => {
            try {
                const tokenIn = fromAmountInput.getAttribute(
                    "data-ca",
                ) as string;
                const tokenOut = toAmountInput.getAttribute(
                    "data-ca",
                ) as string;
                const fee = Number(poolFeeInput.value);
                const [tokenInDecimals, tokenOutDecimals] = await Promise.all([
                    resolveDecimalsCached(tokenIn, swapDecimalsCache),
                    resolveDecimalsCached(tokenOut, swapDecimalsCache),
                ]);

                const amountInBigInt = safeParseUnits(val, tokenInDecimals);
                if (amountInBigInt <= 0n) {
                    toLoading.classList.add("d-none");
                    return;
                }
                const quoteRes = await getBestQuoteForInput(
                    tokenIn,
                    tokenOut,
                    amountInBigInt,
                    fee,
                    publicClient,
                    signClient,
                );

                if (currentReq !== quoteRequestSeq) return;

                if (quoteRes.amount > 0n) {
                    lastQuoteResult = quoteRes;
                    toAmountInput.value = parseFloat(
                        Number(formatUnits(quoteRes.amount, tokenOutDecimals)).toFixed(6),
                    ).toString();
                    renderSwapQuoteSummary();
                } else {
                    lastQuoteResult = null;
                    toAmountInput.value = "";
                    swapQuoteCard?.classList.add("d-none");
                    if (swapInlineAlert) {
                        swapInlineAlert.textContent = quoteRes.error
                            ? "RPC unreachable — cannot fetch live V3 quote right now."
                            : "No liquidity or route found for this pair.";
                        swapInlineAlert.classList.remove("d-none");
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (currentReq === quoteRequestSeq) {
                    toLoading.classList.add("d-none");
                }
            }
        }, 450);
    });

    toAmountInput.addEventListener("input", () => {
        lastEditedField = "to";
        clearTimeout(quoteTimeout);
        const val = toAmountInput.value.trim();
        swapInlineAlert?.classList.add("d-none");

        if (!val || Number(val) <= 0) {
            fromAmountInput.value = "";
            fromLoading.classList.add("d-none");
            lastQuoteResult = null;
            swapQuoteCard?.classList.add("d-none");
            return;
        }

        const currentReq = ++quoteRequestSeq;
        fromLoading.classList.remove("d-none");
        fromAmountInput.value = "";
        swapQuoteCard?.classList.add("d-none");

        quoteTimeout = setTimeout(async () => {
            try {
                const tokenIn = fromAmountInput.getAttribute(
                    "data-ca",
                ) as string;
                const tokenOut = toAmountInput.getAttribute(
                    "data-ca",
                ) as string;
                const fee = Number(poolFeeInput.value);
                const [tokenInDecimals, tokenOutDecimals] = await Promise.all([
                    resolveDecimalsCached(tokenIn, swapDecimalsCache),
                    resolveDecimalsCached(tokenOut, swapDecimalsCache),
                ]);

                const amountOutBigInt = safeParseUnits(val, tokenOutDecimals);
                if (amountOutBigInt <= 0n) {
                    fromLoading.classList.add("d-none");
                    return;
                }
                const quoteRes = await getBestQuoteForOutput(
                    tokenIn,
                    tokenOut,
                    amountOutBigInt,
                    fee,
                    publicClient,
                    signClient,
                );

                if (currentReq !== quoteRequestSeq) return;

                if (quoteRes.amount > 0n) {
                    lastQuoteResult = quoteRes;
                    fromAmountInput.value = parseFloat(
                        Number(formatUnits(quoteRes.amount, tokenInDecimals)).toFixed(6),
                    ).toString();
                    renderSwapQuoteSummary();
                } else {
                    lastQuoteResult = null;
                    fromAmountInput.value = "";
                    swapQuoteCard?.classList.add("d-none");
                    if (swapInlineAlert) {
                        swapInlineAlert.textContent = quoteRes.error
                            ? "RPC unreachable — cannot fetch live V3 quote right now."
                            : "Insufficient liquidity for this exact output.";
                        swapInlineAlert.classList.remove("d-none");
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (currentReq === quoteRequestSeq) {
                    fromLoading.classList.add("d-none");
                }
            }
        }, 450);
    });

    // ==========================================
    // --- Faucet & Discord Auth Logic ---
    // ==========================================
    const discordAuthSection = document.getElementById(
        "discord-auth-section",
    ) as HTMLDivElement;
    const discordLoginBtn = document.getElementById(
        "discord-login-btn",
    ) as HTMLButtonElement;
    const discordUserInfo = document.getElementById(
        "discord-user-info",
    ) as HTMLDivElement;
    const discordUsernameDisplay = document.getElementById(
        "discord-username",
    ) as HTMLSpanElement;
    const discordLogoutBtn = document.getElementById(
        "discord-logout-btn",
    ) as HTMLButtonElement;

    const setDiscordBtnLabel = (label: string) => {
        const span = discordLoginBtn.querySelector(".btn-label");
        if (span) span.textContent = label;
        else discordLoginBtn.textContent = label;
    };

    const checkDiscordSession = async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (session) {
            discordSession = session;
            discordLoginBtn.classList.add("d-none");
            discordUserInfo.classList.remove("d-none");
            // @ts-ignore
            discordUsernameDisplay.textContent =
                session.user.user_metadata.full_name || session.user.email;
        } else {
            discordSession = null;
            discordLoginBtn.classList.remove("d-none");
            discordUserInfo.classList.add("d-none");
        }
        updateFaucetChecklist();
    };
    checkDiscordSession();
    supabase.auth.onAuthStateChange((_event, session) => {
        discordSession = session;
        if (session) {
            discordLoginBtn.classList.add("d-none");
            discordUserInfo.classList.remove("d-none");
            discordUsernameDisplay.textContent =
                session.user.user_metadata?.full_name || session.user.email || "Verified";
        } else {
            discordLoginBtn.classList.remove("d-none");
            discordUserInfo.classList.add("d-none");
        }
        updateFaucetChecklist();
    });

    discordLoginBtn.addEventListener("click", async () => {
        setDiscordBtnLabel("Connecting...");
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "discord",
        });
        if (error) {
            showLog("Failed to login with Discord", "error");
            setDiscordBtnLabel("Login with Discord");
        }
    });

    discordLogoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        discordSession = null;
        checkDiscordSession();
        showLog("Logged out from Discord", "info");
    });

    const handleFaucetClaim = async (
        tokenCa: `0x${string}`,
        tokenName: string,
    ) => {
        if (!isConnected || !account) {
            openModal(connectModal);
            return;
        }

        if (!discordSession) {
            showLog("Please login with Discord first!", "error");
            discordAuthSection.style.borderColor = "var(--error)";
            setTimeout(() => (discordAuthSection.style.borderColor = ""), 2000);
            return;
        }

        const claimBtn = Array.from(
            document.querySelectorAll(".faucet-claim-btn"),
        ).find(
            (btn) => btn.getAttribute("data-ca") === tokenCa,
        ) as HTMLButtonElement;

        if (claimBtn) {
            claimBtn.disabled = true;
            claimBtn.textContent = "Processing...";
        }

        showLog(`Requesting ${tokenName} from secure server...`, "info");

        try {
            const response = await fetch(
                `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/claim-faucet`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${discordSession.access_token}`,
                    },
                    body: JSON.stringify({
                        walletAddress: account.address,
                        tokenCa: tokenCa,
                    }),
                },
            );

            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error || "Failed to claim tokens");

            const displayAmount = tokenName === "sUSDC" ? "0.1" : "10";
            showSuccessDialog({
                title: "Tokens Claimed!",
                actionType: "Faucet",
                txHash: result.txHash,
                tokens: [
                    {
                        symbol: tokenName,
                        amount: displayAmount,
                        address: tokenCa,
                    },
                ],
            });
            await updateBalances();
        } catch (error: any) {
            console.error("Faucet Error:", error);
            showLog(error.message, "error");
        } finally {
            if (claimBtn) {
                claimBtn.disabled = false;
                claimBtn.textContent = `Claim ${tokenName}`;
            }
        }
    };

    claimSusdcBtn?.addEventListener("click", () =>
        handleFaucetClaim(
            claimSusdcBtn.getAttribute("data-ca") as `0x${string}`,
            "sUSDC",
        ),
    );
    claimRftBtn?.addEventListener("click", () =>
        handleFaucetClaim(
            claimRftBtn.getAttribute("data-ca") as `0x${string}`,
            "RFT",
        ),
    );
    claimGmicBtn?.addEventListener("click", () =>
        handleFaucetClaim(
            claimGmicBtn.getAttribute("data-ca") as `0x${string}`,
            "GMIC",
        ),
    );

    // --- Token Modal Logic ---
    const resetTokenSearchState = () => {
        tokenSearchInput.value = "";
        clearSearchBtn.classList.add("d-none");
        tokenSearchLoading.classList.add("d-none");
        noTokenFound.classList.add("d-none");

        const items = tokenListContainer.querySelectorAll(".token-list-item");
        items.forEach((item) => {
            if (item.classList.contains("search-result-item")) {
                item.remove();
            } else {
                item.classList.remove("d-none");
            }
        });
    };

    const openTokenModal = (side: TokenSide) => {
        activeTokenSelectionSide = side;
        resetTokenSearchState();
        openModal(tokenModal);
        setTimeout(() => tokenSearchInput.focus(), 100);
    };

    fromTokenBtn.addEventListener("click", () => openTokenModal("from"));
    toTokenBtn.addEventListener("click", () => openTokenModal("to"));
    poolTokenABtn.addEventListener("click", () => openTokenModal("pool-a"));
    poolTokenBBtn.addEventListener("click", () => openTokenModal("pool-b"));

    clearSearchBtn.addEventListener("click", () => {
        resetTokenSearchState();
        tokenSearchInput.focus();
    });

    tokenListContainer.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;

        if (target.closest(".add-token-btn")) {
            const listItem = target.closest(
                ".search-result-item",
            ) as HTMLElement;

            const symbol = listItem.getAttribute("data-symbol") || "";
            const address = listItem.getAttribute("data-address") || "";
            const name =
                listItem.querySelector(".token-name")?.textContent || "";

            const savedTokens = JSON.parse(
                localStorage.getItem("customTokens") || "[]",
            );
            if (
                !savedTokens.find(
                    (t: Token) =>
                        t.address.toLowerCase() === address.toLowerCase(),
                )
            ) {
                savedTokens.push({ symbol, name, address });
                localStorage.setItem(
                    "customTokens",
                    JSON.stringify(savedTokens),
                );
            }

            showLog("Token added successfully.", "success");
            tokenSearchInput.value = "";
            clearSearchBtn.classList.add("d-none");
            listItem.remove();
            loadCustomTokens();
            filterListBy("");
            return;
        }

        if (target.closest(".delete-token-btn")) {
            e.stopPropagation();
            const deleteBtn = target.closest(
                ".delete-token-btn",
            ) as HTMLElement;
            const addressToRemove = (deleteBtn.getAttribute("data-address") || "").toLowerCase();

            let savedTokens = JSON.parse(
                localStorage.getItem("customTokens") || "[]",
            );
            savedTokens = savedTokens.filter(
                (t: Token) => t.address.toLowerCase() !== addressToRemove,
            );
            localStorage.setItem("customTokens", JSON.stringify(savedTokens));

            const listItem = target.closest(".token-list-item") as HTMLElement;
            listItem.style.opacity = "0";
            setTimeout(() => listItem.remove(), 200);
            showLog("Token removed from list.", "info");
            return;
        }

        if (target.closest(".copy-ca-btn")) {
            e.stopPropagation();
            const copyBtn = target.closest(".copy-ca-btn") as HTMLElement;
            const caToCopy = copyBtn.getAttribute("data-ca") || "";

            navigator.clipboard.writeText(caToCopy).then(() => {
                showLog("Contract address copied!", "success");
                copyBtn.style.color = "var(--success)";
                setTimeout(() => (copyBtn.style.color = ""), 1000);
            });
            return;
        }

        const listItem = target.closest(".token-list-item") as HTMLElement;
        if (
            listItem &&
            activeTokenSelectionSide &&
            !listItem.classList.contains("search-result-item")
        ) {
            const symbol = listItem.getAttribute("data-symbol") || "???";
            const address = listItem.getAttribute("data-address") || "";

            const iconHtml = buildSelectedTokenHtml(symbol, address);

            if (activeTokenSelectionSide === "from") {
                const currentToCa = (toAmountInput.getAttribute("data-ca") || "").toLowerCase();
                if (currentToCa === address.toLowerCase()) {
                    toTokenSymbol.innerHTML = fromTokenSymbol.innerHTML;
                    toAmountInput.setAttribute("data-ca", fromAmountInput.getAttribute("data-ca") || "");
                }
                fromTokenSymbol.innerHTML = iconHtml;
                fromAmountInput.setAttribute("data-ca", address);
                fromAmountInput.dispatchEvent(new Event("input"));
            } else if (activeTokenSelectionSide === "to") {
                const currentFromCa = (fromAmountInput.getAttribute("data-ca") || "").toLowerCase();
                if (currentFromCa === address.toLowerCase()) {
                    fromTokenSymbol.innerHTML = toTokenSymbol.innerHTML;
                    fromAmountInput.setAttribute("data-ca", toAmountInput.getAttribute("data-ca") || "");
                }
                toTokenSymbol.innerHTML = iconHtml;
                toAmountInput.setAttribute("data-ca", address);
                fromAmountInput.dispatchEvent(new Event("input"));
            } else if (activeTokenSelectionSide === "pool-a") {
                const curPoolB = (poolTokenBBtn.getAttribute("data-ca") || "").toLowerCase();
                if (curPoolB === address.toLowerCase() && poolTokenABtn.getAttribute("data-ca")) {
                    poolTokenBSymbol.innerHTML = poolTokenASymbol.innerHTML;
                    const oldA = poolTokenABtn.getAttribute("data-ca") || "";
                    poolTokenBBtn.setAttribute("data-ca", oldA);
                    poolDisplaySymbolB.innerHTML = poolTokenASymbol.innerHTML;
                    poolAmountB.setAttribute("data-ca", oldA);
                }
                poolTokenASymbol.innerHTML = iconHtml;
                poolTokenABtn.setAttribute("data-ca", address);
                poolDisplaySymbolA.innerHTML = iconHtml;
                poolAmountA.setAttribute("data-ca", address);
            } else if (activeTokenSelectionSide === "pool-b") {
                const curPoolA = (poolTokenABtn.getAttribute("data-ca") || "").toLowerCase();
                if (curPoolA === address.toLowerCase() && poolTokenBBtn.getAttribute("data-ca")) {
                    poolTokenASymbol.innerHTML = poolTokenBSymbol.innerHTML;
                    const oldB = poolTokenBBtn.getAttribute("data-ca") || "";
                    poolTokenABtn.setAttribute("data-ca", oldB);
                    poolDisplaySymbolA.innerHTML = poolTokenBSymbol.innerHTML;
                    poolAmountA.setAttribute("data-ca", oldB);
                }
                poolTokenBSymbol.innerHTML = iconHtml;
                poolTokenBBtn.setAttribute("data-ca", address);
                poolDisplaySymbolB.innerHTML = iconHtml;
                poolAmountB.setAttribute("data-ca", address);
            }

            if (
                activeTokenSelectionSide === "pool-a" ||
                activeTokenSelectionSide === "pool-b"
            ) {
                const curSymA = getCleanTokenSymbol(poolTokenASymbol, "");
                const curCaA = poolTokenABtn.getAttribute("data-ca") || "";
                const curSymB = getCleanTokenSymbol(poolTokenBSymbol, "");
                const curCaB = poolTokenBBtn.getAttribute("data-ca") || "";
                if (curCaA && curCaB) {
                    localStorage.setItem(
                        "rift_pool_selected_pair",
                        JSON.stringify({
                            symA: curSymA,
                            caA: curCaA,
                            symB: curSymB,
                            caB: curCaB,
                            fee: selectedFee,
                        }),
                    );
                }
            }

            closeModal(tokenModal);
            activeTokenSelectionSide = null;
            updateBalances();
            checkPoolStatus();
        }
    });

    let searchTimeout: ReturnType<typeof setTimeout>;
    let abortController: AbortController | null = null;

    tokenSearchInput.addEventListener("input", async (e) => {
        const query = (e.target as HTMLInputElement).value.trim();

        if (query.length > 0) {
            clearSearchBtn.classList.remove("d-none");
        } else {
            clearSearchBtn.classList.add("d-none");
        }

        if (searchTimeout) clearTimeout(searchTimeout);
        if (abortController) abortController.abort();

        const existingResults = tokenListContainer.querySelectorAll(
            ".search-result-item",
        );
        existingResults.forEach((el) => el.remove());

        if (query.startsWith("0x") && query.length === 42) {
            const existingToken = Array.from(
                tokenListContainer.querySelectorAll(
                    ".token-list-item:not(.search-result-item)",
                ),
            ).find(
                (item) =>
                    item.getAttribute("data-address")?.toLowerCase() ===
                    query.toLowerCase(),
            );
            if (existingToken) {
                filterListBy(query);
                return;
            }

            tokenSearchLoading.classList.remove("d-none");
            noTokenFound.classList.add("d-none");

            const items =
                tokenListContainer.querySelectorAll(".token-list-item");
            items.forEach((item) => item.classList.add("d-none"));

            abortController = new AbortController();
            const signal = abortController.signal;

            searchTimeout = setTimeout(async () => {
                try {
                    if (signal.aborted) return;
                    const name = (await publicClient.readContract({
                        address: query as `0x${string}`,
                        abi: erc20Abi,
                        functionName: "name",
                    })) as string;

                    const symbol = (await publicClient.readContract({
                        address: query as `0x${string}`,
                        abi: erc20Abi,
                        functionName: "symbol",
                    })) as string;

                    if (signal.aborted) return;

                    const simulatedToken: Token = {
                        symbol,
                        name,
                        address: query.toLowerCase(),
                    };
                    tokenSearchLoading.classList.add("d-none");
                    renderSearchResultToken(simulatedToken);
                } catch {
                    if (signal.aborted) return;
                    tokenSearchLoading.classList.add("d-none");
                    noTokenFound.classList.remove("d-none");
                }
            }, 500);
        } else {
            tokenSearchLoading.classList.add("d-none");
            filterListBy(query);
        }
    });

    const filterListBy = (query: string) => {
        let foundAny = false;
        const items = tokenListContainer.querySelectorAll(
            ".token-list-item:not(.search-result-item)",
        );
        items.forEach((item) => {
            const symbol =
                item.getAttribute("data-symbol")?.toLowerCase() || "";
            const address =
                item.getAttribute("data-address")?.toLowerCase() || "";
            const name = (
                item.querySelector(".token-name") as HTMLElement
            ).innerText.toLowerCase();

            if (
                symbol.includes(query.toLowerCase()) ||
                name.includes(query.toLowerCase()) ||
                address === query.toLowerCase()
            ) {
                item.classList.remove("d-none");
                foundAny = true;
            } else {
                item.classList.add("d-none");
            }
        });

        if (!foundAny && query.length > 0) {
            noTokenFound.classList.remove("d-none");
        } else {
            noTokenFound.classList.add("d-none");
        }
    };

    const renderSearchResultToken = (token: Token) => {
        const div = document.createElement("div");
        div.className = "token-list-item search-result-item";
        div.setAttribute("data-symbol", token.symbol);
        div.setAttribute("data-address", token.address);

        const bgColor = getColorFromAddress(token.address, token.symbol);
        const shortAddr = shortenAddress(token.address);
        const safeSym = escapeHtml(token.symbol);
        const safeName = escapeHtml(token.name);

        div.innerHTML = `
        <div class="ts-flex-w100">
            <div class="token-icon ts-token-icon" style="background: ${bgColor}; color: white; overflow: hidden; padding: 0;">
                ${buildTokenIconInnerHtml(token.symbol, token.address)}
            </div>
            <div class="token-info ts-token-info-wrapper">
                <div class="ts-token-header">
                    <span class="token-symbol">${safeSym}</span>
                </div>
                <div class="ts-token-meta">
                    <span class="token-name">${safeName}</span>
                    <span class="ts-token-dot">•</span>
                    <span class="ts-token-address">${shortAddr}</span>
                </div>
            </div>
        </div>
        <button class="secondary-btn glass-btn add-token-btn ts-token-add-btn">Add</button>
    `;
        tokenListContainer.prepend(div);
    };

    closeConnectModalBtn.addEventListener("click", () =>
        closeModal(connectModal),
    );
    closeSettingsModalBtn.addEventListener("click", () =>
        closeModal(settingsModal),
    );
    closeTokenModalBtn.addEventListener("click", () => closeModal(tokenModal));

    const modals = [connectModal, settingsModal, tokenModal];
    modals.forEach((modal) => {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeModal(connectModal);
            closeModal(settingsModal);
            closeModal(tokenModal);
            closeModal(successModal);
            closeModal(document.getElementById("action-modal") as HTMLDivElement);
            networkDropdown.classList.add("hidden");
            walletDropdown.classList.add("hidden");
        }
    });

    setTimeout(() => {
        showLog("Welcome to Rift DEX!", "success");
    }, 500);

    // ==========================================
    // --- Pool UI Navigation & Toggles ---
    // ==========================================
    btnBackToList.addEventListener("click", () => {
        setPoolSubView("my-positions", false, true);
    });

    btnBackFromPositions.addEventListener("click", () => {
        setPoolSubView("dashboard", false, true);
    });

    btnMyPositions.addEventListener("click", () => {
        setPoolSubView("my-positions", true, true);
    });

    btnNewPosition.addEventListener("click", () => {
        setPoolSubView("new-position", false, true);
        checkPoolStatus();
    });

    btnBackToPool.addEventListener("click", () => {
        setPoolSubView("dashboard", false, true);
    });

    const fullRangeToggle = document.getElementById(
        "full-range-toggle",
    ) as HTMLInputElement;
    const rangeLabel = document.getElementById(
        "range-label",
    ) as HTMLSpanElement;
    const minPriceInput = document.getElementById(
        "min-price-input",
    ) as HTMLInputElement;
    const maxPriceInput = document.getElementById(
        "max-price-input",
    ) as HTMLInputElement;

    const poolRpcBanner = document.getElementById("pool-rpc-banner") as HTMLDivElement | null;
    const poolRpcBannerText = document.getElementById("pool-rpc-banner-text") as HTMLSpanElement | null;
    const poolRetryBtn = document.getElementById("pool-retry-btn") as HTMLButtonElement | null;
    const poolRangeStatusBadge = document.getElementById("pool-range-status-badge") as HTMLSpanElement | null;
    const rangeWarningMsg = document.getElementById("range-warning-msg") as HTMLDivElement | null;
    const rangePresetBtns = document.querySelectorAll(".range-preset-btn");

    document.getElementById("btn-refresh-positions")?.addEventListener("click", () => {
        loadUserPositions();
    });

    const fillPoolMax = (side: "A" | "B") => {
        if (!isConnected) return;
        const ca = (side === "A" ? poolTokenABtn : poolTokenBBtn).getAttribute("data-ca") || "";
        const raw = side === "A" ? cachedPoolBalARaw : cachedPoolBalBRaw;
        const dec = side === "A" ? currentDecA : currentDecB;
        if (raw <= 0n) return;
        let usable = raw;
        if (ca === NATIVE_TOKEN) {
            const reserve = parseUnits("0.005", 18);
            usable = raw > reserve ? raw - reserve : raw;
        }
        const input = side === "A" ? poolAmountA : poolAmountB;
        input.value = parseFloat(Number(formatUnits(usable, dec)).toFixed(6)).toString();
        input.dispatchEvent(new Event("input"));
    };
    document.getElementById("pool-max-a-btn")?.addEventListener("click", () => fillPoolMax("A"));
    document.getElementById("pool-max-b-btn")?.addEventListener("click", () => fillPoolMax("B"));

    rangePresetBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const curPrice = Number(poolCurrentPriceDisplay.textContent?.trim() || "0");
            if (!Number.isFinite(curPrice) || curPrice <= 0) return;
            const pct = Number(btn.getAttribute("data-pct") || "15") / 100;
            fullRangeToggle.checked = false;
            rangeLabel.textContent = "Custom";
            rangeLabel.style.color = "var(--text-secondary)";
            minPriceInput.disabled = false;
            minPriceInput.style.opacity = "1";
            maxPriceInput.disabled = false;
            maxPriceInput.style.opacity = "1";

            minPriceInput.value = parseFloat((curPrice * (1 - pct)).toFixed(6)).toString();
            maxPriceInput.value = parseFloat((curPrice * (1 + pct)).toFixed(6)).toString();
            rangePresetBtns.forEach((b) => b.classList.toggle("active", b === btn));
            handleRangeChange();
        });
    });

    fullRangeToggle.addEventListener("change", (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        rangePresetBtns.forEach((b) => b.classList.remove("active"));
        if (isChecked) {
            rangeLabel.textContent = "Full Range";
            rangeLabel.style.color = "var(--success)";
            minPriceInput.value = "0";
            minPriceInput.disabled = true;
            minPriceInput.style.opacity = "0.5";
            maxPriceInput.value = "∞";
            maxPriceInput.disabled = true;
            maxPriceInput.style.opacity = "0.5";
        } else {
            rangeLabel.textContent = "Custom";
            rangeLabel.style.color = "var(--text-secondary)";
            minPriceInput.value = "";
            minPriceInput.disabled = false;
            minPriceInput.style.opacity = "1";
            maxPriceInput.value = "";
            maxPriceInput.disabled = false;
            maxPriceInput.style.opacity = "1";
        }
        handleRangeChange();
    });

    const initPriceContainer = document.getElementById(
        "init-price-container",
    ) as HTMLDivElement;
    const initPriceInput = document.getElementById(
        "init-price-input",
    ) as HTMLInputElement;
    const initPriceRatioText = document.getElementById(
        "init-price-ratio-text",
    ) as HTMLSpanElement;
    const poolCurrentPriceDisplay = document.getElementById(
        "pool-current-price",
    ) as HTMLSpanElement;
    const rangeSettingsPanel = document.getElementById(
        "range-settings-panel",
    ) as HTMLDivElement;
    const poolActionBtn = document.getElementById(
        "pool-action-btn",
    ) as HTMLButtonElement;

    const updateInitPriceRatio = () => {
        const symbolA = getCleanTokenSymbol(poolTokenASymbol, "A");
        const symbolB = getCleanTokenSymbol(poolTokenBSymbol, "B");
        const val = initPriceInput.value || "0";
        initPriceRatioText.textContent = `1 ${symbolA} = ${val} ${symbolB}`;

        if (Number(val) > 0 && !isPoolExists) {
            poolActionBtn.disabled = false;
        } else if (!isPoolExists) {
            poolActionBtn.disabled = true;
        }
    };

    initPriceInput.addEventListener("input", updateInitPriceRatio);

    const isNewPositionViewActive = () => {
        return (
            !viewPool.classList.contains("d-none") &&
            !poolNewPosition.classList.contains("d-none")
        );
    };

    const checkPoolStatus = async () => {
        const caA = poolTokenABtn.getAttribute("data-ca") as string;
        const caB = poolTokenBBtn.getAttribute("data-ca") as string;
        poolRpcBanner?.classList.add("d-none");

        if (
            !caA ||
            !caB ||
            (caA !== NATIVE_TOKEN &&
                caA === "0x0000000000000000000000000000000000000000" &&
                !getCleanTokenSymbol(poolTokenASymbol))
        ) {
            rangeSettingsPanel.classList.add("d-none");
            initPriceContainer.classList.add("d-none");
            depositWrapperA.classList.add("d-none");
            depositWrapperB.classList.add("d-none");
            poolActionBtn.classList.remove("btn-info-accent");
            poolActionBtn.textContent = "Select Tokens";
            poolActionBtn.disabled = true;
            if (isNewPositionViewActive()) {
                updateBrowserUrl("/pool/none", true);
            }
            return;
        }

        if (caA.toLowerCase() === caB.toLowerCase()) {
            rangeSettingsPanel.classList.add("d-none");
            initPriceContainer.classList.add("d-none");
            depositWrapperA.classList.add("d-none");
            depositWrapperB.classList.add("d-none");
            poolActionBtn.classList.remove("btn-info-accent");
            poolActionBtn.textContent = "Invalid Pair";
            poolActionBtn.disabled = true;
            if (isNewPositionViewActive()) {
                updateBrowserUrl("/pool/none", true);
            }
            return;
        }

        poolActionBtn.classList.remove("btn-info-accent");
        poolActionBtn.textContent = "Checking pool state...";
        poolActionBtn.disabled = true;

        // Replace native token placeholder with WSIZE for on-chain reads
        const actualCaA = caA === NATIVE_TOKEN ? WSIZE : caA;
        const actualCaB = caB === NATIVE_TOKEN ? WSIZE : caB;

        try {
            const [fetchedPoolAddress, decA, decB] = await Promise.all([
                getPoolWithDirectCall(
                    actualCaA as `0x${string}`,
                    actualCaB as `0x${string}`,
                    selectedFee,
                    publicClient,
                ),
                resolveDecimalsCached(caA, swapDecimalsCache),
                resolveDecimalsCached(caB, swapDecimalsCache),
            ]);

            currentDecA = decA;
            currentDecB = decB;

            if (fetchedPoolAddress === zeroAddress) {
                isPoolExists = false;
                currentPoolAddress = null;
                currentRangeState = null;

                if (isNewPositionViewActive()) {
                    updateBrowserUrl("/pool/none");
                }

                rangeSettingsPanel.classList.add("d-none");
                depositWrapperA.classList.add("d-none");
                depositWrapperB.classList.add("d-none");

                initPriceContainer.classList.remove("d-none");
                updateInitPriceRatio();

                poolActionBtn.textContent = "Create & Initialize Price";
                poolActionBtn.classList.add("btn-info-accent");
                poolActionBtn.disabled = Number(initPriceInput.value) <= 0;
            } else {
                isPoolExists = true;
                currentPoolAddress = fetchedPoolAddress;

                if (isNewPositionViewActive()) {
                    updateBrowserUrl(`/pool/${fetchedPoolAddress}`);
                }

                initPriceContainer.classList.add("d-none");
                rangeSettingsPanel.classList.remove("d-none");
                depositWrapperA.classList.add("d-none");
                depositWrapperB.classList.add("d-none");

                poolActionBtn.classList.remove("btn-info-accent");
                poolActionBtn.textContent = "Reading pool price...";
                poolActionBtn.disabled = true;

                const [token0] = sortAddresses(
                    actualCaA as `0x${string}`,
                    actualCaB as `0x${string}`,
                );
                const isTokenA0 = actualCaA.toLowerCase() === token0.toLowerCase();

                const rawSqrtPriceX96 = await readRawSqrtPriceX96(
                    currentPoolAddress,
                    publicClient,
                );

                const displayPrice = getDisplayPriceFromSqrtX96(
                    rawSqrtPriceX96,
                    currentDecA,
                    currentDecB,
                    isTokenA0,
                );

                poolCurrentPriceDisplay.textContent = displayPrice;
                poolCurrentPriceDisplay.classList.add("text-primary-color");
                poolActionBtn.textContent = "Set Price Range";

                handleRangeChange();
            }
        } catch (error) {
            console.error("Error checking pool:", error);
            poolActionBtn.textContent = "RPC Unavailable";
            poolActionBtn.disabled = true;
            if (poolRpcBanner && poolRpcBannerText) {
                poolRpcBannerText.textContent =
                    "Seismic Testnet RPC did not respond while reading this pool.";
                poolRpcBanner.classList.remove("d-none");
            }
        }
    };

    poolRetryBtn?.addEventListener("click", () => {
        checkRpcHealth();
        checkPoolStatus();
    });

    const handleRangeChange = () => {
        if (!isPoolExists || !poolCurrentPriceDisplay.textContent) return;

        const minStr = minPriceInput.value.trim();
        const maxStr = maxPriceInput.value.trim();
        const safeMaxStr = maxStr === "∞" ? "99999999999999999" : maxStr;

        rangeWarningMsg?.classList.add("d-none");

        if (!minStr || !maxStr) {
            depositWrapperA.classList.add("d-none");
            depositWrapperB.classList.add("d-none");
            poolRangeStatusBadge?.classList.add("d-none");
            poolActionBtn.textContent = "Enter Price Range";
            poolActionBtn.disabled = true;
            currentRangeState = null;
            return;
        }

        const caA = poolTokenABtn.getAttribute("data-ca") as string;
        const caB = poolTokenBBtn.getAttribute("data-ca") as string;
        const actualCaA = caA === NATIVE_TOKEN ? WSIZE : caA;
        const actualCaB = caB === NATIVE_TOKEN ? WSIZE : caB;

        const [token0] = sortAddresses(
            actualCaA as `0x${string}`,
            actualCaB as `0x${string}`,
        );
        const isTokenA0 = actualCaA.toLowerCase() === token0.toLowerCase();

        const currentSqrt = getSqrtPriceFromUI(
            poolCurrentPriceDisplay.textContent.trim(),
            currentDecA,
            currentDecB,
            isTokenA0,
        );

        const minNum = minStr === "0" ? 0 : Number(minStr);
        const maxNum = maxStr === "∞" ? Number.POSITIVE_INFINITY : Number(safeMaxStr);
        if (!Number.isFinite(minNum) || Number.isNaN(maxNum) || minNum < 0 || minNum >= maxNum) {
            depositWrapperA.classList.add("d-none");
            depositWrapperB.classList.add("d-none");
            rangeWarningMsg?.classList.remove("d-none");
            if (poolRangeStatusBadge) {
                poolRangeStatusBadge.textContent = "Invalid Range";
                poolRangeStatusBadge.className = "range-status-pill invalid";
            }
            poolActionBtn.textContent = "Invalid Price Range";
            poolActionBtn.disabled = true;
            currentRangeState = null;
            return;
        }

        const minSqrt =
            minStr === "0"
                ? 4295128739n
                : getSqrtPriceFromUI(
                      minStr,
                      currentDecA,
                      currentDecB,
                      isTokenA0,
                  );
        const maxSqrt =
            maxStr === "∞"
                ? 1461446703485210103287273052203988822378723970342n
                : getSqrtPriceFromUI(
                      safeMaxStr,
                      currentDecA,
                      currentDecB,
                      isTokenA0,
                  );

        const realMinSqrt = minSqrt < maxSqrt ? minSqrt : maxSqrt;
        const realMaxSqrt = minSqrt < maxSqrt ? maxSqrt : minSqrt;

        if (currentSqrt <= realMinSqrt) {
            currentRangeState = "BELOW_RANGE";
        } else if (currentSqrt >= realMaxSqrt) {
            currentRangeState = "ABOVE_RANGE";
        } else {
            currentRangeState = "IN_RANGE";
        }

        if (poolRangeStatusBadge) {
            if (currentRangeState === "IN_RANGE") {
                poolRangeStatusBadge.textContent = "In Range • Dual Deposit";
                poolRangeStatusBadge.className = "range-status-pill in-range";
            } else {
                poolRangeStatusBadge.textContent = "Out of Range • Single-Sided";
                poolRangeStatusBadge.className = "range-status-pill single-sided";
            }
        }

        if (currentRangeState === "IN_RANGE") {
            depositWrapperA.classList.remove("d-none");
            depositWrapperB.classList.remove("d-none");
            poolAmountA.disabled = false;
            poolAmountB.disabled = false;
        } else {
            if (currentRangeState === "BELOW_RANGE") {
                if (isTokenA0) {
                    depositWrapperA.classList.remove("d-none");
                    depositWrapperB.classList.add("d-none");
                    poolAmountA.disabled = false;
                    poolAmountB.disabled = true;
                    poolAmountB.value = "0";
                } else {
                    depositWrapperB.classList.remove("d-none");
                    depositWrapperA.classList.add("d-none");
                    poolAmountB.disabled = false;
                    poolAmountA.disabled = true;
                    poolAmountA.value = "0";
                }
            } else if (currentRangeState === "ABOVE_RANGE") {
                if (isTokenA0) {
                    depositWrapperB.classList.remove("d-none");
                    depositWrapperA.classList.add("d-none");
                    poolAmountB.disabled = false;
                    poolAmountA.disabled = true;
                    poolAmountA.value = "0";
                } else {
                    depositWrapperA.classList.remove("d-none");
                    depositWrapperB.classList.add("d-none");
                    poolAmountA.disabled = false;
                    poolAmountB.disabled = true;
                    poolAmountB.value = "0";
                }
            }
        }
        checkReadyToMint();
    };

    const checkReadyToMint = () => {
        if (!isPoolExists) return;
        const valA = Number(poolAmountA.value) || 0;
        const valB = Number(poolAmountB.value) || 0;

        if (currentRangeState === "IN_RANGE" && valA > 0 && valB > 0) {
            poolActionBtn.textContent = "Add Liquidity";
            poolActionBtn.disabled = false;
        } else if (
            currentRangeState === "BELOW_RANGE" ||
            currentRangeState === "ABOVE_RANGE"
        ) {
            if (valA > 0 || valB > 0) {
                poolActionBtn.textContent = "Add Liquidity";
                poolActionBtn.disabled = false;
            } else {
                poolActionBtn.textContent = "Enter Amount";
                poolActionBtn.disabled = true;
            }
        } else {
            poolActionBtn.textContent = "Enter Amount";
            poolActionBtn.disabled = true;
        }
    };

    // ==========================================
    // --- V3 Auto-Filler Logic ---
    // ==========================================
    const formatDisplaySafe = (weiAmount: bigint, decimals: number) => {
        const val = formatUnits(weiAmount, decimals);
        const parts = val.split(".");
        if (parts.length === 1) return parts[0];

        const cleanDec = parts[1].slice(0, 6).replace(/0+$/, "");
        return cleanDec.length > 0 ? `${parts[0]}.${cleanDec}` : parts[0];
    };

    const autoFillOpposite = (source: "A" | "B") => {
        console.log("====== AUTO-FILL TRIGGERED ======");

        if (currentRangeState !== "IN_RANGE") {
            checkReadyToMint();
            return;
        }

        const caA = poolTokenABtn.getAttribute("data-ca") as string;
        const caB = poolTokenBBtn.getAttribute("data-ca") as string;

        if (!caA || !caB) return;

        const actualCaA = caA === NATIVE_TOKEN ? WSIZE : caA;
        const actualCaB = caB === NATIVE_TOKEN ? WSIZE : caB;

        const [token0] = sortAddresses(
            actualCaA as `0x${string}`,
            actualCaB as `0x${string}`,
        );
        const isTokenA0 = actualCaA === token0;

        const decA = currentDecA || 18;
        const decB = currentDecB || 18;

        const minStr = minPriceInput.value;
        const maxStr =
            maxPriceInput.value === "∞"
                ? "99999999999999999"
                : maxPriceInput.value;
        const displayPriceStr =
            poolCurrentPriceDisplay.textContent?.trim() || "0";

        let sqrtPriceX96: bigint;
        try {
            sqrtPriceX96 = getSqrtPriceFromUI(
                displayPriceStr,
                decA,
                decB,
                isTokenA0,
            );
        } catch (e) {
            console.error("Failed to calc current sqrtPriceX96:", e);
            return;
        }

        let sqrtRatioAX96: bigint;
        let sqrtRatioBX96: bigint;

        try {
            if (minStr === "0" || Number(minStr) <= 0) {
                sqrtRatioAX96 = 4295128739n;
            } else {
                sqrtRatioAX96 = getSqrtPriceFromUI(
                    minStr,
                    decA,
                    decB,
                    isTokenA0,
                );
            }

            if (maxStr === "∞" || Number(maxStr) > 999999999) {
                sqrtRatioBX96 =
                    1461446703485210103287273052203988822378723970342n;
            } else {
                sqrtRatioBX96 = getSqrtPriceFromUI(
                    maxStr,
                    decA,
                    decB,
                    isTokenA0,
                );
            }
        } catch (error) {
            console.error("Math error in range calculation:", error);
            return;
        }

        if (sqrtRatioAX96 > sqrtRatioBX96) {
            [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
        }

        if (source === "A") {
            const valA = Number(poolAmountA.value);
            if (valA > 0) {
                try {
                    const amountWei = safeParseUnits(poolAmountA.value, decA);
                    let L, amountBWei;

                    if (isTokenA0) {
                        L = getLiquidityForAmount0(
                            sqrtPriceX96,
                            sqrtRatioBX96,
                            amountWei,
                        );
                        amountBWei = getAmount1ForLiquidity(
                            sqrtRatioAX96,
                            sqrtPriceX96,
                            L,
                        );
                    } else {
                        L = getLiquidityForAmount1(
                            sqrtRatioAX96,
                            sqrtPriceX96,
                            amountWei,
                        );
                        amountBWei = getAmount0ForLiquidity(
                            sqrtPriceX96,
                            sqrtRatioBX96,
                            L,
                        );
                    }

                    poolAmountB.value = formatDisplaySafe(amountBWei, decB);
                } catch (calcErr) {
                    console.error("Calculation failed:", calcErr);
                }
            } else {
                poolAmountB.value = "";
            }
        } else {
            const valB = Number(poolAmountB.value);
            if (valB > 0) {
                try {
                    const amountWei = safeParseUnits(poolAmountB.value, decB);
                    let L, amountAWei;

                    if (!isTokenA0) {
                        L = getLiquidityForAmount0(
                            sqrtPriceX96,
                            sqrtRatioBX96,
                            amountWei,
                        );
                        amountAWei = getAmount1ForLiquidity(
                            sqrtRatioAX96,
                            sqrtPriceX96,
                            L,
                        );
                    } else {
                        L = getLiquidityForAmount1(
                            sqrtRatioAX96,
                            sqrtPriceX96,
                            amountWei,
                        );
                        amountAWei = getAmount0ForLiquidity(
                            sqrtPriceX96,
                            sqrtRatioBX96,
                            L,
                        );
                    }

                    poolAmountA.value = formatDisplaySafe(amountAWei, decA);
                } catch (calcErr) {
                    console.error("Calculation failed:", calcErr);
                }
            } else {
                poolAmountA.value = "";
            }
        }
        checkReadyToMint();
    };

    minPriceInput.addEventListener("input", () => {
        rangePresetBtns.forEach((b) => b.classList.remove("active"));
        handleRangeChange();
    });
    maxPriceInput.addEventListener("input", () => {
        rangePresetBtns.forEach((b) => b.classList.remove("active"));
        handleRangeChange();
    });

    poolAmountA.addEventListener("input", () => autoFillOpposite("A"));
    poolAmountB.addEventListener("input", () => autoFillOpposite("B"));

    initPriceInput.addEventListener("input", updateInitPriceRatio);

    feeCards.forEach((card) => {
        card.addEventListener("click", (e) => {
            const currentCard = e.currentTarget as HTMLElement;
            const feeVal = Number(currentCard.getAttribute("data-fee"));
            setFeeTierUI(feeVal);
            checkPoolStatus();
        });
    });

    // ==========================================
    // --- Pool Execution (Create & Mint) ---
    // ==========================================
    poolActionBtn.addEventListener("click", async () => {
        if (!isConnected) {
            openModal(connectModal);
            return;
        }

        const caA = poolTokenABtn.getAttribute("data-ca") as string;
        const caB = poolTokenBBtn.getAttribute("data-ca") as string;

        const cleanPoolSymA = getCleanTokenSymbol(poolTokenASymbol, "A");
        const cleanPoolSymB = getCleanTokenSymbol(poolTokenBSymbol, "B");

        if (
            !caA ||
            !caB ||
            (caA !== NATIVE_TOKEN &&
                caA === "0x0000000000000000000000000000000000000000" &&
                !getCleanTokenSymbol(poolTokenASymbol))
        ) {
            showLog("Please select both tokens.", "error");
            return;
        }

        if (!isPoolExists) {
            const initPriceVal = initPriceInput.value.trim();

            if (!initPriceVal || Number(initPriceVal) <= 0) {
                showLog("Please enter a valid initial price.", "error");
                return;
            }

            try {
                poolActionBtn.disabled = true;
                poolActionBtn.textContent = "Initializing Pool...";
                showLog("loading liquidity process", "info");

                const actualCaA = caA === NATIVE_TOKEN ? WSIZE : caA;
                const actualCaB = caB === NATIVE_TOKEN ? WSIZE : caB;

                const isTokenA0 =
                    actualCaA.toLowerCase() ===
                    sortAddresses(
                        actualCaA as `0x${string}`,
                        actualCaB as `0x${string}`,
                    )[0].toLowerCase();
                const sqrtPriceX96 = getSqrtPriceFromUI(
                    initPriceVal,
                    currentDecA,
                    currentDecB,
                    isTokenA0,
                );

                const created = await createPool(
                    caA,
                    caB,
                    selectedFee,
                    sqrtPriceX96,
                    signClient,
                    publicClient,
                );

                if (created) {
                    showSuccessDialog({
                        title: "Pool Created!",
                        actionType: "PoolCreated",
                        txHash: created.txHash,
                        tokens: [
                            {
                                symbol: cleanPoolSymA,
                                address: caA,
                            },
                            {
                                symbol: cleanPoolSymB,
                                address: caB,
                            },
                        ],
                    });
                    await checkPoolStatus();
                } else {
                    throw new Error("Pool address returned null");
                }
            } catch (error) {
                console.error("Initialization error:", error);
                showLog("Pool creation failed or was rejected.", "error");
                poolActionBtn.disabled = false;
                poolActionBtn.textContent = "Create & Initialize Price";
            }
        } else {
            const valA = poolAmountA.value.trim();
            const valB = poolAmountB.value.trim();

            if (!valA && !valB) {
                showLog("Please enter deposit amounts.", "error");
                return;
            }

            if (!poolAmountA.disabled && (!valA || Number(valA) <= 0)) {
                showLog("Please enter a valid amount for Token A.", "error");
                return;
            }
            if (!poolAmountB.disabled && (!valB || Number(valB) <= 0)) {
                showLog("Please enter a valid amount for Token B.", "error");
                return;
            }

            try {
                poolActionBtn.disabled = true;

                const amountADesired = poolAmountA.disabled
                    ? 0n
                    : safeParseUnits(valA, currentDecA);
                const amountBDesired = poolAmountB.disabled
                    ? 0n
                    : safeParseUnits(valB, currentDecB);

                poolActionBtn.textContent = "Checking Balances...";

                const [balA, balB] = await Promise.all([
                    getTokenBalance(
                        caA,
                        account.address,
                        publicClient,
                        signClient,
                    ),
                    getTokenBalance(
                        caB,
                        account.address,
                        publicClient,
                        signClient,
                    ),
                ]);

                if (balA < amountADesired) {
                    showLog(`Insufficient ${cleanPoolSymA} balance!`, "error");
                    return;
                }
                if (balB < amountBDesired) {
                    showLog(`Insufficient ${cleanPoolSymB} balance!`, "error");
                    return;
                }

                const positionManagerAddress =
                    "0xCF1e20C1063B8037A3D281D85Af00a915cC84025" as `0x${string}`;

                poolActionBtn.textContent = "Checking Allowances...";

                const checkAndApprove = async (
                    tokenCa: string,
                    symbol: string | null,
                    amountNeeded: bigint,
                ) => {
                    // Skip native token in approval check
                    if (
                        amountNeeded <= 0n ||
                        tokenCa === NATIVE_TOKEN ||
                        tokenCa === zeroAddress
                    )
                        return;

                    let allowance = await getTokenAllowance(
                        tokenCa,
                        account.address,
                        positionManagerAddress,
                        publicClient,
                        signClient,
                    );

                    if (allowance < amountNeeded) {
                        poolActionBtn.textContent = `Approving ${symbol}...`;
                        showLog(`Requesting approval for ${symbol}...`, "info");
                        const isApproved = await approve(
                            tokenCa as `0x${string}`,
                            positionManagerAddress,
                            maxUint256,
                            signClient,
                            publicClient,
                        );
                        if (!isApproved)
                            throw new Error(`Approval for ${symbol} failed`);

                        poolActionBtn.textContent = "Syncing Network...";
                        let retries = 0;
                        while (allowance < amountNeeded && retries < 10) {
                            await new Promise((res) => setTimeout(res, 1500));
                            allowance = await getTokenAllowance(
                                tokenCa,
                                account.address,
                                positionManagerAddress,
                                publicClient,
                                signClient,
                            );
                            retries++;
                        }
                    }
                };

                await checkAndApprove(caA, cleanPoolSymA, amountADesired);
                await checkAndApprove(caB, cleanPoolSymB, amountBDesired);

                poolActionBtn.textContent = "Minting Position...";
                showLog(
                    "Adding liquidity to the pool. Confirming transaction...",
                    "info",
                );

                const minStr = minPriceInput.value || "0";
                const maxStr =
                    maxPriceInput.value === "∞"
                        ? "99999999999999999"
                        : maxPriceInput.value || "99999999999999999";

                const actualCaA = caA === NATIVE_TOKEN ? WSIZE : caA;
                const actualCaB = caB === NATIVE_TOKEN ? WSIZE : caB;

                const isTokenA0 =
                    actualCaA.toLowerCase() ===
                    sortAddresses(
                        actualCaA as `0x${string}`,
                        actualCaB as `0x${string}`,
                    )[0].toLowerCase();

                const t1 = priceToTick(
                    minStr,
                    currentDecA,
                    currentDecB,
                    isTokenA0,
                    selectedFee,
                );
                const t2 = priceToTick(
                    maxStr,
                    currentDecA,
                    currentDecB,
                    isTokenA0,
                    selectedFee,
                );

                const tickLower = Math.min(t1, t2);
                const tickUpper = Math.max(t1, t2);
                const deadline = BigInt(
                    Math.floor(Date.now() / 1000) +
                        Number(deadlineInput.value) * 60,
                );

                const mintResult = await mint(
                    caA,
                    caB,
                    selectedFee,
                    tickLower,
                    tickUpper,
                    amountADesired,
                    amountBDesired,
                    0n,
                    0n,
                    account.address,
                    deadline,
                    publicClient,
                    signClient,
                );

                if (mintResult) {
                    showSuccessDialog({
                        title: "Liquidity Added!",
                        actionType: "AddLiquidity",
                        txHash: mintResult.txHash,
                        tokens: [
                            {
                                symbol: cleanPoolSymA,
                                amount: valA,
                                address: caA,
                            },
                            {
                                symbol: cleanPoolSymB,
                                amount: valB,
                                address: caB,
                            },
                        ],
                    });
                    poolAmountA.value = "";
                    poolAmountB.value = "";
                    if (!fullRangeToggle.checked) {
                        minPriceInput.value = "";
                        maxPriceInput.value = "";
                    }
                    updateBalances();
                    checkPoolStatus();
                } else {
                    throw new Error("Minting returned a null tokenId");
                }
            } catch (error) {
                console.error("Minting error:", error);
                showLog(
                    "Failed to add liquidity (See console for details).",
                    "error",
                );
            } finally {
                poolActionBtn.disabled = false;
                poolActionBtn.textContent = "Add Liquidity";
            }
        }
    });

    // ==========================================
    // --- Positions Dashboard Logic ---
    // ==========================================
    const positionsListContainer = document.getElementById(
        "positions-list-container",
    ) as HTMLDivElement;
    const positionsLoading = document.getElementById(
        "positions-loading",
    ) as HTMLDivElement;
    const noPositionsMsg = document.getElementById(
        "no-positions-msg",
    ) as HTMLDivElement;

    let userTokenIds: bigint[] = [];
    let userPositionsData: positionDataType[] = [];
    let userPositionsSvg: string[] = [];
    let currentManagePos: any = null;

    const decimalsCache: Record<string, number> = {};
    const getTokenDecimals = async (
        address: string,
        client: pubClient,
    ): Promise<number> => {
        if (address === NATIVE_TOKEN) return 18;
        const SUSDC_ADDRESS = SUSDC_CA.toLowerCase();
        if (address.toLowerCase() === SUSDC_ADDRESS) return 6;

        if (decimalsCache[address]) return decimalsCache[address];
        try {
            const dec = (await client.readContract({
                address: address as `0x${string}`,
                abi: erc20Abi,
                functionName: "decimals",
            })) as number;
            decimalsCache[address] = dec;
            return dec;
        } catch (e) {
            console.warn(
                `Failed to fetch decimals for ${address}, defaulting to 18`,
            );
            return 18;
        }
    };

    const loadUserPositions = async () => {
        if (!isConnected || !account) {
            positionsLoading.classList.add("d-none");
            noPositionsMsg.textContent =
                "Please connect your wallet to view your positions.";
            noPositionsMsg.classList.remove("d-none");
            return;
        }

        positionsLoading.classList.remove("d-none");
        noPositionsMsg.classList.add("d-none");
        Array.from(positionsListContainer.children).forEach((child) => {
            if (
                child.id !== "positions-loading" &&
                child.id !== "no-positions-msg"
            ) {
                child.remove();
            }
        });

        try {
            userTokenIds = await tokenIds(account.address, publicClient);

            if (userTokenIds.length === 0) {
                positionsLoading.classList.add("d-none");
                noPositionsMsg.textContent =
                    "You don't have any active liquidity positions yet.";
                noPositionsMsg.classList.remove("d-none");
                return;
            }

            userPositionsData = [];
            userPositionsSvg = [];

            const fetchPromises = userTokenIds.map(async (id) => {
                const data = await positionData(id, publicClient);
                let svg = "";
                try {
                    svg = (await positionSvg(id, publicClient)) as string;
                } catch (err) {
                    console.warn(`SVG rendering failed for Token ID ${id}`);
                    svg =
                        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='290' height='500'><rect width='290' height='500' fill='black'/><text x='10' y='250' fill='white'>Image Error</text></svg>";
                }
                if (!data || !svg) return null;
                const sym0 = (await publicClient.readContract({
                    address: data.token0,
                    abi: erc20Abi,
                    functionName: "symbol",
                })) as string;
                const sym1 = (await publicClient.readContract({
                    address: data.token1,
                    abi: erc20Abi,
                    functionName: "symbol",
                })) as string;
                const dec0 = await getTokenDecimals(data.token0, publicClient);
                const dec1 = await getTokenDecimals(data.token1, publicClient);

                return { id, data, svg, sym0, sym1, dec0, dec1 };
            });

            const resultsRaw = await Promise.all(fetchPromises);
            positionsLoading.classList.add("d-none");

            const results = resultsRaw.filter(
                (res): res is NonNullable<typeof res> => res !== null,
            );

            results.forEach((pos, index) => {
                userPositionsData.push(pos.data);
                userPositionsSvg.push(pos.svg);

                const color0 = getColorFromAddress(pos.data.token0, pos.sym0);
                const color1 = getColorFromAddress(pos.data.token1, pos.sym1);

                const statusClass = pos.data.inRange ? "in-range" : "out-range";
                const statusText = pos.data.inRange
                    ? "In range"
                    : "Out of range";

                const row = document.createElement("div");
                row.className = "position-item animate-fade-in-up";
                row.style.animationDelay = `${index * 0.08}s`;

                const safeSym0 = escapeHtml(pos.sym0);
                const safeSym1 = escapeHtml(pos.sym1);

                row.innerHTML = `
                    <div class="position-pool-info">
                        <div class="d-flex pair-icons-stack">
                            <div class="token-icon pool-mini-icon" style="background:${color0}; color:white; overflow:hidden; padding:0;">
                                ${buildTokenIconInnerHtml(pos.sym0, pos.data.token0)}
                            </div>
                            <div class="token-icon pool-mini-icon pool-icon-overlap" style="background:${color1}; color:white; overflow:hidden; padding:0;">
                                ${buildTokenIconInnerHtml(pos.sym1, pos.data.token1)}
                            </div>
                        </div>
                        <div class="pos-pair-details">
                            <span class="pos-pair-name">${safeSym0} / ${safeSym1}</span>
                            <span class="fee-badge">${pos.data.fee / 10000}%</span>
                        </div>
                    </div>
                    
                    <div class="position-status ${statusClass}">
                        <span class="status-dot"></span>
                        <span>${statusText}</span>
                    </div>
                    
                    <div class="position-action">
                        <button class="secondary-btn glass-btn manage-btn" 
                            data-tokenid="${pos.id.toString()}"
                            data-token0="${pos.data.token0}"
                            data-token1="${pos.data.token1}"
                            data-sym0="${safeSym0}"
                            data-sym1="${safeSym1}"
                            data-fee="${pos.data.fee}"
                            data-ticklower="${pos.data.tickLower}"
                            data-tickupper="${pos.data.tickUpper}"
                            data-inrange="${pos.data.inRange}"
                            data-amount0="${pos.data.amount0.toString()}"
                            data-amount1="${pos.data.amount1.toString()}"
                            data-fees0="${pos.data.tokensOwed0.toString()}"
                            data-fees1="${pos.data.tokensOwed1.toString()}"
                            data-liquidity="${pos.data.liquidity.toString()}"
                            data-dec0="${pos.dec0}" 
                            data-dec1="${pos.dec1}"
                        >
                            Manage
                        </button>
                    </div>
                `;

                positionsListContainer.appendChild(row);
            });

            attachManageEvents();
        } catch (error) {
            console.error("Failed to load positions:", error);
            showLog("Failed to load your positions from the network.", "error");
            positionsLoading.classList.add("d-none");
            noPositionsMsg.textContent = "Network error. Try refreshing.";
            noPositionsMsg.classList.remove("d-none");
        }
    };

    const attachManageEvents = () => {
        const manageBtns = document.querySelectorAll(".manage-btn");
        manageBtns.forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget as HTMLButtonElement;

                const tokenId = target.getAttribute("data-tokenid");
                const token0 = target.getAttribute("data-token0") || "";
                const token1 = target.getAttribute("data-token1") || "";
                const sym0 = target.getAttribute("data-sym0") || "";
                const sym1 = target.getAttribute("data-sym1") || "";
                const fee = Number(target.getAttribute("data-fee"));
                const tickLower = Number(target.getAttribute("data-ticklower"));
                const tickUpper = Number(target.getAttribute("data-tickupper"));
                const inRange = target.getAttribute("data-inrange") === "true";

                const amount0Str = target.getAttribute("data-amount0") || "0";
                const amount1Str = target.getAttribute("data-amount1") || "0";

                let amount0 = BigInt(amount0Str);
                let amount1 = BigInt(amount1Str);
                amount0 = amount0 < 0n ? -amount0 : amount0;
                amount1 = amount1 < 0n ? -amount1 : amount1;
                const fees0 = target.getAttribute("data-fees0") || "0";
                const fees1 = target.getAttribute("data-fees1") || "0";
                const liquidity = target.getAttribute("data-liquidity") || "0";
                const dec0 = Number(target.getAttribute("data-dec0") || 18);
                const dec1 = Number(target.getAttribute("data-dec1") || 18);
                const index = userTokenIds.findIndex(
                    (id) => id.toString() === tokenId,
                );
                const svgBase64 = userPositionsSvg[index];

                const color0 = getColorFromAddress(token0, sym0);
                const color1 = getColorFromAddress(token1, sym1);

                setTokenIconElement(
                    document.getElementById("manage-icon-0"),
                    sym0,
                    token0,
                    color0,
                );
                setTokenIconElement(
                    document.getElementById("manage-icon-1"),
                    sym1,
                    token1,
                    color1,
                );

                (
                    document.getElementById("manage-pair-name") as HTMLElement
                ).textContent = `${sym0} / ${sym1}`;
                (
                    document.getElementById("manage-fee-badge") as HTMLElement
                ).textContent = `${fee / 10000}%`;

                const statusEl = document.getElementById(
                    "manage-status",
                ) as HTMLElement;
                const statusText = document.getElementById(
                    "manage-status-text",
                ) as HTMLElement;
                if (inRange) {
                    statusEl.className = "position-status in-range";
                    statusText.textContent = "In range";
                } else {
                    statusEl.className = "position-status out-range";
                    statusText.textContent = "Out of range";
                }

                (
                    document.getElementById(
                        "manage-nft-image",
                    ) as HTMLImageElement
                ).src = svgBase64;

                setTokenIconElement(
                    document.getElementById("manage-row-icon-0"),
                    sym0,
                    token0,
                    color0,
                );
                (
                    document.getElementById("manage-sym0-name") as HTMLElement
                ).textContent = sym0;
                (
                    document.getElementById("manage-sym0-amount") as HTMLElement
                ).textContent = parseFloat(
                    Number(formatUnits(BigInt(amount0), dec0)).toFixed(6),
                ).toString();

                setTokenIconElement(
                    document.getElementById("manage-row-icon-1"),
                    sym1,
                    token1,
                    color1,
                );
                (
                    document.getElementById("manage-sym1-name") as HTMLElement
                ).textContent = sym1;
                (
                    document.getElementById("manage-sym1-amount") as HTMLElement
                ).textContent = parseFloat(
                    Number(formatUnits(BigInt(amount1), dec1)).toFixed(6),
                ).toString();

                setTokenIconElement(
                    document.getElementById("manage-fee-icon-0"),
                    sym0,
                    token0,
                    color0,
                );
                (
                    document.getElementById(
                        "manage-sym0-fee-name",
                    ) as HTMLElement
                ).textContent = sym0;
                (
                    document.getElementById("manage-sym0-fee") as HTMLElement
                ).textContent = parseFloat(
                    Number(formatUnits(BigInt(fees0), dec0)).toFixed(6),
                ).toString();

                setTokenIconElement(
                    document.getElementById("manage-fee-icon-1"),
                    sym1,
                    token1,
                    color1,
                );
                (
                    document.getElementById(
                        "manage-sym1-fee-name",
                    ) as HTMLElement
                ).textContent = sym1;
                (
                    document.getElementById("manage-sym1-fee") as HTMLElement
                ).textContent = parseFloat(
                    Number(formatUnits(BigInt(fees1), dec1)).toFixed(6),
                ).toString();

                currentManagePos = {
                    tokenId,
                    token0,
                    token1,
                    fee,
                    tickLower,
                    tickUpper,
                    sym0,
                    sym1,
                    inRange,
                    liquidity: BigInt(liquidity),
                    amount0,
                    amount1,
                    fees0: BigInt(fees0),
                    fees1: BigInt(fees1),
                    dec0,
                    dec1,
                    color0,
                    color1,
                };

                document
                    .getElementById("pool-positions-page")
                    ?.classList.add("d-none");
                poolManagePosition.classList.remove("d-none");
            });
        });
    };

    const actionModal = document.getElementById(
        "action-modal",
    ) as HTMLDivElement;
    const closeActionModal = document.getElementById(
        "close-action-modal",
    ) as HTMLButtonElement;
    const actionModalTitle = document.getElementById(
        "action-modal-title",
    ) as HTMLHeadingElement;
    const actionExecuteBtn = document.getElementById(
        "action-execute-btn",
    ) as HTMLButtonElement;

    const sectionRemove = document.getElementById(
        "action-section-remove",
    ) as HTMLDivElement;
    const sectionAdd = document.getElementById(
        "action-section-add",
    ) as HTMLDivElement;
    const sectionCollect = document.getElementById(
        "action-section-collect",
    ) as HTMLDivElement;

    const hideAllActionSections = () => {
        sectionRemove.classList.add("d-none");
        sectionAdd.classList.add("d-none");
        sectionCollect.classList.add("d-none");
    };

    closeActionModal.addEventListener("click", () => closeModal(actionModal));

    // --- 1. REMOVE LIQUIDITY ---
    const btnActionRemove = document.getElementById(
        "btn-action-remove",
    ) as HTMLButtonElement;
    const removePercentInput = document.getElementById(
        "remove-percent-input",
    ) as HTMLInputElement;
    const removeReceive0 = document.getElementById(
        "remove-receive-0",
    ) as HTMLSpanElement;
    const removeReceive1 = document.getElementById(
        "remove-receive-1",
    ) as HTMLSpanElement;

    const updateRemoveCalculations = (percent: number) => {
        if (!currentManagePos) return;
        const val0 =
            (Number(
                formatUnits(currentManagePos.amount0, currentManagePos.dec0),
            ) *
                percent) /
            100;
        const val1 =
            (Number(
                formatUnits(currentManagePos.amount1, currentManagePos.dec1),
            ) *
                percent) /
            100;
        removeReceive0.textContent = parseFloat(val0.toFixed(6)).toString();
        removeReceive1.textContent = parseFloat(val1.toFixed(6)).toString();
        actionExecuteBtn.disabled = percent <= 0;
    };

    removePercentInput.addEventListener("input", (e) => {
        let val = Number((e.target as HTMLInputElement).value);
        if (val > 100) {
            val = 100;
            removePercentInput.value = "100";
            showLog("Maximum withdrawal is 100%", "info");
        } else if (val < 0) {
            val = 0;
            removePercentInput.value = "0";
        }
        updateRemoveCalculations(val);
    });

    document.querySelectorAll(".percent-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const percent = Number(
                (e.currentTarget as HTMLButtonElement).getAttribute(
                    "data-percent",
                ),
            );
            removePercentInput.value = percent.toString();
            updateRemoveCalculations(percent);
        });
    });

    btnActionRemove.addEventListener("click", () => {
        hideAllActionSections();
        actionModalTitle.textContent = "Remove Liquidity";
        actionExecuteBtn.textContent = "Remove";

        setTokenIconElement(
            document.getElementById("remove-icon-0"),
            currentManagePos.sym0,
            currentManagePos.token0,
            currentManagePos.color0,
        );
        (
            document.getElementById("remove-sym0-name") as HTMLElement
        ).textContent = currentManagePos.sym0;

        setTokenIconElement(
            document.getElementById("remove-icon-1"),
            currentManagePos.sym1,
            currentManagePos.token1,
            currentManagePos.color1,
        );
        (
            document.getElementById("remove-sym1-name") as HTMLElement
        ).textContent = currentManagePos.sym1;

        removePercentInput.value = "0";
        updateRemoveCalculations(0);

        sectionRemove.classList.remove("d-none");
        openModal(actionModal);
    });

    // --- 2. ADD LIQUIDITY ---
    const btnActionAdd = document.getElementById(
        "btn-action-add",
    ) as HTMLButtonElement;
    const addAmount0Input = document.getElementById(
        "add-amount-0",
    ) as HTMLInputElement;
    const addAmount1Input = document.getElementById(
        "add-amount-1",
    ) as HTMLInputElement;
    const addBalance0 = document.getElementById(
        "add-balance-0",
    ) as HTMLSpanElement;
    const addBalance1 = document.getElementById(
        "add-balance-1",
    ) as HTMLSpanElement;

    btnActionAdd.addEventListener("click", async () => {
        hideAllActionSections();
        actionModalTitle.textContent = "Add Liquidity";
        actionExecuteBtn.textContent = "Add";

        setTokenIconElement(
            document.getElementById("add-icon-0"),
            currentManagePos.sym0,
            currentManagePos.token0,
            currentManagePos.color0,
        );
        (document.getElementById("add-sym0-name") as HTMLElement).textContent =
            currentManagePos.sym0;

        setTokenIconElement(
            document.getElementById("add-icon-1"),
            currentManagePos.sym1,
            currentManagePos.token1,
            currentManagePos.color1,
        );
        (document.getElementById("add-sym1-name") as HTMLElement).textContent =
            currentManagePos.sym1;

        const wrapper0 = document.getElementById(
            "add-wrapper-0",
        ) as HTMLDivElement;
        const wrapper1 = document.getElementById(
            "add-wrapper-1",
        ) as HTMLDivElement;

        wrapper0.classList.remove("d-none");
        wrapper1.classList.remove("d-none");

        if (!currentManagePos.inRange) {
            if (currentManagePos.amount0 === 0n) {
                wrapper0.classList.add("d-none");
            } else if (currentManagePos.amount1 === 0n) {
                wrapper1.classList.add("d-none");
            }
        }

        addAmount0Input.value = "";
        addAmount1Input.value = "";
        addBalance0.textContent = "Loading...";
        addBalance1.textContent = "Loading...";
        actionExecuteBtn.disabled = false;

        sectionAdd.classList.remove("d-none");
        openModal(actionModal);

        const isValidAddress = (addr: any): boolean => {
            return (
                typeof addr === "string" &&
                addr.startsWith("0x") &&
                addr.length === 42 &&
                addr !== zeroAddress
            );
        };

        const t0 = currentManagePos.token0;
        const t1 = currentManagePos.token1;
        let bal0 = 0n;
        let bal1 = 0n;

        if (isValidAddress(t0)) {
            try {
                bal0 = await getTokenBalance(
                    t0,
                    account.address,
                    publicClient,
                    signClient,
                );
            } catch (e) {
                console.warn(
                    `Failed to fetch balance for ${currentManagePos.sym0}`,
                    e,
                );
            }
        }

        if (isValidAddress(t1)) {
            try {
                bal1 = await getTokenBalance(
                    t1,
                    account.address,
                    publicClient,
                    signClient,
                );
            } catch (e) {
                console.warn(
                    `Failed to fetch balance for ${currentManagePos.sym1}`,
                    e,
                );
            }
        }

        addBalance0.textContent = parseFloat(
            Number(formatUnits(bal0, currentManagePos.dec0)).toFixed(4),
        ).toString();
        addBalance1.textContent = parseFloat(
            Number(formatUnits(bal1, currentManagePos.dec1)).toFixed(4),
        ).toString();

        if (isValidAddress(t0) && isValidAddress(t1)) {
            try {
                const poolAddress = await getPoolWithDirectCall(
                    t0 as `0x${string}`,
                    t1 as `0x${string}`,
                    currentManagePos.fee,
                    publicClient,
                );

                if (isValidAddress(poolAddress)) {
                    currentManagePos.sqrtPriceX96 = await readRawSqrtPriceX96(
                        poolAddress,
                        publicClient,
                    );
                } else {
                    currentManagePos.sqrtPriceX96 = 0n;
                }
            } catch (error) {
                console.error("Failed to fetch pool price:", error);
                currentManagePos.sqrtPriceX96 = 0n;
            }
        } else {
            currentManagePos.sqrtPriceX96 = 0n;
        }
    });

    const handleAddAutoFill = (source: "0" | "1") => {
        if (
            !currentManagePos ||
            !currentManagePos.inRange ||
            !currentManagePos.sqrtPriceX96
        )
            return;

        const sqrtPriceX96 = currentManagePos.sqrtPriceX96;
        let sqrtRatioAX96 = getSqrtRatioAtTick(currentManagePos.tickLower);
        let sqrtRatioBX96 = getSqrtRatioAtTick(currentManagePos.tickUpper);

        if (sqrtRatioAX96 > sqrtRatioBX96) {
            [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
        }

        if (source === "0") {
            const val0 = addAmount0Input.value;
            if (Number(val0) > 0) {
                const amount0Wei = parseUnits(val0, currentManagePos.dec0);
                const L = getLiquidityForAmount0(
                    sqrtPriceX96,
                    sqrtRatioBX96,
                    amount0Wei,
                );
                const amount1Wei = getAmount1ForLiquidity(
                    sqrtRatioAX96,
                    sqrtPriceX96,
                    L,
                );
                addAmount1Input.value = parseFloat(
                    Number(
                        formatUnits(amount1Wei, currentManagePos.dec1),
                    ).toFixed(6),
                ).toString();
            } else {
                addAmount1Input.value = "";
            }
        } else {
            const val1 = addAmount1Input.value;
            if (Number(val1) > 0) {
                const amount1Wei = parseUnits(val1, currentManagePos.dec1);
                const L = getLiquidityForAmount1(
                    sqrtRatioAX96,
                    sqrtPriceX96,
                    amount1Wei,
                );
                const amount0Wei = getAmount0ForLiquidity(
                    sqrtPriceX96,
                    sqrtRatioBX96,
                    L,
                );
                addAmount0Input.value = parseFloat(
                    Number(
                        formatUnits(amount0Wei, currentManagePos.dec0),
                    ).toFixed(6),
                ).toString();
            } else {
                addAmount0Input.value = "";
            }
        }
    };

    addAmount0Input.addEventListener("input", () => handleAddAutoFill("0"));
    addAmount1Input.addEventListener("input", () => handleAddAutoFill("1"));

    // --- 3. COLLECT FEES ---
    const btnActionCollect = document.getElementById(
        "btn-action-collect",
    ) as HTMLButtonElement;

    btnActionCollect.addEventListener("click", () => {
        hideAllActionSections();
        actionModalTitle.textContent = "Collect Fees";
        actionExecuteBtn.textContent = "Collect";

        setTokenIconElement(
            document.getElementById("collect-icon-0"),
            currentManagePos.sym0,
            currentManagePos.token0,
            currentManagePos.color0,
        );
        (
            document.getElementById("collect-sym0-name") as HTMLElement
        ).textContent = currentManagePos.sym0;

        setTokenIconElement(
            document.getElementById("collect-icon-1"),
            currentManagePos.sym1,
            currentManagePos.token1,
            currentManagePos.color1,
        );
        (
            document.getElementById("collect-sym1-name") as HTMLElement
        ).textContent = currentManagePos.sym1;

        const formattedFee0 = parseFloat(
            Number(
                formatUnits(currentManagePos.fees0, currentManagePos.dec0),
            ).toFixed(6),
        );
        const formattedFee1 = parseFloat(
            Number(
                formatUnits(currentManagePos.fees1, currentManagePos.dec1),
            ).toFixed(6),
        );

        (
            document.getElementById("collect-amount-0") as HTMLElement
        ).textContent = formattedFee0.toString();
        (
            document.getElementById("collect-amount-1") as HTMLElement
        ).textContent = formattedFee1.toString();

        if (formattedFee0 === 0 && formattedFee1 === 0) {
            actionExecuteBtn.textContent = "No fees to collect";
            actionExecuteBtn.disabled = true;
            actionExecuteBtn.style.opacity = "0.5";
        } else {
            actionExecuteBtn.disabled = false;
            actionExecuteBtn.style.opacity = "1";
        }

        sectionCollect.classList.remove("d-none");
        openModal(actionModal);
    });

    const refreshManageView = async () => {
        if (!currentManagePos) return;

        try {
            (
                document.getElementById("manage-sym0-fee") as HTMLElement
            ).textContent = "...";
            (
                document.getElementById("manage-sym1-fee") as HTMLElement
            ).textContent = "...";
            (
                document.getElementById("manage-sym0-amount") as HTMLElement
            ).textContent = "...";
            (
                document.getElementById("manage-sym1-amount") as HTMLElement
            ).textContent = "...";

            const freshData = await positionData(
                BigInt(currentManagePos.tokenId),
                publicClient,
            );
            if (!freshData) {
                console.warn("Refresh failed: Position data is null");
                return;
            }
            currentManagePos.inRange = freshData?.inRange;
            currentManagePos.amount0 =
                freshData.amount0 < 0n ? -freshData.amount0 : freshData.amount0;
            currentManagePos.amount1 =
                freshData.amount1 < 0n ? -freshData.amount1 : freshData.amount1;
            currentManagePos.fees0 = freshData?.tokensOwed0;
            currentManagePos.fees1 = freshData?.tokensOwed1;
            currentManagePos.liquidity = freshData?.liquidity;
            currentManagePos.tickLower = freshData?.tickLower;
            currentManagePos.tickUpper = freshData?.tickUpper;

            const statusEl = document.getElementById(
                "manage-status",
            ) as HTMLElement;
            const statusText = document.getElementById(
                "manage-status-text",
            ) as HTMLElement;
            if (freshData?.inRange) {
                statusEl.className = "position-status in-range";
                statusText.textContent = "In range";
            } else {
                statusEl.className = "position-status out-range";
                statusText.textContent = "Out of range";
            }

            (
                document.getElementById("manage-sym0-amount") as HTMLElement
            ).textContent = parseFloat(
                Number(
                    formatUnits(currentManagePos.amount0, currentManagePos.dec0),
                ).toFixed(6),
            ).toString();
            (
                document.getElementById("manage-sym1-amount") as HTMLElement
            ).textContent = parseFloat(
                Number(
                    formatUnits(currentManagePos.amount1, currentManagePos.dec1),
                ).toFixed(6),
            ).toString();
            let formattedFee0 = parseFloat(
                Number(
                    formatUnits(freshData.tokensOwed0, currentManagePos.dec0),
                ).toFixed(6),
            ).toString();
            let formattedFee1 = parseFloat(
                Number(
                    formatUnits(freshData.tokensOwed1, currentManagePos.dec1),
                ).toFixed(6),
            ).toString();
            (
                document.getElementById("manage-sym0-fee") as HTMLElement
            ).textContent = formattedFee0;
            (
                document.getElementById("manage-sym1-fee") as HTMLElement
            ).textContent = formattedFee1;
        } catch (error) {
            console.error("Failed to refresh manage view:", error);
        }
    };

    actionExecuteBtn.addEventListener("click", async () => {
        const actionType = actionModalTitle.textContent;

        if (actionType === "Collect Fees") {
            try {
                actionExecuteBtn.disabled = true;
                actionExecuteBtn.textContent = "Collecting...";
                showLog("Confirming Collect transaction in wallet...", "info");

                const txHash = await collectLiquidityRewards(
                    currentManagePos.tokenId,
                    account.address,
                    maxUint128,
                    maxUint128,
                    publicClient,
                    signClient,
                );

                closeModal(actionModal);
                const formattedFee0 =
                    document.getElementById("manage-sym0-fee")?.textContent || "0";
                const formattedFee1 =
                    document.getElementById("manage-sym1-fee")?.textContent || "0";

                showSuccessDialog({
                    title: "Fees Collected!",
                    actionType: "Collect",
                    txHash,
                    tokens: [
                        {
                            symbol: currentManagePos.sym0,
                            amount: formattedFee0,
                            address: currentManagePos.token0,
                        },
                        {
                            symbol: currentManagePos.sym1,
                            amount: formattedFee1,
                            address: currentManagePos.token1,
                        },
                    ],
                });

                showLog("Refreshing your position data...", "info");
                await refreshManageView();
                await loadUserPositions();
                await updateBalances();
            } catch (error) {
                console.error("Collect Error: ", error);
                showLog("Collect transaction failed or was rejected.", "error");
            } finally {
                actionExecuteBtn.disabled = false;
                actionExecuteBtn.textContent = "Collect";
            }
        } else if (actionType === "Remove Liquidity") {
            const percentInput = document.getElementById(
                "remove-percent-input",
            ) as HTMLInputElement;
            const percent = Number(percentInput.value);

            if (percent <= 0 || percent > 100) {
                showLog("Please enter a valid percentage (1-100).", "error");
                return;
            }

            try {
                actionExecuteBtn.disabled = true;
                actionExecuteBtn.textContent = "Preparing Transaction...";
                showLog("Calculating withdrawal amounts...", "info");

                const percentBps = BigInt(Math.floor(percent * 100));
                const BASIS_POINTS_DENOMINATOR = 10000n;

                const liquidityToRemove =
                    (BigInt(currentManagePos.liquidity) * percentBps) /
                    BASIS_POINTS_DENOMINATOR;

                const amount0Min = 0n;
                const amount1Min = 0n;

                const deadlineMins =
                    Number(
                        (
                            document.getElementById(
                                "deadline-input",
                            ) as HTMLInputElement
                        ).value,
                    ) || 20;
                const deadline = BigInt(
                    Math.floor(Date.now() / 1000) + deadlineMins * 60,
                );

                actionExecuteBtn.textContent = "Confirm in Wallet...";

                const txHash = await decreaseLiquidity(
                    BigInt(currentManagePos.tokenId),
                    liquidityToRemove,
                    amount0Min,
                    amount1Min,
                    deadline,
                    account.address,
                    publicClient,
                    signClient,
                );

                closeModal(actionModal);
                showSuccessDialog({
                    title: "Liquidity Removed!",
                    actionType: "RemoveLiquidity",
                    txHash,
                    tokens: [
                        {
                            symbol: currentManagePos.sym0,
                            amount: removeReceive0.textContent || "0",
                            address: currentManagePos.token0,
                        },
                        {
                            symbol: currentManagePos.sym1,
                            amount: removeReceive1.textContent || "0",
                            address: currentManagePos.token1,
                        },
                    ],
                });
                showLog("Updating pool state...", "info");

                if (percent === 100) {
                    setPoolSubView("my-positions", true, true);
                } else {
                    await refreshManageView();
                    await loadUserPositions();
                }

                await updateBalances();
            } catch (error) {
                console.error("Remove Liquidity Error: ", error);
                showLog("Withdrawal failed or was rejected.", "error");
            } finally {
                actionExecuteBtn.disabled = false;
                actionExecuteBtn.textContent = "Remove";
            }
        } else if (actionType === "Add Liquidity") {
            const addAmount0Input = document.getElementById(
                "add-amount-0",
            ) as HTMLInputElement;
            const addAmount1Input = document.getElementById(
                "add-amount-1",
            ) as HTMLInputElement;

            const val0 = addAmount0Input.value.trim();
            const val1 = addAmount1Input.value.trim();

            const amount0Num = Number(val0);
            const amount1Num = Number(val1);

            if ((!val0 && !val1) || (amount0Num <= 0 && amount1Num <= 0)) {
                showLog("Please enter valid deposit amounts.", "error");
                return;
            }

            if (
                currentManagePos.inRange &&
                (amount0Num <= 0 || amount1Num <= 0)
            ) {
                showLog(
                    "Both amounts are required for in-range positions.",
                    "error",
                );
                return;
            }

            try {
                actionExecuteBtn.disabled = true;
                actionExecuteBtn.textContent = "Checking Balances...";

                const amount0Desired =
                    amount0Num > 0
                        ? safeParseUnits(val0, currentManagePos.dec0)
                        : 0n;
                const amount1Desired =
                    amount1Num > 0
                        ? safeParseUnits(val1, currentManagePos.dec1)
                        : 0n;

                // Fetch balances using native-aware helper
                const bal0 = await getTokenBalance(
                    currentManagePos.token0,
                    account.address,
                    publicClient,
                    signClient,
                );

                const bal1 = await getTokenBalance(
                    currentManagePos.token1,
                    account.address,
                    publicClient,
                    signClient,
                );

                if (amount0Desired > 0n && bal0 < amount0Desired) {
                    showLog(
                        `Insufficient ${currentManagePos.sym0} balance!`,
                        "error",
                    );
                    return;
                }
                if (amount1Desired > 0n && bal1 < amount1Desired) {
                    showLog(
                        `Insufficient ${currentManagePos.sym1} balance!`,
                        "error",
                    );
                    return;
                }

                const positionManagerAddress =
                    "0xCF1e20C1063B8037A3D281D85Af00a915cC84025";

                actionExecuteBtn.textContent = "Checking Allowances...";

                const checkAndApprove = async (
                    tokenCa: string,
                    symbol: string,
                    amountNeeded: bigint,
                ) => {
                    if (
                        amountNeeded <= 0n ||
                        tokenCa === NATIVE_TOKEN ||
                        tokenCa.toLowerCase() === WSIZE.toLowerCase() ||
                        tokenCa === zeroAddress
                    )
                        return;

                    let allowance = await getTokenAllowance(
                        tokenCa,
                        account.address,
                        positionManagerAddress,
                        publicClient,
                        signClient,
                    );

                    if (allowance < amountNeeded) {
                        actionExecuteBtn.textContent = `Approving ${symbol}...`;
                        showLog(`Requesting approval for ${symbol}...`, "info");

                        const isApproved = await approve(
                            tokenCa as `0x${string}`,
                            positionManagerAddress,
                            maxUint256,
                            signClient,
                            publicClient,
                        );
                        if (!isApproved)
                            throw new Error(`Approval for ${symbol} failed`);

                        actionExecuteBtn.textContent = "Syncing Network...";
                        let retries = 0;
                        while (allowance < amountNeeded && retries < 10) {
                            await new Promise((res) => setTimeout(res, 1500));
                            allowance = await getTokenAllowance(
                                tokenCa,
                                account.address,
                                positionManagerAddress,
                                publicClient,
                                signClient,
                            );
                            retries++;
                        }
                    }
                };

                await checkAndApprove(
                    currentManagePos.token0,
                    currentManagePos.sym0,
                    amount0Desired,
                );
                await checkAndApprove(
                    currentManagePos.token1,
                    currentManagePos.sym1,
                    amount1Desired,
                );

                const slippageVal =
                    Number(
                        (
                            document.getElementById(
                                "slippage-input",
                            ) as HTMLInputElement
                        ).value,
                    ) || 0.3;
                const slippageBps = BigInt(Math.floor(slippageVal * 100));

                const amount0Min =
                    (amount0Desired * (10000n - slippageBps)) / 10000n;
                const amount1Min =
                    (amount1Desired * (10000n - slippageBps)) / 10000n;

                const deadlineMins =
                    Number(
                        (
                            document.getElementById(
                                "deadline-input",
                            ) as HTMLInputElement
                        ).value,
                    ) || 20;
                const deadline = BigInt(
                    Math.floor(Date.now() / 1000) + deadlineMins * 60,
                );

                actionExecuteBtn.textContent = "Confirm in Wallet...";
                showLog("Adding liquidity... Please confirm.", "info");

                let nativeVal = 0n;
                if (
                    currentManagePos.token0.toLowerCase() ===
                    WSIZE.toLowerCase()
                ) {
                    nativeVal = amount0Desired;
                } else if (
                    currentManagePos.token1.toLowerCase() ===
                    WSIZE.toLowerCase()
                ) {
                    nativeVal = amount1Desired;
                }

                const txHash = await increaseLiquidity(
                    BigInt(currentManagePos.tokenId),
                    amount0Desired,
                    amount1Desired,
                    amount0Min,
                    amount1Min,
                    deadline,
                    publicClient,
                    signClient,
                    nativeVal,
                );

                closeModal(actionModal);
                showSuccessDialog({
                    title: "Liquidity Added!",
                    actionType: "AddLiquidity",
                    txHash,
                    tokens: [
                        {
                            symbol: currentManagePos.sym0,
                            amount: val0,
                            address: currentManagePos.token0,
                        },
                        {
                            symbol: currentManagePos.sym1,
                            amount: val1,
                            address: currentManagePos.token1,
                        },
                    ],
                });

                addAmount0Input.value = "";
                addAmount1Input.value = "";

                showLog("Refreshing position data...", "info");
                await refreshManageView();
                await loadUserPositions();
                await updateBalances();
            } catch (error) {
                console.error("Add Liquidity Error:", error);
                showLog("Transaction failed or was rejected.", "error");
            } finally {
                actionExecuteBtn.disabled = false;
                actionExecuteBtn.textContent = "Add";
            }
        }
    });

    // ==========================================
    // --- SPA Routing & State Restoration ---
    // ==========================================
    const handleRouteFromLocation = async (isInitialLoad = false) => {
        const rawPath =
            window.location.pathname.toLowerCase().replace(/\/+$/, "") || "/";

        if (rawPath === "/dashboard") {
            switchView("view-dashboard", "nav-dashboard", false);
        } else if (rawPath === "/swap") {
            switchView("view-swap", "nav-swap", false);
        } else if (rawPath === "/faucet") {
            switchView("view-faucet", "nav-faucet", false);
        } else if (rawPath.startsWith("/pool")) {
            switchView("view-pool", "nav-pool", false);
            const subSegment = rawPath
                .slice("/pool".length)
                .replace(/^\/+/, "");

            if (!subSegment) {
                setPoolSubView("dashboard", false, false);
            } else if (subSegment === "positions") {
                setPoolSubView("my-positions", isConnected, false);
            } else if (subSegment === "none" || subSegment.startsWith("0x")) {
                setPoolSubView("new-position", false, false);

                if (
                    subSegment.startsWith("0x") &&
                    POPULAR_POOLS_MAP[subSegment]
                ) {
                    const preset = POPULAR_POOLS_MAP[subSegment];
                    applyPoolPairSelection(
                        preset.symA,
                        preset.caA,
                        preset.symB,
                        preset.caB,
                        preset.fee,
                    );
                    await checkPoolStatus();
                } else if (subSegment.startsWith("0x") && subSegment.length === 42) {
                    try {
                        const poolMetaAbi = [
                            { type: "function", name: "token0", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
                            { type: "function", name: "token1", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
                            { type: "function", name: "fee", inputs: [], outputs: [{ type: "uint24" }], stateMutability: "view" },
                        ] as const;
                        const poolAddr = subSegment as `0x${string}`;
                        const [t0, t1, fee] = await Promise.all([
                            publicClient.readContract({ address: poolAddr, abi: poolMetaAbi, functionName: "token0" }),
                            publicClient.readContract({ address: poolAddr, abi: poolMetaAbi, functionName: "token1" }),
                            publicClient.readContract({ address: poolAddr, abi: poolMetaAbi, functionName: "fee" }),
                        ]);
                        const [sym0, sym1] = await Promise.all([
                            publicClient.readContract({ address: t0 as `0x${string}`, abi: erc20Abi, functionName: "symbol" }).catch(() => shortenAddress(t0)),
                            publicClient.readContract({ address: t1 as `0x${string}`, abi: erc20Abi, functionName: "symbol" }).catch(() => shortenAddress(t1)),
                        ]);
                        applyPoolPairSelection(sym0 as string, t0, sym1 as string, t1, Number(fee));
                        await checkPoolStatus();
                    } catch {
                        await checkPoolStatus();
                    }
                } else {
                    const savedPairRaw = localStorage.getItem(
                        "rift_pool_selected_pair",
                    );
                    if (savedPairRaw) {
                        try {
                            const savedPair = JSON.parse(savedPairRaw);
                            if (savedPair.caA && savedPair.caB) {
                                applyPoolPairSelection(
                                    savedPair.symA,
                                    savedPair.caA,
                                    savedPair.symB,
                                    savedPair.caB,
                                    savedPair.fee || 3000,
                                );
                                await checkPoolStatus();
                            }
                        } catch (e) {
                            console.warn("Failed to parse saved pool pair", e);
                        }
                    }
                }
            } else {
                setPoolSubView("dashboard", false, false);
            }
        } else if (isInitialLoad) {
            const savedView =
                localStorage.getItem("rift_active_view") || "view-swap";
            const savedNav =
                localStorage.getItem("rift_active_nav") || "nav-swap";
            const savedPoolSubView =
                (localStorage.getItem("rift_pool_subview") as PoolSubView) ||
                "dashboard";

            switchView(savedView, savedNav, false);

            if (savedView === "view-pool") {
                if (savedPoolSubView === "new-position") {
                    const savedPairRaw = localStorage.getItem(
                        "rift_pool_selected_pair",
                    );
                    if (savedPairRaw) {
                        try {
                            const savedPair = JSON.parse(savedPairRaw);
                            if (savedPair.caA && savedPair.caB) {
                                applyPoolPairSelection(
                                    savedPair.symA,
                                    savedPair.caA,
                                    savedPair.symB,
                                    savedPair.caB,
                                    savedPair.fee || 3000,
                                );
                            }
                        } catch (e) {
                            console.warn(
                                "Failed to restore saved pool pair",
                                e,
                            );
                        }
                    }
                    setPoolSubView("new-position", false, true);
                    await checkPoolStatus();
                } else {
                    setPoolSubView(savedPoolSubView, false, true);
                }
            } else {
                const defaultPath = viewToPathMap[savedView] || "/swap";
                updateBrowserUrl(defaultPath, true);
            }
        } else {
            switchView("view-swap", "nav-swap", false);
            updateBrowserUrl("/swap", true);
        }
    };

    window.addEventListener("popstate", () => {
        handleRouteFromLocation(false);
    });

    await handleRouteFromLocation(true);

    const savedPk = localStorage.getItem("rift_user_pk");
    if (savedPk) {
        await connectWallet(savedPk);
    } else if (
        localStorage.getItem("rift_active_view") === "view-pool" &&
        localStorage.getItem("rift_pool_subview") === "my-positions"
    ) {
        loadUserPositions();
    }
});

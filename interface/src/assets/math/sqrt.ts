import { parseUnits } from 'viem';

// Standard Uniswap V3 constants
const Q192 = 2n ** 192n;

/**
 * Calculates the integer square root of a BigInt using the Newton-Raphson (Babylonian) method.
 * Mathematically: res = ⌊√y⌋
 * 
 * @param y The BigInt for which to calculate the square root.
 * @returns The integer square root of y.
 */
function sqrt(y: bigint): bigint {
    if (y < 0n) {
        throw new Error('Math Error: Square root of a negative number is undefined in real numbers.');
    }
    if (y < 2n) {
        return y;
    }
    
    let z = y / 2n + 1n;
    let x = y;
    
    while (x > z) {
        x = z;
        z = (y / x + x) / 2n;
    }
    
    return x;
}

/**
 * Encodes a ratio of amount1/amount0 into a Uniswap V3 sqrtPriceX96.
 * Mathematically: sqrtPriceX96 = ⌊√(amount1 / amount0) * 2^96⌋
 * 
 * To mitigate floating-point truncation in EVM integer division, 
 * the multiplier (2^192) is factored into the numerator BEFORE division:
 * ⌊√((amount1 * 2^192) / amount0)⌋
 *
 * @param amount1 The exact amount of Token 1 (Numerator).
 * @param amount0 The exact amount of Token 0 (Denominator).
 * @returns The encoded sqrtPriceX96.
 */
export function encodeSqrtRatioX96(amount1: bigint, amount0: bigint): bigint {
    if (amount0 === 0n) {
        throw new Error('Math Error: Division by zero (amount0 cannot be zero).');
    }

    const numerator = amount1 * Q192; 
    const ratio = numerator / amount0;
    
    return sqrt(ratio);
}

/**
 * Converts a human-readable price string (Token0 price expressed in Token1)
 * into a precise Uniswap V3 sqrtPriceX96, dynamically accounting for token decimals.
 * 
 * Derivation:
 * P = (reserve1 / 10^decimals1) / (reserve0 / 10^decimals0)
 * (reserve1 / reserve0) = P * (10^decimals1 / 10^decimals0)
 * sqrtPriceX96 = √((P * 10^decimals1 * 2^192) / 10^decimals0)
 *
 * @param priceRatio The human-readable price string (e.g. "0.1").
 * @param decimals0 The number of decimals for Token 0 (Base Token).
 * @param decimals1 The number of decimals for Token 1 (Quote Token).
 * @returns The sqrtPriceX96 BigInt representing the exact price on-chain.
 */
export function getSqrtPriceX96FromPrice(
    priceRatio: string,
    decimals0: number,
    decimals1: number
): bigint {
    // amount1 = P * 10^decimals1 (No floating point loss thanks to parseUnits)
    const amount1 = parseUnits(priceRatio, decimals1);
    
    // amount0 = 1 * 10^decimals0
    const amount0 = parseUnits('1', decimals0);

    // Encode the raw reserve amounts into sqrtPriceX96
    return encodeSqrtRatioX96(amount1, amount0);
}

/**
 * Inverts a sqrtPriceX96. 
 * If the current value represents the price of Token0 in Token1,
 * the inverted value represents the price of Token1 in Token0.
 * 
 * Mathematically: inverted = 2^192 / sqrtPriceX96
 * 
 * @param sqrtPriceX96 The current sqrtPriceX96 to invert.
 * @returns The mathematically inverted sqrtPriceX96.
 */
export const invertSqrtPrice = (sqrtPriceX96: bigint): bigint => {
    if (sqrtPriceX96 === 0n) {
        throw new Error('Math Error: Cannot invert a zero price.');
    }
    return Q192 / sqrtPriceX96;
}
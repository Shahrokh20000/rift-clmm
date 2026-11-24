// math/liquidityMath.ts

const Q96 = 2n ** 96n;

export function getLiquidityForAmount0(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    amount0: bigint
): bigint {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
        [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }
    const intermediate = (sqrtRatioAX96 * sqrtRatioBX96) / Q96;
    return (amount0 * intermediate) / (sqrtRatioBX96 - sqrtRatioAX96);
}

export function getLiquidityForAmount1(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    amount1: bigint
): bigint {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
        [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }
    return (amount1 * Q96) / (sqrtRatioBX96 - sqrtRatioAX96);
}

export function getAmount0ForLiquidity(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint
): bigint {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
        [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }
    return (
        (liquidity * Q96 * (sqrtRatioBX96 - sqrtRatioAX96)) /
        (sqrtRatioBX96 * sqrtRatioAX96)
    );
}

export function getAmount1ForLiquidity(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint
): bigint {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
        [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }
    return (liquidity * (sqrtRatioBX96 - sqrtRatioAX96)) / Q96;
}
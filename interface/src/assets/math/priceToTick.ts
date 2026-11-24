
export const convertPriceToTick = (
  price: number,
  tickSpacing: number,
): number => {
  if (price <= 0) {
    throw new Error("Price must be greater than 0");
  }

  if (tickSpacing <= 0) {
    throw new Error("Tick spacing must be greater than 0");
  }

  const rawTick = Math.log(price) / Math.log(1.0001);

  return Math.floor(rawTick / tickSpacing) * tickSpacing;
};

import type { Address } from "viem";
import { sortAddresses } from "./sortAddress";

export const quoteToBasePrice = (base:Address,quote:Address,price:bigint):bigint => {
     const [token0,] = sortAddresses(base,quote);
     if(token0.toLocaleLowerCase() === base.toLocaleLowerCase()) return price;
     if (price === 0n) return 0n; 
    return (10n ** 36n) / price;
}
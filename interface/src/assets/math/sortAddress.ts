import type { Address } from "viem";

export const sortAddresses = (
  addressA: Address,
  addressB: Address,
): [Address, Address] => {
  return addressA.toLowerCase() < addressB.toLowerCase()
    ? [addressA, addressB]
    : [addressB, addressA];
};

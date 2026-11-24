import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { hexToBytes, bytesToHex, type PrivateKeyAccount } from "viem";
import {secp256k1} from "@noble/curves/secp256k1.js";

export type customAccount = PrivateKeyAccount & {
  privateKey: `0x${string}`;
};

export const getAcc = (prv: `0x${string}`): customAccount => {
  let key = prv;
  let compressedPubKey: `0x${string}`;
  while (true) {
    if (key === "0x") {
      key = generatePrivateKey();
    }
    const account = privateKeyToAccount(key);

    const pubKeyBytes = secp256k1.getPublicKey(hexToBytes(key), false);
    compressedPubKey = bytesToHex(pubKeyBytes);

    if (compressedPubKey.startsWith("0x04")) {
      return Object.assign(account, {
        privateKey: key,
        publicKey: compressedPubKey,
      }) as customAccount;
    }
    key = "0x";
  }
};

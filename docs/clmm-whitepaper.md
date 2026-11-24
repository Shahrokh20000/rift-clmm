---
marp: true
theme: gaia
_class: lead
paginate: true
backgroundColor: #0c0602
color: #fcefd2
style: |
  section {
    font-family: 'Space Grotesk', sans-serif;
    padding: 40px 60px;
  }
  h1, h2, h3 {
    color: #fbbf24;
    font-family: 'Space Grotesk', sans-serif;
  }
  code {
    background-color: #231208;
    color: #f59e0b;
    font-family: 'Space Mono', monospace;
    padding: 2px 6px;
    border-radius: 4px;
  }
  strong {
    color: #6ee7b7;
  }
  ul li {
    margin-bottom: 10px;
  }
---

# 🌘 ShadowSwap Core
### A Confidential Concentrated Liquidity Protocol with Opt-In Compliance

**Abstract:**
Automated Market Makers (AMMs) have revolutionized decentralized exchange, yet their fully transparent nature exposes users to predatory **Maximum Extractable Value (MEV)**, front-running, and complete loss of financial privacy. 

**ShadowSwap** is a confidential-native DEX built on the Seismic network. By leveraging a single-factory architecture exclusively for Shielded ERC20 (`SRC20`) tokens, an intelligent Wrapper Router, and a highly optimized Yul-based NFT Compliance Passport, ShadowSwap achieves complete input/output privacy while solving the critical regulatory challenges of dark pools.

---

## 1. Introduction

The deterministic and public nature of the EVM means that every swap, liquidity provision, and tick adjustment is broadcasted in plaintext—fundamentally at odds with financial privacy.

* **Hardware-Enforced Enclaves:** ShadowSwap utilizes Trusted Execution Environments (Intel TDX) to ensure code and data cannot be observed or tampered with by the host OS.
* **Privacy-Aware Opcodes:** Instead of relying solely on ZK-proofs, it utilizes `FlaggedStorage` and shielded types (`suint256`, `sbytes`) compiling to `CSTORE` and `CLOAD`.
* **Dark Pool Mechanics:** Completely obfuscates liquidity depth and trade amounts from the public ledger.

---

## 2. Core Architecture: Factory & Router

To minimize architectural complexity and prevent the fragmentation of public and private states, ShadowSwap abandons the mixed-pool approach.

### 2.1 The `SRC20`-Only Factory
The core protocol consists of a single Factory contract deploying pools **only** for `SRC20-SRC20` pairs. 

All pool reserves, tick data, and liquidity math are calculated using `suint256`—meaning the entire AMM state is a **Dark Pool**. The constant product invariant and concentrated liquidity mathematics are executed entirely inside the TEE enclave.

---

### 2.2 The Intelligent Wrapper Router

The router intercepts standard transactions and acts as the gatekeeper to the dark pool:

1. **Inbound:** Automatically wraps ERC20 tokens into shielded `sERC20` tokens upon entry.
2. **Execution:** Routes the shielded tokens through the confidential `SRC20` pool.
3. **Outbound:** By default, unwraps the output back to ERC20 before delivering it to the user.
4. **Strategic Shielded Adoption:** Users can opt-out of the final unwrap phase, receiving `sERC20` tokens. This maintains continuous privacy and incentivizes wrapped assets as the standard confidential currency across the ecosystem.

---

## 3. The Compliance Passport (NFT)

A major critique of dark pools is their incompatibility with AML/KYC regulations. ShadowSwap introduces the **Compliance Passport**, an initial-mint NFT required for trading.

### 3.1 Yul-Optimized State Compression
Maintains absolute gas efficiency while recording trade history using low-level Yul assembly:
* **Single Trade:** Pair address (20 bytes) + trade volume (up to 12 bytes) are bit-shifted and packed into exactly **one 32-byte storage slot**.
* **High-Frequency Traders:** The protocol seamlessly spans the packed data across 64 bytes (2 slots) when required.

---

### 3.2 Selective Reveal Mechanism

The stored historical data is encrypted at rest using shielded storage mapping. The public cannot read a user's volume. 

However, the user can invoke a `reveal()` function, providing a cryptographic signature to **selectively unshield** this specific slot. This allows users to share their proven trade volume with third-party lending protocols, airdrop snapshotters, or regulatory bodies on-demand.

---

## 4. Advanced User Interface & Execution Logic

The protocol's frontend heavily utilizes **Signed Reads** to query the shielded state. Users are provided with an advanced settings dashboard featuring:

* **Shielded Output Toggle:** Opting to receive `sERC20` instead of standard ERC20.
* **Confidential Slippage Tolerance:** Calculated locally by querying the shielded TWAP oracle securely.
* **Time-Jittering (Transaction Delay):** An optional parameter to intentionally delay the unshielding of tokens to break input/output timing correlation, drastically increasing the anonymity set against heuristic MEV bots.

---

## 5. Conclusion

**ShadowSwap introduces a paradigm shift in decentralized exchange design.**

By isolating the AMM core strictly to `SRC20` tokens and offloading the public-to-private bridging to an intelligent router, the protocol achieves **maximum theoretical privacy**. 

Furthermore, the introduction of a highly gas-optimized, Yul-compressed **NFT Compliance Passport** bridges the gap between absolute on-chain privacy and real-world regulatory compliance.
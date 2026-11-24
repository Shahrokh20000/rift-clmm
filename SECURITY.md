# Security Policy

## Testnet Beta Disclaimer

Rift CLMM (`v0.1 Beta`) is experimental software deployed on **Seismic Testnet (Chain ID `5124`)**.
- Smart contracts in `contracts/` are **unaudited** and intended solely for testnet experimentation and protocol validation.
- In `v0.1 Beta`, standard Solidity event emissions are intentionally kept public to simplify indexing, debugging, and pool-state validation before migrating to Seismic-native shielded event logs in a subsequent milestone.
- Do **not** deploy these contracts to mainnet or deposit real funds of value.

## Reporting a Vulnerability

If you discover a security vulnerability in the smart contracts, frontend client, or Supabase edge functions:

1. **Do not** open a public GitHub issue with exploit details.
2. Reach out privately via X/Twitter [@OX_SHAH](https://x.com/OX_SHAH) or GitHub Security Advisories on this repository.
3. Include a clear reproduction or proof-of-concept and affected file paths.

Please avoid exposing private keys, session tokens, or live testnet admin wallets in public reports or pull requests.

# Crypto Playground

A minimal TypeScript + Foundry setup for experimenting with Ethereum and cryptography.  
The focus is on learning by doing: wallets, transactions, and simple ERC-20 contracts on Sepolia.

---

## Features

- Wallet generation and crypto utilities  
- ETH balance checks and transfers (Sepolia testnet)  
- ERC-20 token deployment, reading, and transfers  
- Modular TypeScript scripts using [viem](https://viem.sh/)  
- Contracts built with [Foundry](https://book.getfoundry.sh/)

---

## Getting started

```bash
git clone https://github.com/yanguly/ts-eth-playground.git # or SSH
cd ts-eth-playground
npm install
```

Create a .env file (see .env.example) with your Sepolia RPC, private key, and addresses.

## Usage

### Wallet & ETH

```bash
npm run dev:wallet     # generate a wallet
npm run dev:balance    # check ETH balance
npm run dev:send       # send ETH transaction
```

### ERC-20

```bash
npm run dev:deploy     # deploy ERC-20 token
npm run dev:read       # read token data and balances
npm run dev:transfer   # transfer tokens
```

## Example

```bash
npm run dev:deploy
# → contract address: 0xABC...

npm run dev:read
# → Yan's Token (YAN), decimals: 18
# → Balance of 0xYourAddress: 1000000 YAN
```

## Notes

- Contracts are compiled with Foundry (`forge build`).
- Scripts are written in TypeScript and use `tsx` for execution.
- This project is for experimentation — not production use.

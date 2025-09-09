# Crypto Playground

A simple project for experimenting with cryptography and Ethereum tools.

## Features

- Test and implement cryptographic algorithms
- Learn about encryption, hashing, and security practices
- Generate Ethereum wallets and addresses
- Check Ethereum balances (Sepolia testnet)
- Send ETH transactions (Sepolia testnet)
- Modular and easy to extend

## Getting Started

Clone the repository:

```bash
git clone yanguly/ts-eth-playground.git
cd ts-eth-playground
```

Install dependencies:

```bash
npm install
```

Create a `.env` file with your Sepolia RPC, private key, and addresses (see `.env.example`).

## Usage

Run scripts with tsx:

```bash
npm run dev:wallet     # Generate Ethereum wallet from mnemonic
npm run dev:balance    # Check ETH balance on Sepolia
npm run dev:send       # Send ETH to another address on Sepolia
```

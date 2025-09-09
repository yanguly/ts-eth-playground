import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { privateKeyToAccount } from 'viem/accounts';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// 1) Мнемоника (12 слов) — СОХРАНИ в оффлайн!
const mnemonic = generateMnemonic(wordlist);
console.log('Mnemonic:', mnemonic);

// 2) Seed из мнемоники
const seed = mnemonicToSeedSync(mnemonic);

// 3) Деривация по пути BIP44 для Ethereum: m/44'/60'/0'/0/0
const path = "m/44'/60'/0'/0/0";
const root = HDKey.fromMasterSeed(seed);
const child = root.derive(path);

if (!child.privateKey) throw new Error('No private key at path');

const pkHex = ('0x' + Buffer.from(child.privateKey).toString('hex')) as `0x${string}`;
const account = privateKeyToAccount(pkHex);

console.log('Derivation path:', path);
console.log('Private key:', pkHex);
console.log('Address:', account.address);

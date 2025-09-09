import { sha256 } from '@noble/hashes/sha2.js';

const msg = new TextEncoder().encode('hello blockchain');
const digest = sha256(msg);

console.log('SHA-256:', Buffer.from(digest).toString('hex'));

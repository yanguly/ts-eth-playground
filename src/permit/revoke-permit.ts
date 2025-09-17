/**
 * Revoke Allowance via EIP‑2612 Permit (value = 0)
 *
 * Description
 * - Creates and submits a Permit signature that sets allowance to zero (revocation).
 * - Builds EIP‑712 domain from on‑chain `name()` and Sepolia chain id.
 * - Verifies signature off‑chain before sending.
 * - Submits the permit using a sender wallet (spender/relayer if provided, otherwise owner).
 *
 * Env
 * - INFURA_SEPOLIA: RPC URL (Sepolia)
 * - TOKEN_ADDRESS:  ERC‑20 token (proxy) address
 * - OWNER_ADDRESS / OWNER_PRIVATE_KEY: owner of the tokens
 * - SPENDER_ADDRESS: spender to revoke
 * - Optional submitter: SPENDER_PRIVATE_KEY (if present, submits from spender; otherwise owner submits)
 *
 * Usage
 * - npm run dev:permit:revoke          # deadline 30 min
 * - npm run dev:permit:revoke -- 90    # deadline 90 min
 */

import 'dotenv/config';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { signTypedData } from 'viem/actions';
import { recoverTypedDataAddress } from 'viem';

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

const RPC = envOrThrow('INFURA_SEPOLIA');
const TOKEN = envOrThrow('TOKEN_ADDRESS') as `0x${string}`;
const OWNER = envOrThrow('OWNER_ADDRESS') as `0x${string}`;
const OWNER_PK = envOrThrow('OWNER_PRIVATE_KEY').replace(/^0x/, '');
const SPENDER = envOrThrow('SPENDER_ADDRESS') as `0x${string}`;
const SUBMITTER_PK = (process.env.SPENDER_PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY)!.replace(
  /^0x/,
  '',
);

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
const owner = privateKeyToAccount(`0x${OWNER_PK}`);
// Sender wallet (spender/relayer if SPENDER_PRIVATE_KEY set; otherwise owner)
const submitter = privateKeyToAccount(`0x${SUBMITTER_PK}`);
const wallet = createWalletClient({ account: submitter, chain: sepolia, transport: http(RPC) });

const abi = parseAbi([
  'function name() view returns (string)',
  'function nonces(address) view returns (uint256)',
  'function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)',
]);

const ttlMinRaw = Number(process.argv[2] ?? 30);
const ttlMin = Number.isFinite(ttlMinRaw) && ttlMinRaw > 0 ? Math.floor(ttlMinRaw) : 30;

async function main() {
  const [name, nonce] = await Promise.all([
    publicClient.readContract({ address: TOKEN, abi, functionName: 'name' }),
    publicClient.readContract({ address: TOKEN, abi, functionName: 'nonces', args: [OWNER] }),
  ]);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + ttlMin * 60);

  const domain = {
    name,
    version: '1',
    chainId: sepolia.id,
    verifyingContract: TOKEN,
  } as const;
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  } as const;
  const message = {
    owner: OWNER,
    spender: SPENDER,
    value: 0n, // revoke
    nonce,
    deadline,
  } as const;

  const signature = await signTypedData(wallet, {
    account: owner,
    domain,
    types,
    primaryType: 'Permit',
    message,
  });

  // sanity: verify off-chain (recover signer and compare to OWNER)
  const recovered = await recoverTypedDataAddress({
    domain,
    types,
    primaryType: 'Permit',
    message,
    signature,
  });
  if (recovered.toLowerCase() !== OWNER.toLowerCase()) {
    throw new Error(`Signature recovers ${recovered}, not OWNER (${OWNER})`);
  }

  // split v,r,s
  const r = `0x${signature.slice(2, 66)}` as `0x${string}`;
  const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
  let v = parseInt(signature.slice(130, 132), 16);
  if (v < 27) v += 27;

  // submit permit on-chain (anyone can submit; submitter pays gas)
  // Preflight simulate for clear errors, then submit with local account (signs & sends raw tx)
  await publicClient.simulateContract({
    address: TOKEN,
    abi,
    functionName: 'permit',
    args: [OWNER, SPENDER, 0n, deadline, v, r, s],
    account: submitter.address,
  });
  const hash = await wallet.writeContract({
    address: TOKEN,
    abi,
    functionName: 'permit',
    args: [OWNER, SPENDER, 0n, deadline, v, r, s],
    account: submitter,
  });
  console.log('revoke permit tx:', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('status:', receipt.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

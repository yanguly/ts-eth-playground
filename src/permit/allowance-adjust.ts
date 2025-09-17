/**
 * Adjust ERC‑20 Allowance (Increase or Decrease)
 *
 * Description
 * - Single utility to call `increaseAllowance(spender, addedValue)` or
 *   `decreaseAllowance(spender, subtractedValue)` on an ERC‑20 token.
 * - Reads `decimals()` to convert human input (e.g. "1.5") to base units.
 * - Prints allowance before and after the change.
 *
 * Env
 * - INFURA_SEPOLIA: RPC URL (Sepolia)
 * - TOKEN_ADDRESS:  ERC‑20 token (proxy) address
 * - OWNER_PRIVATE_KEY: private key of the token owner (0x‑hex)
 * - SPENDER_ADDRESS: default spender address (CLI can override)
 *
 * Usage
 * - npm run dev:allowance:adjust -- inc 1.5 [spender]
 *   → increases allowance by +1.5 tokens (spender optional)
 * - npm run dev:allowance:adjust -- dec 0.75 [spender]
 *   → decreases allowance by −0.75 tokens
 * - npm run dev:allowance:adjust -- set 1.2 [spender]
 *   → sets allowance exactly to 1.2 tokens (uses approve(0) → approve(target))
 * - Optional gas flags: --gas <gwei> --priority <gwei>
 */

import 'dotenv/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  parseGwei,
  parseAbi,
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.INFURA_SEPOLIA!;
const TOKEN = process.env.TOKEN_ADDRESS as `0x${string}`;
const OWNER_PK = (process.env.OWNER_PRIVATE_KEY as string).replace(/^0x/, '');
const DEFAULT_SPENDER = process.env.SPENDER_ADDRESS as `0x${string}`;

const abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function increaseAllowance(address spender,uint256 addedValue) returns (bool)',
  'function decreaseAllowance(address spender,uint256 subtractedValue) returns (bool)',
  'function approve(address spender,uint256 value) returns (bool)',
]);

const [op, humanAmount, spenderOverride] = process.argv.slice(2);
// op: "inc" | "dec" | "set"
if (!op || !humanAmount || (op !== 'inc' && op !== 'dec' && op !== 'set')) {
  console.error('Usage: allowance:adj -- <inc|dec|set> <amount> [spender]');
  process.exit(1);
}
const spender = (spenderOverride as `0x${string}`) || DEFAULT_SPENDER;

// Optional gas flags: --gas <gwei> and --priority <gwei>
let maxFeePerGas: bigint | undefined;
let maxPriorityFeePerGas: bigint | undefined;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--gas' && process.argv[i + 1]) {
    maxFeePerGas = parseGwei(process.argv[i + 1]!);
  }
  if (process.argv[i] === '--priority' && process.argv[i + 1]) {
    maxPriorityFeePerGas = parseGwei(process.argv[i + 1]!);
  }
}

type AdjustFn = 'increaseAllowance' | 'decreaseAllowance';
const pickFn = (o: string): AdjustFn => (o === 'inc' ? 'increaseAllowance' : 'decreaseAllowance');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const owner = privateKeyToAccount(`0x${OWNER_PK}`);
  const wallet = createWalletClient({ account: owner, chain: sepolia, transport: http(RPC) });

  // Read token metadata and current allowance
  const [decimals, symbol, before] = await Promise.all([
    publicClient.readContract({ address: TOKEN, abi, functionName: 'decimals' }),
    publicClient.readContract({ address: TOKEN, abi, functionName: 'symbol' }),
    publicClient.readContract({
      address: TOKEN,
      abi,
      functionName: 'allowance',
      args: [owner.address, spender],
    }),
  ]);
  const delta = parseUnits(humanAmount, Number(decimals));

  console.log(`Token: ${symbol}, decimals=${decimals}`);
  console.log(`Owner:  ${owner.address}`);
  console.log(`Spender:${spender}`);
  console.log(
    `Allowance(before): ${before.toString()} raw (${formatUnits(before, Number(decimals))} ${symbol})`,
  );

  // Desired target after adjustment (for set, exact target)
  const target =
    op === 'set' ? delta : op === 'inc' ? before + delta : before >= delta ? before - delta : 0n;
  if (before === target) {
    console.log('No change required: target equals current allowance.');
    return;
  }

  // Try single-step safe adjust for inc/dec only
  const singleFn = pickFn(op);
  let usedFallback = false;
  const needFallback = op === 'set';
  try {
    if (needFallback) throw new Error('skip-single-step');
    await publicClient.simulateContract({
      address: TOKEN,
      abi,
      functionName: singleFn as 'increaseAllowance' | 'decreaseAllowance',
      args: [spender, delta],
      account: owner.address,
    });

    const tx = await wallet.writeContract({
      address: TOKEN,
      abi,
      functionName: singleFn as AdjustFn,
      args: [spender, delta],
      ...(maxFeePerGas ? { maxFeePerGas } : {}),
      ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
    });
    console.log(`${singleFn} tx:`, tx);
    await publicClient.waitForTransactionReceipt({ hash: tx });
  } catch {
    // Fallback to approve(0) then approve(target) sequence.
    // Not truly atomic on-chain, but simulates both steps first and only send if both pass.
    usedFallback = true;
    console.log(
      'Single-step adjust reverted in simulation; using zero-then-set fallback (approve).',
    );

    // 1) Simulate approve(spender, 0)
    await publicClient.simulateContract({
      address: TOKEN,
      abi,
      functionName: 'approve',
      args: [spender, 0n],
      account: owner.address,
    });
    // 2) Simulate approve(spender, target)
    await publicClient.simulateContract({
      address: TOKEN,
      abi,
      functionName: 'approve',
      args: [spender, target],
      account: owner.address,
    });

    // Send step 1
    const tx1 = await wallet.writeContract({
      address: TOKEN,
      abi,
      functionName: 'approve',
      args: [spender, 0n],
      ...(maxFeePerGas ? { maxFeePerGas } : {}),
      ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
    });
    console.log('approve(0) tx:', tx1);
    await publicClient.waitForTransactionReceipt({ hash: tx1 });

    // Send step 2; if it fails, attempt best-effort restore to before
    try {
      const tx2 = await wallet.writeContract({
        address: TOKEN,
        abi,
        functionName: 'approve',
        args: [spender, target],
        ...(maxFeePerGas ? { maxFeePerGas } : {}),
        ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
      });
      console.log('approve(target) tx:', tx2);
      await publicClient.waitForTransactionReceipt({ hash: tx2 });
    } catch (e) {
      console.error('approve(target) failed, attempting to restore previous allowance...');
      try {
        const txRestore = await wallet.writeContract({
          address: TOKEN,
          abi,
          functionName: 'approve',
          args: [spender, before],
          ...(maxFeePerGas ? { maxFeePerGas } : {}),
          ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
        });
        console.log('restore approve(before) tx:', txRestore);
        await publicClient.waitForTransactionReceipt({ hash: txRestore });
      } catch {
        console.error('Failed to restore previous allowance. Manual intervention may be required.');
      }
      throw e;
    }
  }

  // Read updated allowance
  let after: bigint = 0n;
  for (let i = 0; i < 5; i++) {
    after = (await publicClient.readContract({
      address: TOKEN,
      abi,
      functionName: 'allowance',
      args: [owner.address, spender],
    })) as bigint;
    if (after === target) break;
    await sleep(500);
  }
  console.log(
    `Allowance(after):  ${after.toString()} raw (${formatUnits(after, Number(decimals))} ${symbol})${
      usedFallback ? ' (fallback path)' : ''
    }`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

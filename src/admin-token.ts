import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// Unified ERC20(+extensions) ABI used by this admin CLI.
// Not all functions must exist on-chain; reads will be guarded.
export const abi = parseAbi([
  // ERC20 metadata + state
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner,address spender) view returns (uint256)',
  // Ownable (for info)
  'function owner() view returns (address)',
  // Pausable / AccessControl
  'function pause() external',
  'function unpause() external',
  'function paused() view returns (bool)',
  'function hasRole(bytes32,address) view returns (bool)',
  'function PAUSER_ROLE() view returns (bytes32)',
  // Mint / Burn
  'function mint(address to,uint256 amount) external',
  'function burn(uint256 amount) external',
  'function burnFrom(address account,uint256 amount) external',
]);

export function env(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

export async function safeRead<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined as unknown as T;
  }
}

export type Address = `0x${string}`;

type Public = ReturnType<typeof createPublicClient>;
type Wallet = ReturnType<typeof createWalletClient>;

export type Ctx = {
  token: Address;
  account: ReturnType<typeof privateKeyToAccount>;
  publicClient: Public;
  wallet: Wallet;
};

export async function readDecimals(ctx: Ctx): Promise<number> {
  const d = await safeRead(() =>
    ctx.publicClient.readContract({ address: ctx.token, abi, functionName: 'decimals' }),
  );
  return Number(d ?? 18);
}

export async function cmdStatus(ctx: Ctx) {
  const { publicClient, token, account } = ctx;
  const [name, symbol, decimals, totalSupply, paused, owner] = await Promise.all([
    safeRead(() => publicClient.readContract({ address: token, abi, functionName: 'name' })),
    safeRead(() => publicClient.readContract({ address: token, abi, functionName: 'symbol' })),
    safeRead(() => publicClient.readContract({ address: token, abi, functionName: 'decimals' })),
    safeRead(() => publicClient.readContract({ address: token, abi, functionName: 'totalSupply' })),
    safeRead(() => publicClient.readContract({ address: token, abi, functionName: 'paused' })),
    safeRead(() => publicClient.readContract({ address: token, abi, functionName: 'owner' })),
  ]);

  let pauserRole: string | undefined;
  let hasPauser = false;
  try {
    const role = (await publicClient.readContract({
      address: token,
      abi,
      functionName: 'PAUSER_ROLE',
    })) as Address;
    pauserRole = role;
    hasPauser = await publicClient.readContract({
      address: token,
      abi,
      functionName: 'hasRole',
      args: [role, account.address],
    });
  } catch {
    // empty
  }

  const d = (decimals as number | undefined) ?? 18;
  const tsStr = totalSupply ? formatUnits(totalSupply as bigint, d) : 'n/a';

  console.log('Token:', name ?? 'n/a', `(${symbol ?? 'n/a'})`);
  console.log('Decimals:', d);
  console.log('TotalSupply:', tsStr);
  console.log('Signer:', account.address);
  console.log('Owner:', owner ?? 'n/a');
  if (paused !== undefined) console.log('Paused:', paused);
  if (pauserRole) console.log('PauserRole:', pauserRole, 'hasRole(signer):', hasPauser);
}

export async function cmdPause(ctx: Ctx) {
  await ctx.publicClient.simulateContract({
    address: ctx.token,
    abi,
    functionName: 'pause',
    account: ctx.account.address,
  });
  const hash = await ctx.wallet.writeContract({
    address: ctx.token,
    abi,
    functionName: 'pause',
    chain: sepolia,
    account: ctx.account,
  });
  console.log('pause tx:', hash);
}

export async function cmdUnpause(ctx: Ctx) {
  await ctx.publicClient.simulateContract({
    address: ctx.token,
    abi,
    functionName: 'unpause',
    account: ctx.account.address,
  });
  const hash = await ctx.wallet.writeContract({
    address: ctx.token,
    abi,
    functionName: 'unpause',
    chain: sepolia,
    account: ctx.account,
  });
  console.log('unpause tx:', hash);
}

export async function cmdMint(ctx: Ctx, amountStr?: string, to?: Address) {
  if (!amountStr) throw new Error('mint <amount> [to]');
  const decimals = await readDecimals(ctx);
  const amount = parseUnits(amountStr, Number(decimals));
  const dest = (to as Address) ?? ctx.account.address;
  await ctx.publicClient.simulateContract({
    address: ctx.token,
    abi,
    functionName: 'mint',
    args: [dest, amount],
    account: ctx.account.address,
  });
  const hash = await ctx.wallet.writeContract({
    address: ctx.token,
    abi,
    functionName: 'mint',
    args: [dest, amount],
    chain: sepolia,
    account: ctx.account,
  });
  console.log('mint tx:', hash);
}

export async function cmdBurn(ctx: Ctx, amountStr?: string) {
  if (!amountStr) throw new Error('burn <amount>');
  const decimals = await readDecimals(ctx);
  const amount = parseUnits(amountStr, Number(decimals));
  await ctx.publicClient.simulateContract({
    address: ctx.token,
    abi,
    functionName: 'burn',
    args: [amount],
    account: ctx.account.address,
  });
  const hash = await ctx.wallet.writeContract({
    address: ctx.token,
    abi,
    functionName: 'burn',
    args: [amount],
    chain: sepolia,
    account: ctx.account,
  });
  console.log('burn tx:', hash);
}

export async function cmdBurnFrom(ctx: Ctx, owner?: Address, amountStr?: string) {
  if (!owner || !amountStr) throw new Error('burnFrom <owner> <amount>');
  const decimals = await readDecimals(ctx);
  const amount = parseUnits(amountStr, Number(decimals));
  await ctx.publicClient.simulateContract({
    address: ctx.token,
    abi,
    functionName: 'burnFrom',
    args: [owner, amount],
    account: ctx.account.address,
  });
  const hash = await ctx.wallet.writeContract({
    address: ctx.token,
    abi,
    functionName: 'burnFrom',
    args: [owner, amount],
    chain: sepolia,
    account: ctx.account,
  });
  console.log('burnFrom tx:', hash);
}

async function main() {
  const RPC = env('INFURA_SEPOLIA');
  const TOKEN = env('TOKEN_ADDRESS') as `0x${string}`;
  const PK = env('PRIVATE_KEY') as `0x${string}`;

  const account = privateKeyToAccount(PK);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

  const [cmd, arg1, arg2] = process.argv.slice(2);
  if (!cmd) {
    console.log('Usage:');
    console.log('  npm run admin -- status');
    console.log('  npm run admin -- pause | unpause');
    console.log('  npm run admin -- mint <amount> [to]');
    console.log('  npm run admin -- burn <amount>');
    console.log('  npm run admin -- burnFrom <owner> <amount>');
    process.exit(1);
  }

  const ctx: Ctx = { token: TOKEN, account, publicClient, wallet };

  switch (cmd) {
    case 'status':
      await cmdStatus(ctx);
      break;
    case 'pause':
      await cmdPause(ctx);
      break;
    case 'unpause':
      await cmdUnpause(ctx);
      break;
    case 'mint':
      await cmdMint(ctx, arg1, arg2 as Address | undefined);
      break;
    case 'burn':
      await cmdBurn(ctx, arg1);
      break;
    case 'burnFrom':
      await cmdBurnFrom(ctx, arg1 as Address | undefined, arg2);
      break;
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}

const isDirectRun = (() => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    return resolve(process.argv[1] || '') === resolve(thisFile);
  } catch {
    return true;
  }
})();

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

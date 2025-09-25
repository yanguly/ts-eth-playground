import 'dotenv/config';
import { createPublicClient, createWalletClient, http, type PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { pathToFileURL } from 'url';

// -----------------------------------------------------------------------------
// Types & constants
// -----------------------------------------------------------------------------

export type HexAddress = `0x${string}`;

// Raw env mirrors process.env, optional until validated.
export type RawEnv = {
  rpcUrl?: string;
  privateKey?: HexAddress;
  tokenAddress?: HexAddress;
  ownerAddress?: HexAddress;
};

// Loaded env guarantees required fields are present.
export type LoadedEnv = Required<Omit<RawEnv, 'ownerAddress'>> & {
  ownerAddress?: HexAddress;
};

export interface InitializeClients {
  publicClient: Pick<PublicClient, 'readContract' | 'waitForTransactionReceipt'>;
  walletClient: Pick<ReturnType<typeof createWalletClient>, 'writeContract'>;
}

// AccessControl's default admin role identifier.
const DEFAULT_ADMIN_ROLE =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

// Minimal ABI surface we need for init + role checks.
const ABI = [
  {
    type: 'function',
    name: 'initializeV3',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'admin', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// -----------------------------------------------------------------------------
// Environment & CLI helpers
// -----------------------------------------------------------------------------

// Collect env vars once and fail fast if anything mandatory is missing.
export function loadEnv(
  raw: RawEnv = {
    rpcUrl: process.env.NETWORK_RPC_URL,
    privateKey: process.env.PRIVATE_KEY as HexAddress | undefined,
    tokenAddress: process.env.TOKEN_ADDRESS as HexAddress | undefined,
    ownerAddress: process.env.OWNER_ADDRESS as HexAddress | undefined,
  },
): LoadedEnv {
  if (!raw.rpcUrl || !raw.privateKey || !raw.tokenAddress) {
    throw new Error('Missing env: NETWORK_RPC_URL, PRIVATE_KEY, TOKEN_ADDRESS');
  }

  return {
    rpcUrl: raw.rpcUrl,
    privateKey: raw.privateKey,
    tokenAddress: raw.tokenAddress,
    ownerAddress: raw.ownerAddress,
  };
}

export interface CliOptions {
  admin?: HexAddress;
}

// Tiny CLI parser: supports --admin/-a and --help.
export function parseCliOptions(args: string[] = process.argv.slice(2)): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];

    switch (flag) {
      case '--admin':
      case '-a': {
        const value = args[++index];
        if (!value) throw new Error(`${flag} expects an address`);
        options.admin = value as HexAddress;
        break;
      }
      case '--help':
      case '-h':
        printUsageAndExit();
        break; // δεν φτάνει αλλά для полноты
      default:
        console.warn(`Ignoring unknown argument "${flag}"`);
        break;
    }
  }

  return options;
}

// Human-friendly usage hint for direct invocation.
export function printUsageAndExit(): never {
  console.log(`
Usage: npm run dev:init-v3 -- [--admin 0xADDRESS]

Initialises YansTokenUUPSv3 after upgrade, assigning DEFAULT_ADMIN_ROLE & PAUSER_ROLE.
If --admin omitted, falls back to OWNER_ADDRESS env (if set).
`);
  process.exit(0);
}

// Choose admin from CLI override or OWNER_ADDRESS.
export function resolveAdminTarget(cli: CliOptions, env: LoadedEnv): HexAddress {
  const admin = cli.admin ?? env.ownerAddress;
  if (!admin) throw new Error('Admin address required: pass --admin 0x... or set OWNER_ADDRESS');
  return admin;
}

// -----------------------------------------------------------------------------
// Contract helpers
// -----------------------------------------------------------------------------

// Convenience wrapper around hasRole(role, account).
export async function hasDefaultAdminRole(
  client: InitializeClients['publicClient'],
  env: LoadedEnv,
  account: HexAddress,
): Promise<boolean> {
  return (await client.readContract({
    address: env.tokenAddress,
    abi: ABI,
    functionName: 'hasRole',
    args: [DEFAULT_ADMIN_ROLE, account],
  })) as boolean;
}

// Wire viem clients for the provided RPC + signer.
function createClients(env: LoadedEnv): InitializeClients {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(env.rpcUrl),
  });

  const walletClient = createWalletClient({
    account: privateKeyToAccount(env.privateKey),
    chain: sepolia,
    transport: http(env.rpcUrl),
  });

  return { publicClient, walletClient };
}

// Main workflow: skip if already admin, otherwise call initializeV3 and confirm.
export async function runInitializeV3(
  env: LoadedEnv,
  admin: HexAddress,
  clients: InitializeClients = createClients(env),
): Promise<void> {
  const { publicClient, walletClient } = clients;
  const account = privateKeyToAccount(env.privateKey);

  console.log(`Admin candidate: ${admin}`);

  const alreadyAdmin = await hasDefaultAdminRole(publicClient, env, admin);
  console.log(`Has DEFAULT_ADMIN_ROLE already? ${alreadyAdmin}`);

  if (alreadyAdmin) {
    console.log('Nothing to do: admin already assigned.');
    return;
  }

  const txHash = await walletClient.writeContract({
    address: env.tokenAddress,
    abi: ABI,
    functionName: 'initializeV3',
    args: [admin],
    chain: sepolia,
    account,
  });

  console.log('initializeV3 tx hash:', txHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('status:', receipt.status);

  const hasRoleAfter = await hasDefaultAdminRole(publicClient, env, admin);
  console.log(`Has DEFAULT_ADMIN_ROLE after init? ${hasRoleAfter}`);
}

export async function main(args?: string[]): Promise<void> {
  const env = loadEnv();
  const options = parseCliOptions(args);
  const admin = resolveAdminTarget(options, env);
  await runInitializeV3(env, admin);
}

// Execute main() only when launched directly (CLI usage).
const isDirectExecution = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(entry).href === import.meta.url;
})();

if (isDirectExecution) {
  main().catch((error) => {
    console.error('initialize-v3 failed:', error);
    process.exit(1);
  });
}

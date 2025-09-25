import 'dotenv/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToBytes,
  type PublicClient,
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { pathToFileURL } from 'url';

export type HexAddress = `0x${string}`;
export type HexRole = `0x${string}`;

// Minimal AccessControl surface the script interacts with.
const ROLE_ABI = [
  {
    type: 'function',
    name: 'grantRole',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revokeRole',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
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

// Raw env snapshot; optional until validated by loadRoleEnv.
export type RawRoleEnv = {
  rpcUrl?: string;
  privateKey?: HexAddress;
  tokenAddress?: HexAddress;
};

export type RoleEnv = Required<RawRoleEnv>;

export interface RoleClients {
  publicClient: Pick<PublicClient, 'readContract' | 'waitForTransactionReceipt'>;
  walletClient: Pick<ReturnType<typeof createWalletClient>, 'writeContract'>;
}

export type RoleAction = 'grant' | 'revoke';

export interface RoleCliOptions {
  action: RoleAction;
  roleInput: string;
  target: HexAddress;
}

export const ROLE_MAP: Record<string, HexRole> = {
  pauser: keccak256(stringToBytes('PAUSER_ROLE')),
  admin: '0x0000000000000000000000000000000000000000000000000000000000000000',
  'default-admin': '0x0000000000000000000000000000000000000000000000000000000000000000',
};

// Human-readable usage banner printed on --help.
export function printUsageAndExit(): never {
  console.log(`
Usage: npm run dev:roles -- <grant|revoke> --role <pauser|admin|0x...> --to <address>

Examples:
  npm run dev:roles -- grant --role pauser --to 0xAbc...
  npm run dev:roles -- revoke --role 0x0123... --to 0xDef...

Env requirements:
  NETWORK_RPC_URL, PRIVATE_KEY, TOKEN_ADDRESS
`);
  process.exit(0);
}

// Validate presence of required env vars for RPC + signer.
export function loadRoleEnv(
  raw: RawRoleEnv = {
    rpcUrl: process.env.NETWORK_RPC_URL,
    privateKey: process.env.PRIVATE_KEY as HexAddress | undefined,
    tokenAddress: process.env.TOKEN_ADDRESS as HexAddress | undefined,
  },
): RoleEnv {
  if (!raw.rpcUrl || !raw.privateKey || !raw.tokenAddress) {
    throw new Error('Missing env: NETWORK_RPC_URL, PRIVATE_KEY, TOKEN_ADDRESS');
  }
  return {
    rpcUrl: raw.rpcUrl,
    privateKey: raw.privateKey,
    tokenAddress: raw.tokenAddress,
  };
}

// Parse action/flags, throwing early on conflicting or missing values.
export function parseRoleArgs(args: string[] = process.argv.slice(2)): RoleCliOptions {
  if (args.length === 0) {
    throw new Error('Action required: grant or revoke');
  }

  let action: RoleAction | null = null;
  let roleInput: string | undefined;
  let target: HexAddress | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    switch (token) {
      case 'grant':
      case 'revoke':
        if (action !== null) {
          throw new Error('Action already specified');
        }
        action = token;
        break;

      case '--role':
      case '-r': {
        const value = args[++index];
        if (!value) throw new Error(`${token} expects a role identifier`);
        roleInput = value;
        break;
      }

      case '--to':
      case '--addr':
      case '--address':
      case '-t': {
        const value = args[++index];
        if (!value) throw new Error(`${token} expects an address`);
        target = value as HexAddress;
        break;
      }

      case '--help':
      case '-h':
        printUsageAndExit();
        break;

      default:
        console.warn(`Ignoring unknown argument "${token}"`);
        break;
    }
  }

  if (!action) throw new Error('Action required: grant or revoke');
  if (!roleInput) throw new Error('Missing --role <pauser|admin|0x...>');
  if (!target) throw new Error('Missing --to <address>');

  return { action, roleInput, target };
}

// Resolve aliases (pauser/admin) or accept raw bytes32 identifiers.
export function resolveRole(roleInput: string): HexRole {
  if (roleInput.startsWith('0x')) return roleInput as HexRole;
  const resolved = ROLE_MAP[roleInput.toLowerCase()];
  if (!resolved) {
    throw new Error(`Unsupported role "${roleInput}". Use pauser, admin, or 0x...`);
  }
  return resolved;
}

// Wire viem clients scoped to the configured signer.
function createRoleClients(env: RoleEnv): RoleClients {
  const publicClient = createPublicClient({ chain: sepolia, transport: http(env.rpcUrl) });
  const walletClient = createWalletClient({
    account: privateKeyToAccount(env.privateKey),
    chain: sepolia,
    transport: http(env.rpcUrl),
  });
  return { publicClient, walletClient };
}

// Grant/revoke role and report state before/after.
export async function executeRoleCommand(
  env: RoleEnv,
  options: RoleCliOptions,
  clients: RoleClients = createRoleClients(env),
): Promise<void> {
  const role = resolveRole(options.roleInput);
  const { publicClient, walletClient } = clients;
  const account = privateKeyToAccount(env.privateKey);

  const hadRole = (await publicClient.readContract({
    address: env.tokenAddress,
    abi: [ROLE_ABI[2]],
    functionName: 'hasRole',
    args: [role, options.target],
  })) as boolean;

  console.log(`Before: hasRole = ${hadRole}`);

  const functionName = options.action === 'grant' ? 'grantRole' : 'revokeRole';

  const txHash = await walletClient.writeContract({
    address: env.tokenAddress,
    abi: ROLE_ABI,
    functionName,
    args: [role, options.target],
    chain: sepolia,
    account,
  });

  console.log(`${functionName} tx hash:`, txHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('status:', receipt.status);

  const hasRoleAfter = (await publicClient.readContract({
    address: env.tokenAddress,
    abi: [ROLE_ABI[2]],
    functionName: 'hasRole',
    args: [role, options.target],
  })) as boolean;

  console.log(`After: hasRole = ${hasRoleAfter}`);
}

export async function main(args?: string[]): Promise<void> {
  const env = loadRoleEnv();
  const options = parseRoleArgs(args);
  await executeRoleCommand(env, options);
}

// Execute main() only when launched directly (CLI usage).
const isDirectExecution = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(entry).href === import.meta.url;
})();

if (isDirectExecution) {
  main().catch((error) => {
    console.error('roles-manage failed:', error);
    process.exit(1);
  });
}

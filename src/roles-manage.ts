import 'dotenv/config';
import { createWalletClient, createPublicClient, http, keccak256, stringToBytes } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.NETWORK_RPC_URL;
const PK = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const TOKEN = process.env.TOKEN_ADDRESS as `0x${string}` | undefined;

function usage(): never {
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
// 0xbF449029ab74226a844A6fB78CEa76CEe10c3aa7
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  usage();
}

let action: 'grant' | 'revoke' | null = null;
let roleInput: string | undefined;
let target: `0x${string}` | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === 'grant' || arg === 'revoke') && action === null) {
    action = arg;
    continue;
  }
  if (arg === '--role' || arg === '-r') {
    roleInput = args[++i];
    continue;
  }
  if (arg === '--to' || arg === '--addr' || arg === '--address' || arg === '-t') {
    target = args[++i] as `0x${string}`;
    continue;
  }
  console.warn(`Ignoring unknown argument "${arg}"`);
}

if (!RPC || !PK || !TOKEN) {
  throw new Error('Missing env: NETWORK_RPC_URL, PRIVATE_KEY, TOKEN_ADDRESS');
}
if (!action) {
  throw new Error('Action required: grant or revoke');
}
if (!roleInput) {
  throw new Error('Missing --role <pauser|admin|0x...>');
}
if (!target) {
  throw new Error('Missing --to <address>');
}

const ROLE_MAP: Record<string, `0x${string}`> = {
  pauser: keccak256(stringToBytes('PAUSER_ROLE')),
  admin: '0x0000000000000000000000000000000000000000000000000000000000000000',
  'default-admin': '0x0000000000000000000000000000000000000000000000000000000000000000',
};

const resolvedRole = roleInput.startsWith('0x')
  ? (roleInput as `0x${string}`)
  : ROLE_MAP[roleInput.toLowerCase()];

if (!resolvedRole) {
  throw new Error(`Unsupported role "${roleInput}". Use pauser, admin, or 0x...`);
}

const abi = [
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

(async () => {
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const account = privateKeyToAccount(PK);
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

  const hadRole = (await publicClient.readContract({
    address: TOKEN,
    abi,
    functionName: 'hasRole',
    args: [resolvedRole, target],
  })) as boolean;

  console.log(`Before: hasRole = ${hadRole}`);

  const functionName = action === 'grant' ? 'grantRole' : 'revokeRole';
  const hash = await wallet.writeContract({
    address: TOKEN,
    abi,
    functionName,
    args: [resolvedRole, target],
  });
  console.log(`${functionName} tx hash:`, hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('status:', receipt.status);

  const hasRoleAfter = (await publicClient.readContract({
    address: TOKEN,
    abi,
    functionName: 'hasRole',
    args: [resolvedRole, target],
  })) as boolean;
  console.log(`After: hasRole = ${hasRoleAfter}`);
})();

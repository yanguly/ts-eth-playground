import 'dotenv/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatUnits,
  parseUnits,
  getAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const RPC = process.env.INFURA_SEPOLIA!;
const TOKEN = process.env.TOKEN_ADDRESS as `0x${string}`;
const OWNER = process.env.OWNER_ADDRESS as `0x${string}`;
const SPENDER_PK = process.env.SPENDER_PRIVATE_KEY!.replace(/^0x/, '');

// CLI usage:
//   npm run dev:permit:spend                 # transfers full PERMIT_VALUE → SPENDER
//   npm run dev:permit:spend -- 0.75         # transfers 0.75 token → SPENDER
//   npm run dev:permit:spend -- 1.2 --to 0x...  # transfers 1.2 token → given address
type Cli = { amount?: string; to?: string };
function parseCli(argv: string[]): Cli {
  const out: Cli = {};
  if (argv[2] && !argv[2].startsWith('--')) out.amount = argv[2];
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--to' && argv[i + 1]) out.to = argv[i + 1];
  }
  return out;
}
const cli = parseCli(process.argv);

const spender = privateKeyToAccount(`0x${SPENDER_PK}`);
const wallet = createWalletClient({ account: spender, chain: sepolia, transport: http(RPC) });
const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });

const abi = parseAbi([
  'function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)',
  'function transferFrom(address from,address to,uint256 value) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);

function splitSig(sig: `0x${string}`) {
  // Extract r, s, v from a 65-byte signature (0x + r(32) + s(32) + v(1))
  const r = `0x${sig.slice(2, 66)}` as `0x${string}`;
  const s = `0x${sig.slice(66, 130)}` as `0x${string}`;
  let v = parseInt(sig.slice(130, 132), 16);
  if (v < 27) v += 27; // normalize if 0/1 is used
  return { r, s, v };
}

async function main() {
  const PERMIT_SIGNATURE = process.env.PERMIT_SIGNATURE as `0x${string}`;
  const PERMIT_VALUE = BigInt(process.env.PERMIT_VALUE!);
  const PERMIT_DEADLINE = BigInt(process.env.PERMIT_DEADLINE!);

  const [decimals, symbol] = await Promise.all([
    publicClient.readContract({ address: TOKEN, abi, functionName: 'decimals' }),
    publicClient.readContract({ address: TOKEN, abi, functionName: 'symbol' }),
  ]);

  // Default recipient is the SPENDER; can be overridden via --to 0x...
  const to = getAddress((cli.to as `0x${string}`) ?? spender.address);

  // Amount to transfer: default to full PERMIT_VALUE; can be overridden by a human-readable amount
  const valueToSpend = cli.amount ? parseUnits(cli.amount, Number(decimals)) : PERMIT_VALUE;

  // 1) Submit the permit (spender pays gas, owner pays nothing)
  const { v, r, s } = splitSig(PERMIT_SIGNATURE);
  const tx1 = await wallet.writeContract({
    address: TOKEN,
    abi,
    functionName: 'permit',
    args: [OWNER, spender.address, PERMIT_VALUE, PERMIT_DEADLINE, v, r, s],
  });
  console.log('permit tx:', tx1);

  // 2) Transfer tokens from OWNER to the recipient using the granted allowance
  const tx2 = await wallet.writeContract({
    address: TOKEN,
    abi,
    functionName: 'transferFrom',
    args: [OWNER, to, valueToSpend],
  });
  console.log('transferFrom tx:', tx2);

  console.log(`✔ transferred ${formatUnits(valueToSpend, Number(decimals))} ${symbol} to ${to}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

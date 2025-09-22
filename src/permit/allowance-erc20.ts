import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress, formatUnits } from 'viem';
import { sepolia } from 'viem/chains';

type Cli = { token?: string; owner?: string; spender?: string };
function parseCli(argv: string[]): Cli {
  const out: Cli = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--token' && v) out.token = v;
    if (k === '--owner' && v) out.owner = v;
    if (k === '--spender' && v) out.spender = v;
  }
  return out;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val || !val.trim()) {
    throw new Error(`.env variable missing ${name}`);
  }
  return val.trim();
}

const cli = parseCli(process.argv);

const RPC = requireEnv('NETWORK_RPC_URL');
const TOKEN_ADDRESS = (cli.token ?? requireEnv('TOKEN_ADDRESS')) as `0x${string}`;
const OWNER_ADDRESS = (cli.owner ?? requireEnv('OWNER_ADDRESS')) as `0x${string}`;
const SPENDER_ADDRESS = (cli.spender ?? requireEnv('SPENDER_ADDRESS')) as `0x${string}`;

const token = getAddress(TOKEN_ADDRESS);
const owner = getAddress(OWNER_ADDRESS);
const spender = getAddress(SPENDER_ADDRESS);

const abi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
]);

const client = createPublicClient({
  chain: sepolia,
  transport: http(RPC),
});

async function main() {
  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({ address: token, abi, functionName: 'name' }),
      client.readContract({ address: token, abi, functionName: 'symbol' }),
      client.readContract({ address: token, abi, functionName: 'decimals' }),
    ]);

    const rawAllowance = await client.readContract({
      address: token,
      abi,
      functionName: 'allowance',
      args: [owner, spender],
    });

    const human = formatUnits(rawAllowance, Number(decimals));

    console.log('================ ALLOWANCE ================');
    console.log(`Token:     ${name} (${symbol}) @ ${token}`);
    console.log(`Decimals:  ${decimals}`);
    console.log(`Owner:     ${owner}`);
    console.log(`Spender:   ${spender}`);
    console.log('-------------------------------------------');
    console.log(`Raw:       ${rawAllowance} (min units)`);
    console.log(`Readable:  ${human} ${symbol}`);
    console.log('===========================================');
  } catch (e: unknown) {
    const err = e as { shortMessage?: string; details?: string };
    if (err?.shortMessage) {
      console.error('Viem error:', err.shortMessage);
    }
    if (err?.details) {
      console.error('Details:', err.details);
    }
    console.error('Stack:', err);
    process.exitCode = 1;
  }
}

main();

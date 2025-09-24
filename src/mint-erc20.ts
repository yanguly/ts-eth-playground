import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

type CliArgs = { to?: `0x${string}`; amount?: string; amountWei?: string };

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const next = args[i + 1];
    switch (flag) {
      case '--to':
      case '-t':
        if (!next) throw new Error(`${flag} expects an address`);
        result.to = next as `0x${string}`;
        i++;
        break;
      case '--amount':
      case '-a':
        if (!next) throw new Error(`${flag} expects a decimal amount (e.g. 123.45)`);
        result.amount = next;
        i++;
        break;
      case '--amount-wei':
      case '--wei':
        if (!next) throw new Error(`${flag} expects a raw wei amount`);
        result.amountWei = next;
        i++;
        break;
      case '--help':
      case '-h':
        printUsageAndExit();
        break;
      default:
        console.warn(`Unknown argument "${flag}" ignored`);
        break;
    }
  }

  return result;
}

function printUsageAndExit(): never {
  console.log(`Usage: npm run dev:mint -- --to <addr> (--amount <human> | --amount-wei <wei>)

Flags override env vars (MINT_TO, MINT_AMOUNT, MINT_AMOUNT_WEI).
Examples:
  npm run dev:mint -- --to 0xAbc... --amount 250
  npm run dev:mint -- --to 0xAbc... --amount-wei 1000000000000000000
`);
  process.exit(0);
}

const cli = parseCliArgs();

// Inputs (CLI override > env)
const RPC = process.env.NETWORK_RPC_URL!;
const PK = process.env.PRIVATE_KEY as `0x${string}`;
const TOKEN = process.env.TOKEN_ADDRESS as `0x${string}`; // proxy address
const TO = cli.to ?? (process.env.MINT_TO as `0x${string}`) ?? null;
const AMOUNT = cli.amount ?? process.env.MINT_AMOUNT ?? null; // human amount, e.g. "123.45"
const AMOUNT_WEI = cli.amountWei ?? process.env.MINT_AMOUNT_WEI ?? null; // raw wei override

if (!RPC || !PK || !TOKEN || !TO || (!AMOUNT && !AMOUNT_WEI)) {
  throw new Error(
    'Missing inputs: ensure NETWORK_RPC_URL, PRIVATE_KEY, TOKEN_ADDRESS, and (CLI or env) MINT_TO plus (MINT_AMOUNT or MINT_AMOUNT_WEI)',
  );
}

// Minimal ABI for mint + helpers
const abi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

(async () => {
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });

  // Resolve decimals and owner for safety
  const [decimals, owner] = await Promise.all([
    publicClient.readContract({ address: TOKEN, abi, functionName: 'decimals' }) as Promise<number>,
    publicClient.readContract({
      address: TOKEN,
      abi,
      functionName: 'owner',
    }) as Promise<`0x${string}`>,
  ]);

  const account = privateKeyToAccount(PK);
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`Sender is not owner. owner=${owner} sender=${account.address}`);
  }

  const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

  // Choose amount source
  const amountWei = AMOUNT_WEI ? BigInt(AMOUNT_WEI) : parseUnits(AMOUNT!, decimals);
  console.log(`mint -> to=${TO}, amountWei=${amountWei.toString()} (decimals=${decimals})`);

  const hash = await wallet.writeContract({
    address: TOKEN,
    abi,
    functionName: 'mint',
    args: [TO, amountWei],
  });
  console.log('mint tx hash:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('status:', receipt.status);
})();

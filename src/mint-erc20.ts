import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Env
const RPC = process.env.NETWORK_RPC_URL!;
const PK = process.env.PRIVATE_KEY as `0x${string}`;
const TOKEN = process.env.TOKEN_ADDRESS as `0x${string}`; // proxy address
const TO = process.env.MINT_TO as `0x${string}`;
const AMOUNT = process.env.MINT_AMOUNT; // human amount, e.g. "123.45"
const AMOUNT_WEI = process.env.MINT_AMOUNT_WEI; // raw wei (optional override)

if (!RPC || !PK || !TOKEN || !TO || (!AMOUNT && !AMOUNT_WEI)) {
  throw new Error(
    'Missing env: NETWORK_RPC_URL, PRIVATE_KEY, TOKEN_ADDRESS, MINT_TO, (MINT_AMOUNT | MINT_AMOUNT_WEI)',
  );
}

// Minimal ABI for V2 mint + helpers
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
  const amountWei = AMOUNT_WEI ? (BigInt(AMOUNT_WEI) as bigint) : parseUnits(AMOUNT!, decimals);
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

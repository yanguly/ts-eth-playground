import 'dotenv/config';
import { createPublicClient, createWalletClient, http, parseAbi, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { signTypedData } from 'viem/actions';

const RPC = process.env.NETWORK_RPC_URL!;
const TOKEN = process.env.TOKEN_ADDRESS as `0x${string}`;
const OWNER = process.env.OWNER_ADDRESS as `0x${string}`;
const OWNER_PK = process.env.OWNER_PRIVATE_KEY!.replace(/^0x/, '');

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
const owner = privateKeyToAccount(`0x${OWNER_PK}`);
const wallet = createWalletClient({ account: owner, chain: sepolia, transport: http(RPC) });

const abi = parseAbi([
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
  'function nonces(address) view returns (uint256)',
]);

// Allow passing the amount as an argument, e.g. "1.5"
const amountArg = process.argv[2] ?? '1'; // default 1 token
const ttlMinutes = Number(process.argv[3] ?? 60); // signature validity in minutes, default 60

async function main() {
  const [name, decimals, nonce] = await Promise.all([
    publicClient.readContract({ address: TOKEN, abi, functionName: 'name' }),
    publicClient.readContract({ address: TOKEN, abi, functionName: 'decimals' }),
    publicClient.readContract({ address: TOKEN, abi, functionName: 'nonces', args: [OWNER] }),
  ]);

  const value = parseUnits(amountArg, Number(decimals));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + ttlMinutes * 60);

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
    spender: process.env.SPENDER_ADDRESS as `0x${string}`,
    value,
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

  console.log('--- Copy to .env ---');
  console.log(`PERMIT_SIGNATURE=${signature}`);
  console.log(`PERMIT_VALUE=${value.toString()}`);
  console.log(`PERMIT_DEADLINE=${deadline.toString()}`);
  console.log('--------------------');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

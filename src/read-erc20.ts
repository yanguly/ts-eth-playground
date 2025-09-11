import 'dotenv/config';
import { createPublicClient, http, formatUnits } from 'viem';
import { sepolia } from 'viem/chains';

const RPC = process.env.INFURA_SEPOLIA!;
const TOKEN = process.env.TOKEN_ADDRESS as `0x${string}`;
const HOLDER = process.env.MY_ADDRESS as `0x${string}`;
if (!RPC || !TOKEN || !HOLDER)
  throw new Error('Missing INFURA_SEPOLIA or TOKEN_ADDRESS or MY_ADDRESS');

const erc20Abi = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
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
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

(async () => {
  const client = createPublicClient({ chain: sepolia, transport: http(RPC) });

  const [name, symbol, decimals, bal] = await Promise.all([
    client.readContract({ address: TOKEN, abi: erc20Abi, functionName: 'name' }),
    client.readContract({ address: TOKEN, abi: erc20Abi, functionName: 'symbol' }),
    client.readContract({ address: TOKEN, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({
      address: TOKEN,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [HOLDER],
    }),
  ]);

  console.log(`${name} (${symbol}), decimals: ${decimals}`);
  console.log(`Balance of ${HOLDER}:`, formatUnits(bal as bigint, decimals as number), symbol);
})();

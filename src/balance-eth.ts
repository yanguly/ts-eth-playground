import 'dotenv/config';
import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';

const RPC = process.env.INFURA_SEPOLIA!;
const ADDRESS = process.env.MY_ADDRESS as `0x${string}`;

if (!RPC || !ADDRESS) throw new Error('Missing INFURA_SEPOLIA or MY_ADDRESS in .env');

const client = createPublicClient({ chain: sepolia, transport: http(RPC) });

(async () => {
  const balance = await client.getBalance({ address: ADDRESS });
  console.log(`Balance of ${ADDRESS}:`, formatEther(balance), 'ETH');
})();

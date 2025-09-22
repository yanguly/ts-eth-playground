import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.NETWORK_RPC_URL!;
const PK = process.env.PRIVATE_KEY as `0x${string}`;
const RECIPIENT = process.env.RECIPIENT as `0x${string}`;

if (!RPC || !PK || !RECIPIENT)
  throw new Error('Missing NETWORK_RPC_URL or PRIVATE_KEY or RECIPIENT');

const account = privateKeyToAccount(PK);

const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });

(async () => {
  const hash = await wallet.sendTransaction({
    to: RECIPIENT,
    value: parseEther('0.01'),
  });
  console.log('transaction hash:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('status:', receipt.status, 'block:', receipt.blockNumber);
})();

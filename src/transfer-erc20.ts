import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.INFURA_SEPOLIA!;
const PK = process.env.PRIVATE_KEY as `0x${string}`;
const TOKEN = process.env.TOKEN_ADDRESS as `0x${string}`;
const RECIPIENT = process.env.RECIPIENT as `0x${string}`;

if (!RPC || !PK || !TOKEN || !RECIPIENT) {
  throw new Error('Missing env vars: INFURA_SEPOLIA, PRIVATE_KEY, TOKEN_ADDRESS, RECIPIENT');
}

const erc20TransferAbi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

(async () => {
  const account = privateKeyToAccount(PK);

  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });

  const hash = await walletClient.writeContract({
    address: TOKEN,
    abi: erc20TransferAbi,
    functionName: 'transfer',
    args: [RECIPIENT, parseUnits('100', 18)],
  });

  console.log('transfer tx hash:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('status:', receipt.status);
})();

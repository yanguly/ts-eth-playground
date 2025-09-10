import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.INFURA_SEPOLIA!;
const PK = process.env.PRIVATE_KEY as `0x${string}`;
if (!RPC || !PK) throw new Error('Missing INFURA_SEPOLIA or PRIVATE_KEY in .env');

(async () => {
  const artifactRaw = await readFile('contracts/out/YansToken.sol/YansToken.json', 'utf8');
  const artifact = JSON.parse(artifactRaw);
  const abi = artifact.abi as unknown[];
  const bytecode = ('0x' + artifact.bytecode.object) as `0x${string}`;

  const account = privateKeyToAccount(PK);
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

  const name = "Yan's Token";
  const symbol = 'YAN';
  const initialSupply = 1_000_000n; // 1,000,000 YAN

  const hash = await wallet.deployContract({
    abi,
    bytecode,
    args: [name, symbol, initialSupply],
  });

  console.log('deploy tx hash:', hash);

  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;
  console.log('contract address:', contractAddress);
})();

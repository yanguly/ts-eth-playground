import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
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

  const account = privateKeyToAccount(PK);
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

  const name = "Yan's Token";
  const symbol = 'YAN';
  const initialSupply = 1_000_000n;

  let bytecode: `0x${string}`;

  if (artifact.bytecode.object.startsWith('0x')) {
    bytecode = artifact.bytecode.object as `0x${string}`;
  } else {
    bytecode = `0x${artifact.bytecode.object}` as `0x${string}`;
  }

  const hash = await wallet.deployContract({
    abi,
    bytecode,
    args: [name, symbol, initialSupply],
    account,
  });

  console.log('deploy tx hash:', hash);

  console.log({
    abiLen: abi.length,
    bytecodeLen: bytecode.length,
    args: [name, symbol, initialSupply],
  });

  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;
  console.log('contract address:', contractAddress);

  let envFile = '';
  try {
    envFile = await readFile('.env', 'utf8');
  } catch {
    envFile = '';
  }

  const lines = envFile.split('\n').filter(Boolean);
  const withoutOld = lines.filter((line) => !line.startsWith('TOKEN_ADDRESS='));
  withoutOld.push(`TOKEN_ADDRESS=${contractAddress}`);
  await writeFile('.env', withoutOld.join('\n') + '\n', 'utf8');

  console.log('✅ .env updated with TOKEN_ADDRESS');
})();

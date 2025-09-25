import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadEnv,
  parseCliOptions,
  resolveAdminTarget,
  hasDefaultAdminRole,
  runInitializeV3,
  type LoadedEnv,
  type InitializeClients,
  HexAddress,
} from '../src/initialize-v3.ts';

const baseEnv: LoadedEnv = {
  rpcUrl: 'https://example-rpc',
  privateKey: ('0x' + '1'.repeat(64)) as HexAddress,
  tokenAddress: ('0x' + '2'.repeat(40)) as HexAddress,
  ownerAddress: ('0x' + '3'.repeat(40)) as HexAddress,
};

describe('initialize-v3 helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loadEnv validates required fields', () => {
    const env = loadEnv({
      rpcUrl: baseEnv.rpcUrl,
      privateKey: baseEnv.privateKey,
      tokenAddress: baseEnv.tokenAddress,
      ownerAddress: baseEnv.ownerAddress,
    });
    expect(env).toEqual(baseEnv);
  });

  it('loadEnv throws on missing values', () => {
    expect(() => loadEnv({})).toThrowError(
      'Missing env: NETWORK_RPC_URL, PRIVATE_KEY, TOKEN_ADDRESS',
    );
  });

  it('parseCliOptions reads --admin flag', () => {
    const result = parseCliOptions(['--admin', baseEnv.ownerAddress!]);
    expect(result).toEqual({ admin: baseEnv.ownerAddress });
  });

  it('resolveAdminTarget prefers CLI override', () => {
    const cli = { admin: ('0x' + '4'.repeat(40)) as HexAddress };
    expect(resolveAdminTarget(cli, baseEnv)).toBe(cli.admin);
  });

  it('resolveAdminTarget falls back to ownerAddress', () => {
    expect(resolveAdminTarget({}, baseEnv)).toBe(baseEnv.ownerAddress);
  });

  it('resolveAdminTarget throws when admin missing', () => {
    expect(() => resolveAdminTarget({}, { ...baseEnv, ownerAddress: undefined })).toThrow(
      'Admin address required: pass --admin 0x... or set OWNER_ADDRESS',
    );
  });

  it('hasDefaultAdminRole delegates to readContract', async () => {
    const readMock = vi.fn().mockResolvedValue(true);
    const result = await hasDefaultAdminRole(
      {
        readContract: readMock,
        waitForTransactionReceipt: vi.fn(),
      },
      baseEnv,
      baseEnv.ownerAddress!,
    );
    expect(readMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: baseEnv.tokenAddress,
        functionName: 'hasRole',
      }),
    );
    expect(result).toBe(true);
  });

  it('runInitializeV3 skips when admin already assigned', async () => {
    const readMock = vi.fn().mockResolvedValue(true);
    const writeMock = vi.fn();
    await runInitializeV3(baseEnv, baseEnv.ownerAddress!, {
      publicClient: {
        readContract: readMock,
        waitForTransactionReceipt: vi.fn(),
      },
      walletClient: { writeContract: writeMock },
    });
    expect(writeMock).not.toHaveBeenCalled();
  });

  it('runInitializeV3 writes and waits when admin missing', async () => {
    const readMock = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const writeMock = vi.fn().mockResolvedValue(('0x' + '5'.repeat(64)) as HexAddress);
    const waitMock = vi.fn().mockResolvedValue({ status: 'success' });

    await runInitializeV3(baseEnv, baseEnv.ownerAddress!, {
      publicClient: {
        readContract: readMock,
        waitForTransactionReceipt: waitMock,
      },
      walletClient: { writeContract: writeMock },
    } satisfies InitializeClients);

    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'initializeV3' }),
    );
    expect(waitMock).toHaveBeenCalledWith({ hash: expect.any(String) });
    expect(readMock).toHaveBeenCalledTimes(2);
  });
});

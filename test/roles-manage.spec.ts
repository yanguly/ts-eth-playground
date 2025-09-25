import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadRoleEnv,
  parseRoleArgs,
  resolveRole,
  executeRoleCommand,
  ROLE_MAP,
  type RoleEnv,
  type RoleCliOptions,
  HexAddress,
  HexRole,
} from '../src/roles-manage.ts';

const env: RoleEnv = {
  rpcUrl: 'https://example-rpc',
  privateKey: ('0x' + '1'.repeat(64)) as HexAddress,
  tokenAddress: ('0x' + '2'.repeat(40)) as HexAddress,
};

describe('roles-manage helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loadRoleEnv validates presence', () => {
    const result = loadRoleEnv({
      rpcUrl: env.rpcUrl,
      privateKey: env.privateKey,
      tokenAddress: env.tokenAddress,
    });
    expect(result).toEqual(env);
  });

  it('loadRoleEnv throws when missing values', () => {
    expect(() => loadRoleEnv({})).toThrowError(
      'Missing env: NETWORK_RPC_URL, PRIVATE_KEY, TOKEN_ADDRESS',
    );
  });

  it('parseRoleArgs parses action, role and target', () => {
    const options = parseRoleArgs(['grant', '--role', 'pauser', '--to', env.tokenAddress]);
    expect(options).toEqual({ action: 'grant', roleInput: 'pauser', target: env.tokenAddress });
  });

  it('parseRoleArgs rejects duplicate action', () => {
    expect(() => parseRoleArgs(['grant', 'revoke'])).toThrow('Action already specified');
  });

  it('resolveRole handles aliases and explicit hashes', () => {
    expect(resolveRole('pauser')).toBe(ROLE_MAP.pauser);
    const explicit = ('0x' + '3'.repeat(64)) as HexRole;
    expect(resolveRole(explicit)).toBe(explicit);
  });

  it('executeRoleCommand calls viem clients correctly', async () => {
    const readMock = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const writeMock = vi.fn().mockResolvedValue(('0x' + '4'.repeat(64)) as HexAddress);
    const waitMock = vi.fn().mockResolvedValue({ status: 'success' });

    const options: RoleCliOptions = {
      action: 'grant',
      roleInput: 'pauser',
      target: ('0x' + '5'.repeat(40)) as HexAddress,
    };

    await executeRoleCommand(env, options, {
      publicClient: {
        readContract: readMock,
        waitForTransactionReceipt: waitMock,
      },
      walletClient: { writeContract: writeMock },
    });

    expect(readMock).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'hasRole' }));
    expect(writeMock).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'grantRole' }));
    expect(waitMock).toHaveBeenCalledWith({ hash: expect.any(String) });
    expect(readMock).toHaveBeenCalledTimes(2);
  });
});

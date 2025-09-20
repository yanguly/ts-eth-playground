import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseUnits } from 'viem';
import {
  type Ctx,
  type Address,
  cmdPause,
  cmdUnpause,
  cmdMint,
  cmdBurn,
  cmdBurnFrom,
  cmdStatus,
} from '../src/admin-token.ts';

function makeCtx(overrides: Partial<Ctx> = {}): Ctx {
  const token = ('0x' + '1'.repeat(40)) as Address;
  const account = ({ address: ('0x' + 'a'.repeat(40)) as Address } as unknown) as Ctx['account'];
  const publicClient = ({
    simulateContract: vi.fn().mockResolvedValue(undefined),
    readContract: vi.fn(),
  } as unknown) as Ctx['publicClient'];
  const wallet = ({
    writeContract: vi.fn().mockResolvedValue(('0x' + 'b'.repeat(64)) as Address),
  } as unknown) as Ctx['wallet'];
  return {
    token,
    account,
    publicClient,
    wallet,
    ...overrides,
  } as Ctx;
}

describe('admin-token commands', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pause calls simulate + write with correct functionName', async () => {
    const ctx = makeCtx();
    await cmdPause(ctx);
    expect((ctx.publicClient.simulateContract as any)).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'pause' }),
    );
    expect((ctx.wallet.writeContract as any)).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'pause' }),
    );
    expect(logSpy).toHaveBeenCalledWith('pause tx:', expect.any(String));
  });

  it('unpause calls simulate + write with correct functionName', async () => {
    const ctx = makeCtx();
    await cmdUnpause(ctx);
    expect((ctx.publicClient.simulateContract as any)).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'unpause' }),
    );
    expect((ctx.wallet.writeContract as any)).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'unpause' }),
    );
    expect(logSpy).toHaveBeenCalledWith('unpause tx:', expect.any(String));
  });

  it('mint parses amount using decimals and writes', async () => {
    const ctx = makeCtx();
    // mock decimals
    (ctx.publicClient.readContract as any).mockResolvedValueOnce(18);
    await cmdMint(ctx, '1', ('0x' + 'c'.repeat(40)) as Address);
    const amount = parseUnits('1', 18);
    expect((ctx.publicClient.simulateContract as any)).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'mint', args: [expect.any(String), amount] }),
    );
    expect((ctx.wallet.writeContract as any)).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'mint', args: [expect.any(String), amount] }),
    );
    expect(logSpy).toHaveBeenCalledWith('mint tx:', expect.any(String));
  });

  it('burn parses amount using decimals and writes', async () => {
    const ctx = makeCtx();
    (ctx.publicClient.readContract as any).mockResolvedValueOnce(18);
    await cmdBurn(ctx, '2');
    const amount = parseUnits('2', 18);
    expect((ctx.publicClient.simulateContract as any)).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'burn', args: [amount] }),
    );
    expect((ctx.wallet.writeContract as any)).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'burn', args: [amount] }),
    );
    expect(logSpy).toHaveBeenCalledWith('burn tx:', expect.any(String));
  });

  it('burnFrom parses owner + amount and writes', async () => {
    const ctx = makeCtx();
    (ctx.publicClient.readContract as any).mockResolvedValueOnce(18);
    const owner = ('0x' + 'd'.repeat(40)) as Address;
    await cmdBurnFrom(ctx, owner, '3');
    const amount = parseUnits('3', 18);
    expect((ctx.publicClient.simulateContract as any)).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'burnFrom', args: [owner, amount] }),
    );
    expect((ctx.wallet.writeContract as any)).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'burnFrom', args: [owner, amount] }),
    );
    expect(logSpy).toHaveBeenCalledWith('burnFrom tx:', expect.any(String));
  });

  it('status reads fields and prints summary', async () => {
    const ctx = makeCtx();
    // name, symbol, decimals, totalSupply, paused, owner
    (ctx.publicClient.readContract as any)
      .mockResolvedValueOnce('TokenName')
      .mockResolvedValueOnce('TKN')
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(123456789n)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(('0x' + 'e'.repeat(40)) as Address)
      // PAUSER_ROLE
      .mockResolvedValueOnce(('0x' + 'f'.repeat(64)) as Address)
      // hasRole()
      .mockResolvedValueOnce(true);

    await cmdStatus(ctx);

    expect(logSpy).toHaveBeenCalledWith('Token:', 'TokenName', '(TKN)');
    expect(logSpy).toHaveBeenCalledWith('Decimals:', 18);
    expect(logSpy).toHaveBeenCalledWith('Signer:', ctx.account.address);
    expect(logSpy).toHaveBeenCalledWith('Owner:', expect.any(String));
  });
});


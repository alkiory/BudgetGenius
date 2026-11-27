/**
 * Finny's contingency chain.
 *
 * The backoffice holds every provider key and the assistant tries them in
 * `priority` order. A rejected key must be recorded and skipped inside the
 * same request, and only an all-rejected chain is a configuration error —
 * this is what `FINNY_INVALID_KEY` reports to the app. Verified here through
 * the real service (no provider call), so a regression in the ordering or in
 * the error classification fails fast.
 */

import { AiService, FinnyConfigError } from '@application/ai/ai.service';
import { sealSecret } from '@infrastructure/crypto/secret-box';

const keyRow = (id: number, label: string, secret: string) => ({
  id,
  label,
  lastFour: secret.slice(-4),
  encryptedKey: sealSecret(secret),
  isActive: true,
  priority: id,
  createdAt: new Date(),
  lastFailedAt: null,
  lastError: null,
});

const buildService = (rows: unknown[]) => {
  const repo = {
    find: jest.fn().mockResolvedValue(rows),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
  const userService = {
    getById: jest.fn().mockResolvedValue({ name: 'Test', overviews: {} }),
  };
  const redis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(1),
  };
  const service = new AiService(
    logger as any,
    userService as any,
    redis as any,
    repo as any,
  );
  return { service, repo, redis };
};

describe('AiService — provider key failover', () => {
  it('skips a rejected key and answers with the next one in priority order', async () => {
    const { service, repo } = buildService([
      keyRow(1, 'primary', 'sk-primary-1111'),
      keyRow(2, 'contingency', 'sk-backup-2222'),
    ]);
    const call = jest
      .spyOn(service as any, 'callOpenAI')
      .mockRejectedValueOnce({ status: 401, message: 'Incorrect API key' })
      .mockResolvedValueOnce('La reserva cubre tres meses.');

    const answer = await service.analyzeFinancialData(7, '¿cuánto ahorro?');

    expect(answer).toBe('La reserva cubre tres meses.');
    expect(call).toHaveBeenCalledTimes(2);
    expect((call.mock.calls[0][1] as string)).toBe('sk-primary-1111');
    expect((call.mock.calls[1][1] as string)).toBe('sk-backup-2222');
    // The failure is recorded on the key that failed, not on the survivor.
    expect(repo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ lastFailedAt: expect.any(Date) }),
    );
    expect(repo.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ lastFailedAt: null, lastError: null }),
    );
  });

  it('reports FINNY_INVALID_KEY when every configured key was rejected', async () => {
    const { service } = buildService([
      keyRow(1, 'primary', 'sk-primary-1111'),
      keyRow(2, 'contingency', 'sk-backup-2222'),
    ]);
    jest
      .spyOn(service as any, 'callOpenAI')
      .mockRejectedValue({ status: 401, message: 'Incorrect API key' });

    await expect(service.analyzeFinancialData(7, 'hola')).rejects.toMatchObject({
      code: 'FINNY_INVALID_KEY',
    });
    await expect(service.analyzeFinancialData(7, 'hola')).rejects.toBeInstanceOf(
      FinnyConfigError,
    );
  });

  it('reports FINNY_NOT_CONFIGURED with no active key in the backoffice', async () => {
    const { service } = buildService([]);

    await expect(service.analyzeFinancialData(7, 'hola')).rejects.toMatchObject({
      code: 'FINNY_NOT_CONFIGURED',
    });
  });

  it('counts a failing key as unavailable in the status snapshot', async () => {
    const rows = [
      {
        ...keyRow(1, 'primary', 'sk-primary-1111'),
        lastFailedAt: new Date(),
        lastError: '401 Incorrect API key',
      },
      {
        ...keyRow(2, 'contingency', 'sk-backup-2222'),
        lastFailedAt: new Date(),
        lastError: 'timeout',
      },
    ];
    const { service } = buildService(rows);

    const status = await service.getAdminStatus();

    expect(status.available).toBe(false);
    expect(status.reason).toBe('FINNY_PROVIDER_ERROR');
    expect(status.activeKeys).toBe(2);
  });
});

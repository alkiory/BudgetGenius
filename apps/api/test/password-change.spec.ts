/**
 * The security form used to post `password` to the profile endpoint, which now
 * drops credentials. This is the replacement: re-authenticate with the current
 * password, write the new one through the repository (which hashes it) and
 * revoke the stored refresh token so every other device signs in again.
 *
 * A wrong current password answers 400, never 401: the SPA's interceptor takes
 * any non-auth 401 as "session expired" and ends the session, which would be a
 * confusing way to report a typo.
 */

import * as bcrypt from 'bcryptjs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserService } from '@application/user/user.service';

const buildService = (user: any) => {
  const userRepository = {
    findById: jest.fn().mockResolvedValue(user),
    updateUser: jest.fn().mockResolvedValue(user),
  };
  const redisService = {
    delete: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    incr: jest.fn().mockResolvedValue(1),
  };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const tokenEpoch = { bump: jest.fn().mockResolvedValue(1) };

  return {
    service: new UserService(
      userRepository as any,
      logger as any,
      {} as any,
      redisService as any,
      tokenEpoch as any,
    ),
    userRepository,
    redisService,
    tokenEpoch,
  };
};

describe('UserService.changePassword', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes the new plaintext password through the repository', async () => {
    const { service, userRepository } = buildService({
      id: 9,
      password: '$2a$04$stored-hash',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const result = await service.changePassword(9, 'current', '#NewPass123');

    expect(userRepository.updateUser).toHaveBeenCalledWith(9, {
      password: '#NewPass123',
    });
    expect(result.message).toContain('Password updated');
  });

  it('revokes the stored refresh token so other sessions have to sign in', async () => {
    const { service, redisService } = buildService({
      id: 9,
      password: '$2a$04$stored-hash',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    await service.changePassword(9, 'current', '#NewPass123');

    expect(redisService.delete).toHaveBeenCalledWith('refreshToken:9');
  });

  it('bumps the session epoch so access tokens already issued die too', async () => {
    const { service, tokenEpoch } = buildService({
      id: 9,
      password: '$2a$04$stored-hash',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    await service.changePassword(9, 'current', '#NewPass123');

    expect(tokenEpoch.bump).toHaveBeenCalledWith(9);
  });

  it('rejects a wrong current password with 400 and changes nothing', async () => {
    const { service, userRepository, redisService } = buildService({
      id: 9,
      password: '$2a$04$stored-hash',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(
      service.changePassword(9, 'wrong', '#NewPass123'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepository.updateUser).not.toHaveBeenCalled();
    expect(redisService.delete).not.toHaveBeenCalled();
  });

  it('refuses a social-only account, which has no password', async () => {
    const { service, userRepository, redisService } = buildService({
      id: 9,
      password: null,
    });

    await expect(
      service.changePassword(9, 'whatever', '#NewPass123'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepository.updateUser).not.toHaveBeenCalled();
    expect(redisService.delete).not.toHaveBeenCalled();
  });

  it('rejects an unknown account', async () => {
    const { service } = buildService(null);

    await expect(
      service.changePassword(9, 'whatever', '#NewPass123'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('counts a wrong current password in the account bucket', async () => {
    const { service, redisService } = buildService({
      id: 9,
      password: '$2a$04$stored-hash',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(
      service.changePassword(9, 'wrong', '#NewPass123'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(redisService.incr).toHaveBeenCalledWith(
      'passwordChange:attempts:9',
      15 * 60,
    );
  });

  it('answers 429 once the account bucket is exhausted, even with a valid token', async () => {
    const { service, userRepository, redisService } = buildService({
      id: 9,
      password: '$2a$04$stored-hash',
    });
    redisService.get.mockResolvedValueOnce('5');

    await expect(
      service.changePassword(9, 'guess', '#NewPass123'),
    ).rejects.toMatchObject({ status: 429 });

    // Nothing is compared, written or revoked while the bucket is closed.
    expect(userRepository.updateUser).not.toHaveBeenCalled();
    expect(redisService.delete).not.toHaveBeenCalled();
  });

  it('clears the account bucket after a successful change', async () => {
    const { service, redisService } = buildService({
      id: 9,
      password: '$2a$04$stored-hash',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    await service.changePassword(9, 'current', '#NewPass123');

    expect(redisService.delete).toHaveBeenCalledWith(
      'passwordChange:attempts:9',
    );
  });
});

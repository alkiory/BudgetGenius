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
  const redisService = { delete: jest.fn().mockResolvedValue(1) };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  return {
    service: new UserService(
      userRepository as any,
      logger as any,
      {} as any,
      redisService as any,
    ),
    userRepository,
    redisService,
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
});

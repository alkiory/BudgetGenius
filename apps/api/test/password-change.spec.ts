/**
 * The security form used to post `password` to the profile endpoint, which now
 * drops credentials. This is the replacement: re-authenticate with the current
 * password, then write the new one through the repository (which hashes it).
 */

import * as bcrypt from 'bcryptjs';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '@application/user/user.service';

const buildService = (user: any) => {
  const userRepository = {
    findById: jest.fn().mockResolvedValue(user),
    updateUser: jest.fn().mockResolvedValue(user),
  };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  return {
    service: new UserService(userRepository as any, logger as any, {} as any),
    userRepository,
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

    const result = await service.changePassword(
      9,
      'current-password',
      '#NewPass123',
    );

    expect(userRepository.updateUser).toHaveBeenCalledWith(9, {
      password: '#NewPass123',
    });
    expect(result.message).toContain('Password updated');
  });

  it('rejects a wrong current password and writes nothing', async () => {
    const { service, userRepository } = buildService({
      id: 9,
      password: '$2a$04$stored-hash',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(
      service.changePassword(9, 'wrong', '#NewPass123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userRepository.updateUser).not.toHaveBeenCalled();
  });

  it('refuses a social-only account, which has no password', async () => {
    const { service, userRepository } = buildService({
      id: 9,
      password: null,
    });

    await expect(
      service.changePassword(9, 'whatever', '#NewPass123'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepository.updateUser).not.toHaveBeenCalled();
  });

  it('rejects an unknown account', async () => {
    const { service } = buildService(null);

    await expect(
      service.changePassword(9, 'whatever', '#NewPass123'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

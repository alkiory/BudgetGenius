/**
 * `PUT /user/:id` used to take `Partial<UserDto>`, which the global
 * `ValidationPipe` skips (a type alias erases to `Object`, so there is no
 * metatype to validate), and the controller spread the body into the
 * repository. A request could write `role`, `email`, `authProvider` or
 * `refreshToken` — setting `role: "superadmin"` and signing in again minted an
 * operator token.
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  profilePatch,
  UpdateUserDto,
} from '@application/user/dto/update-user.dto';

describe('PUT /user/:id — editable fields', () => {
  it('drops role, email, authProvider and refreshToken from the body', () => {
    const dto = plainToInstance(UpdateUserDto, {
      name: 'Renamed',
      email: 'operator@example.com',
      role: 'superadmin',
      authProvider: 'google',
      refreshToken: 'stolen',
      isPremium: false,
    });

    const patch = profilePatch(dto);

    expect(patch.name).toBe('Renamed');
    expect(patch).not.toHaveProperty('role');
    expect(patch).not.toHaveProperty('email');
    expect(patch).not.toHaveProperty('authProvider');
    expect(patch).not.toHaveProperty('refreshToken');
    expect(patch).not.toHaveProperty('isPremium');
  });

  it('keeps the surname when it is supplied', () => {
    const dto = plainToInstance(UpdateUserDto, { surname: 'Campbell' });

    expect(profilePatch(dto).surname).toBe('Campbell');
  });

  it('does not write fields the caller omitted', () => {
    const patch = profilePatch(plainToInstance(UpdateUserDto, {}));

    expect(patch).not.toHaveProperty('name');
    expect(patch).not.toHaveProperty('surname');
    expect(patch.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects a non-string name', async () => {
    const dto = plainToInstance(UpdateUserDto, { name: 42 });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('name');
  });

  it('rejects an over-long name', async () => {
    const dto = plainToInstance(UpdateUserDto, { name: 'x'.repeat(81) });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('name');
  });
});

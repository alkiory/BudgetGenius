/**
 * Public signup only ever creates a regular account. `CreateUserDto.role` used
 * to be a free-form string, so `POST /auth/signup { "role": "superadmin" }`
 * minted a second operator — which breaks the one-operator invariant and
 * hands out the whole backoffice.
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from '@application/user/dto/create.dto';

const signup = (role?: string) =>
  plainToInstance(CreateUserDto, {
    name: 'Operator',
    surname: 'One',
    email: 'operator@example.com',
    password: '#Password123',
    authProvider: 'email',
    ...(role === undefined ? {} : { role }),
  });

describe('signup cannot request a privileged role', () => {
  it('rejects role=superadmin', async () => {
    const errors = await validate(signup('superadmin'));

    expect(errors.map((error) => error.property)).toContain('role');
  });

  it('rejects role=admin', async () => {
    const errors = await validate(signup('admin'));

    expect(errors.map((error) => error.property)).toContain('role');
  });

  it('accepts role=user', async () => {
    await expect(validate(signup('user'))).resolves.toHaveLength(0);
  });

  it('accepts an omitted role — the controller defaults it to user', async () => {
    await expect(validate(signup())).resolves.toHaveLength(0);
  });
});

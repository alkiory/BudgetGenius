/**
 * Whitespace around an email is input noise, not a different address.
 *
 * The global `ValidationPipe` runs with `transform: true`, so `@Transform` on
 * the DTOs trims before `@IsEmail()` — otherwise a copy-pasted address
 * (`" user@x.com "`) is rejected with 400 and the domain's `normalizeEmail`
 * never sees it. Casing stays out of the DTO: that is canonicalised by the
 * domain so storage and lookups agree.
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from '@application/auth/dto/login.dto';
import { CreateUserDto } from '@application/user/dto/create.dto';

describe('email trimming at the DTO boundary', () => {
  it('LoginDto trims the email and then passes validation', async () => {
    const dto = plainToInstance(LoginDto, {
      email: '  Foo@Bar.com  ',
      password: 'secret',
    });

    expect(dto.email).toBe('Foo@Bar.com');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('LoginDto still rejects a malformed email — trimming does not weaken validation', async () => {
    const dto = plainToInstance(LoginDto, {
      email: '  not-an-email  ',
      password: 'secret',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('email');
  });

  it('LoginDto leaves the password untouched — spaces can be meaningful there', () => {
    const dto = plainToInstance(LoginDto, {
      email: 'a@b.com',
      password: '  pw  ',
    });

    expect(dto.password).toBe('  pw  ');
  });

  it('CreateUserDto trims the email on signup (tabs and newlines too)', async () => {
    const dto = plainToInstance(CreateUserDto, {
      name: 'Case',
      surname: 'Tester',
      email: '\tCase@Example.COM \n',
      password: '#Password123',
      authProvider: 'email',
      role: 'user',
    });

    expect(dto.email).toBe('Case@Example.COM');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});

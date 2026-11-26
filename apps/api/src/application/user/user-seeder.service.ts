import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { UserDto } from './dto/user.dto';
import { LoggingService } from '@infrastructure/log/logger.service';
import { UserSettingsService } from './user-settings.service';

@Injectable()
export class UserSeederService {
  constructor(
    private readonly userRepository: UserRepositoryImpl,
    private readonly userSettings: UserSettingsService,
    private readonly logger: LoggingService,
  ) {}

  async createDefaultUsers(): Promise<void> {
    // The backoffice needs an operator in every environment, so this runs
    // before the development-only gate below.
    await this.ensureSuperAdmin();

    // QA-0.1 — the seeded accounts use a fixed, publicly-known password
    // (`#Password123`). `AppService.onModuleInit()` runs this in every
    // environment, so a production boot would silently ensure an admin
    // account whose credentials are in the repository history. Seed only
    // when the operator explicitly runs in development; everything else
    // (production, test, staging, NODE_ENV unset) is a no-op.
    if (process.env.NODE_ENV !== 'development') {
      this.logger.log(
        `🌱 User seeder skipped (NODE_ENV=${
          process.env.NODE_ENV ?? 'unset'
        }) — fixed-password demo accounts are development-only`,
      );
      return;
    }

    // Check if the users already exist
    const userExists = await this.userRepository.findByEmail('admin@admin.com');

    if (!userExists) {
      // Create admin and normal user
      const adminUser = this.userRepository.createUser({
        name: 'Admin User',
        surname: 'Admin Surname',
        email: 'admin@admin.com',
        password: '#Password123',
        role: 'admin',
        authProvider: 'email',
        refreshToken: null,
      });
      const adminUserDto: UserDto = {
        id: (await adminUser).id,
        name: (await adminUser).name,
        surname: (await adminUser).surname,
        email: (await adminUser).email,
        password: (await adminUser).password,
        role: (await adminUser).role,
        refreshToken: (await adminUser).refreshToken,
        authProvider: (await adminUser).authProvider,
        isPremium: (await adminUser).isPremium ?? true,
      };

      await this.userRepository.save(adminUserDto);

      // Set default settings for the admin user
      await this.userSettings.updateSettings(adminUserDto.id, {
        timezone: 'UTC',
        currency: 'EUR',
        locale: 'en-US',
      });

      const normalUser = this.userRepository.createUser({
        name: 'Normal Name',
        surname: 'Normal Surname',
        email: 'normal@normal.com',
        password: '#Password123',
        role: 'user',
        authProvider: 'email',
        refreshToken: null,
      });
      const normalUserDto: UserDto = {
        id: (await normalUser).id,
        name: (await normalUser).name,
        surname: (await normalUser).surname,
        email: (await normalUser).email,
        password: (await normalUser).password,
        role: (await normalUser).role,
        refreshToken: (await normalUser).refreshToken,
        authProvider: (await normalUser).authProvider,
        isPremium: (await normalUser).isPremium ?? true,
      };

      // Set default settings for the normal user
      await this.userSettings.updateSettings(normalUserDto.id, {
        timezone: 'America/Bogota',
        currency: 'EUR',
        locale: 'es-CO',
      });

      await this.userRepository.save(await normalUserDto);

      this.logger.log('🔑 Default users + settings created!');
    } else {
      this.logger.log('🙆‍♂️ Users already exist!');
    }
  }

  /**
   * Ensures a super admin exists.
   *
   * `SUPERADMIN_EMAIL` selects the operator. Email signup does not verify
   * mailbox ownership, so matching the address is not proof that the operator
   * owns the row: an attacker could register it first. Promotion therefore
   * also requires the account's current password to match
   * `SUPERADMIN_PASSWORD`; otherwise the role is left untouched and the boot
   * logs an actionable warning. New accounts are only created when the email
   * is absent and a password is configured.
   *
   * In development the local fallback (`superadmin@admin.com` / `#Password123`)
   * keeps the backoffice reachable with no extra setup.
   */
  private async ensureSuperAdmin(): Promise<void> {
    const isDev = process.env.NODE_ENV === 'development';
    const email = (
      process.env.SUPERADMIN_EMAIL?.trim() ||
      (isDev ? 'superadmin@admin.com' : '')
    ).toLowerCase();

    if (!email) {
      this.logger.log(
        '🛡️ Superadmin seeder skipped — set SUPERADMIN_EMAIL to enable the backoffice',
      );
      return;
    }

    const password =
      process.env.SUPERADMIN_PASSWORD || (isDev ? '#Password123' : '');
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      if (existing.role !== 'superadmin') {
        const ownsAccount = Boolean(
          password &&
            existing.password &&
            (await bcrypt.compare(password, existing.password)),
        );
        if (!ownsAccount) {
          this.logger.warn(
            `🛡️ Refusing to promote existing account id=${existing.id}: ` +
              'its password does not match SUPERADMIN_PASSWORD. Promote it ' +
              'manually after verifying the operator, or set the configured ' +
              'password to the account password for one boot.',
          );
          return;
        }
        // `setRole` avoids the entity password hook (see its docblock).
        await this.userRepository.setRole(existing.id, 'superadmin');
        this.logger.log(
          `🛡️ Existing account id=${existing.id} promoted to superadmin`,
        );
      }
      return;
    }

    if (!password) {
      this.logger.warn(
        '🛡️ Superadmin email does not match an existing account and SUPERADMIN_PASSWORD is empty — nothing was created',
      );
      return;
    }

    const created = await this.userRepository.createUser({
      name: 'Super',
      surname: 'Admin',
      email,
      password,
      role: 'superadmin',
      authProvider: 'email',
      refreshToken: null,
    });

    await this.userSettings.updateSettings(created.id, {
      timezone: 'UTC',
      currency: 'EUR',
      locale: 'en-US',
    });

    this.logger.log('🛡️ Superadmin account ready');
  }
}

import { Injectable } from '@nestjs/common';
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
        currency: 'USD',
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
        currency: 'COP',
        locale: 'es-CO',
      });

      await this.userRepository.save(await normalUserDto);

      this.logger.log('🔑 Default users + settings created!');
    } else {
      this.logger.log('🙆‍♂️ Users already exist!');
    }
  }
}

import { Injectable } from '@nestjs/common';
import { UserSeederService } from '@application/user/user-seeder.service';

@Injectable()
export class AppService {
  constructor(private userSeederService: UserSeederService) {}

  async onModuleInit() {
    await this.userSeederService.createDefaultUsers();
  }

  getHello(): string {
    return 'This is the api service, what are you doing here? 🧐';
  }
}

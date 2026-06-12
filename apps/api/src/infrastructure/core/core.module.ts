import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { UserSettingsModule } from '@infrastructure/user/user-settings.module';
import { UserSettingsMiddleware } from '@infrastructure/middleware/user-settings.middleware';

@Module({
  imports: [UserSettingsModule],
  providers: [UserSettingsMiddleware],
  exports: [UserSettingsMiddleware],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UserSettingsMiddleware)
      .forRoutes({ path: 'api/*', method: RequestMethod.ALL });
  }
}
